/**
 * S3 PutObject adapter for backups.
 *
 * Why native fetch + SigV4 instead of @aws-sdk/client-s3:
 *   - Avoids a ~2MB dep on a code path that runs at most once an hour.
 *   - No instrumentation hooks needed (the SDK pulls in a bunch of
 *     runtime support we don't want at app boot).
 *   - Backup PUTs are large-but-rare; we don't need streaming multipart.
 *     If the dump ever exceeds ~5GB we'll switch to multipart explicitly.
 *
 * Credential resolution (first match wins):
 *   1. BACKUP_S3_ACCESS_KEY_ID / BACKUP_S3_SECRET_ACCESS_KEY
 *      — dedicated keys, recommended for least-privilege.
 *   2. AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
 *      — shared app credentials.
 *
 * Region resolution: BACKUP_S3_REGION → AWS_REGION → AWS_DEFAULT_REGION.
 * Optional: BACKUP_S3_ENDPOINT for S3-compatible stores (MinIO, R2, Wasabi).
 */

import { createHash, createHmac } from 'node:crypto';

export interface PutS3ObjectInput {
  bucket: string;
  key: string;
  body: Buffer;
  contentType?: string;
}

interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

function resolveCredentials(): S3Credentials {
  const accessKeyId =
    process.env['BACKUP_S3_ACCESS_KEY_ID'] ?? process.env['AWS_ACCESS_KEY_ID'] ?? '';
  const secretAccessKey =
    process.env['BACKUP_S3_SECRET_ACCESS_KEY'] ?? process.env['AWS_SECRET_ACCESS_KEY'] ?? '';
  const sessionToken = process.env['AWS_SESSION_TOKEN'];
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'S3 backup destination configured but AWS credentials are not set. Set BACKUP_S3_ACCESS_KEY_ID / BACKUP_S3_SECRET_ACCESS_KEY or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY.',
    );
  }
  return sessionToken ? { accessKeyId, secretAccessKey, sessionToken } : { accessKeyId, secretAccessKey };
}

function resolveRegion(): string {
  const region =
    process.env['BACKUP_S3_REGION'] ?? process.env['AWS_REGION'] ?? process.env['AWS_DEFAULT_REGION'];
  if (!region) {
    throw new Error(
      'S3 backup destination configured but AWS region is not set. Set BACKUP_S3_REGION or AWS_REGION.',
    );
  }
  return region;
}

function resolveEndpoint(bucket: string, region: string): { host: string; baseUrl: string } {
  const override = process.env['BACKUP_S3_ENDPOINT'];
  if (override) {
    // path-style for custom endpoints (MinIO, Cloudflare R2, Wasabi).
    const base = override.replace(/\/+$/, '');
    const host = new URL(base).host;
    return { host, baseUrl: `${base}/${bucket}` };
  }
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  return { host, baseUrl: `https://${host}` };
}

function sha256Hex(input: Buffer | string): string {
  return createHash('sha256').update(input).digest('hex');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function amzDate(now: Date = new Date()): { amz: string; date: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amz: iso, date: iso.slice(0, 8) };
}

function uriEncode(input: string, encodeSlash = true): string {
  return input
    .split('')
    .map((ch) => {
      if (/[A-Za-z0-9\-._~]/.test(ch)) return ch;
      if (ch === '/' && !encodeSlash) return ch;
      return encodeURIComponent(ch)
        .replace(/!/g, '%21')
        .replace(/'/g, '%27')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29')
        .replace(/\*/g, '%2A');
    })
    .join('');
}

export async function putS3Object(input: PutS3ObjectInput): Promise<void> {
  const creds = resolveCredentials();
  const region = resolveRegion();
  const { host, baseUrl } = resolveEndpoint(input.bucket, region);

  const encodedKey = uriEncode(input.key, false);
  const canonicalUri = `/${encodedKey}`;
  const contentType = input.contentType ?? 'application/octet-stream';
  const payloadHash = sha256Hex(input.body);
  const { amz, date } = amzDate();

  const headers: Record<string, string> = {
    host,
    'content-length': String(input.body.byteLength),
    'content-type': contentType,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amz,
  };
  if (creds.sessionToken) headers['x-amz-security-token'] = creds.sessionToken;

  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames.map((h) => `${h}:${headers[h]}\n`).join('');
  const signedHeaders = signedHeaderNames.join(';');

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '', // no query string
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${date}/${region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amz,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`AWS4${creds.secretAccessKey}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hmac(kSigning, stringToSign).toString('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const putUrl = `${baseUrl.replace(/\/$/, '')}/${encodedKey}`;
  // Node's Buffer widened its type to `Buffer<ArrayBufferLike>` in recent
  // @types/node, which breaks assignment to both `BodyInit` and
  // `BlobPart`. Copy into a fresh Uint8Array backed by a plain ArrayBuffer
  // so the fetch body type resolves unambiguously to BodyInit.
  const bodyBuf = input.body;
  const bodyBytes = new Uint8Array(bodyBuf.byteLength);
  bodyBytes.set(bodyBuf);
  const res = await fetch(putUrl, {
    method: 'PUT',
    headers: { ...headers, Authorization: authorization },
    body: bodyBytes,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`S3 PutObject failed: ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 500)}` : ''}`);
  }
}
