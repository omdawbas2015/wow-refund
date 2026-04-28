import type { NextAuthConfig, DefaultSession } from 'next-auth';

/**
 * Edge-compatible Auth.js config.
 * This is imported by the middleware (which runs on the Edge Runtime).
 * It must NOT import anything that pulls in Prisma, bcrypt, or Node-only APIs.
 *
 * The full config (with Prisma adapter + credentials provider) lives in `./auth.ts`.
 */

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      email: string;
      name: string;
      role?: string | null;
      status: string;
      mustChangePassword: boolean;
      preferredLocale: string;
    } & DefaultSession['user'];
  }

  interface User {
    role?: string | null;
    status: string;
    mustChangePassword: boolean;
    preferredLocale: string;
  }
}

const IS_PROD = process.env['NODE_ENV'] === 'production';

export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 }, // 8h
  trustHost: true,
  // Explicit cookie hardening. NextAuth's defaults are already secure
  // when NEXTAUTH_URL is https, but making them explicit documents the
  // security contract and protects against misconfiguration.
  //   - httpOnly:  JS can't read the cookie, mitigates XSS session theft.
  //   - sameSite=lax: not sent on cross-site POSTs, mitigates CSRF on
  //     state-changing endpoints. 'lax' (not 'strict') so top-level
  //     navigations to /login from email links still authenticate.
  //   - secure in prod: cookie only travels over HTTPS. Dev over http
  //     keeps secure=false so the cookie actually gets set.
  cookies: {
    sessionToken: {
      name: IS_PROD ? '__Secure-authjs.session-token' : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: IS_PROD,
      },
    },
    csrfToken: {
      name: IS_PROD ? '__Host-authjs.csrf-token' : 'authjs.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: IS_PROD,
      },
    },
    callbackUrl: {
      name: IS_PROD ? '__Secure-authjs.callback-url' : 'authjs.callback-url',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: IS_PROD,
      },
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [], // populated in ./auth.ts
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role ?? null;
        token.status = user.status;
        token.mustChangePassword = user.mustChangePassword;
        token.preferredLocale = user.preferredLocale;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = (token.id as string) ?? '';
        session.user.role = (token.role as string | null) ?? null;
        session.user.status = (token.status as string) ?? 'ACTIVE';
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
        session.user.preferredLocale = (token.preferredLocale as string) ?? 'en';
      }
      return session;
    },
  },
};
