import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { auth } from './auth-edge';
import { generateRequestId, readRequestId, requestIdHeader } from './lib/observability/request-id';

const intlMiddleware = createMiddleware(routing);

function withRequestId(req: NextRequest, res: NextResponse): NextResponse {
  const incoming = readRequestId(req.headers);
  const id = incoming ?? generateRequestId();
  // Mirror the ID on both the inbound request (so route handlers can
  // read it back from headers()) and the outbound response (so clients
  // and upstream proxies can echo it in bug reports).
  res.headers.set(requestIdHeader(), id);
  if (!incoming) {
    // Only patch when we generated the ID; echoing user-supplied values
    // on the request would make spoofing trivial otherwise.
    req.headers.set(requestIdHeader(), id);
  }
  return res;
}

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/set-password',
  '/reset-password',
];

function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return '/';
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname;
}

export default async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Skip most middleware for API routes and assets, but still stamp a
  // request ID on /api responses so route handlers can propagate it.
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return withRequestId(req, NextResponse.next());
  }

  // Run next-intl first to handle locale prefix
  const intlResponse = intlMiddleware(req);

  // Determine if this path is public (auth pages)
  const cleanPath = stripLocale(pathname);
  const isPublic = PUBLIC_PATHS.some((p) => cleanPath === p || cleanPath.startsWith(`${p}/`));

  // Check authentication
  const session = await auth();

  if (!session?.user) {
    if (!isPublic) {
      const loginUrl = new URL('/login', req.nextUrl.origin);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return withRequestId(req, NextResponse.redirect(loginUrl));
    }
    return withRequestId(req, intlResponse);
  }

  // If authenticated user needs to set a password, force them to /set-password
  if (session.user.mustChangePassword && cleanPath !== '/set-password') {
    return withRequestId(req, NextResponse.redirect(new URL('/set-password', req.nextUrl.origin)));
  }

  // If they're authenticated and visit login/signup, bounce to dashboard
  if (isPublic && cleanPath !== '/set-password') {
    return withRequestId(req, NextResponse.redirect(new URL('/', req.nextUrl.origin)));
  }

  return withRequestId(req, intlResponse);
}

export const config = {
  // Include `/api` so the middleware can stamp an x-request-id on every
  // API response. The API branch above short-circuits locale + auth
  // logic so this stays cheap on that path.
  matcher: ['/((?!_next|.*\\..*).*)'],
};
