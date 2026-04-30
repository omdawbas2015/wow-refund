import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { auth } from './auth-edge';

const intlMiddleware = createMiddleware(routing);

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/set-password',
  '/reset-password',
];

function stripLocale(pathname: string): string {
  if (pathname === '/en') return '/';
  if (pathname.startsWith('/en/')) return pathname.slice(3);
  return pathname;
}

export default async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const intlResponse = intlMiddleware(req);

  const cleanPath = stripLocale(pathname);
  const isPublic = PUBLIC_PATHS.some((p) => cleanPath === p || cleanPath.startsWith(`${p}/`));

  const session = await auth();

  if (!session?.user) {
    if (!isPublic) {
      const loginUrl = new URL('/login', req.nextUrl.origin);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return intlResponse;
  }

  if (session.user.mustChangePassword && cleanPath !== '/set-password') {
    return NextResponse.redirect(new URL('/set-password', req.nextUrl.origin));
  }

  if (isPublic && cleanPath !== '/set-password') {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin));
  }

  return intlResponse;
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
