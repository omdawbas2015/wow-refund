import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // 'standalone' emits .next/standalone with a minimal node_modules tree
  // and a self-contained server.js — required for the Docker / K8s
  // image to stay slim (~150MB vs ~1.5GB with the full pnpm store).
  output: 'standalone',
  // Lint runs separately via `pnpm lint`; don't fail the production
  // build on legacy ESLint warnings (escaped quotes, <a> vs <Link>, etc.)
  // — those should be tracked as a cleanup task, not a deploy blocker.
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ['@wow/ui', '@wow/validators', '@wow/db'],
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  experimental: {
    typedRoutes: false,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.githubusercontent.com' },
      { protocol: 'https', hostname: 'flagcdn.com' },
    ],
  },
};

const intlConfig = withNextIntl(nextConfig);

// Wrap with Sentry only when an auth token is configured — that's the signal
// that the build host should upload source maps. Local / preview builds
// still emit the runtime SDK (which is a no-op when SENTRY_DSN is unset),
// they just don't hit the Sentry API.
const shouldUploadSourceMaps = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT,
);

export default shouldUploadSourceMaps
  ? withSentryConfig(intlConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      hideSourceMaps: true,
      disableLogger: true,
      telemetry: false,
    })
  : intlConfig;
