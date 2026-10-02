import type { NextAuthConfig } from "next-auth";

type AppRole = "OWNER" | "TENANT";

/**
 * Edge-safe half of the Auth.js setup (no database imports). It is shared by
 * the proxy (route gating) and the full config in auth.ts (credentials login).
 */
export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const path = nextUrl.pathname;
      const user = auth?.user;
      const home = (role?: AppRole) => (role === "OWNER" ? "/admin" : "/portal");

      if (path.startsWith("/admin")) {
        if (!user) return false;
        if (user.role !== "OWNER") return Response.redirect(new URL("/portal", nextUrl));
        return true;
      }
      if (path.startsWith("/portal")) {
        if (!user) return false;
        if (user.role !== "TENANT") return Response.redirect(new URL("/admin", nextUrl));
        return true;
      }
      if (path === "/login" && user) {
        return Response.redirect(new URL(home(user.role), nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as AppRole;
      return session;
    },
  },
} satisfies NextAuthConfig;
