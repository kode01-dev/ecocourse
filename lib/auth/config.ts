import type { NextAuthConfig } from 'next-auth';

// Edge-safe config (no DB / no bcrypt). Imported by middleware + auth.ts.
export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup');
      const isPublic = pathname === '/' || isAuthPage;
      if (!isLoggedIn && !isPublic) {
        const url = new URL('/login', request.nextUrl);
        return Response.redirect(url);
      }
      if (isLoggedIn && isAuthPage) {
        const url = new URL('/home', request.nextUrl);
        return Response.redirect(url);
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
