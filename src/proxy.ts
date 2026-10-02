import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Coarse route gating (login required, owner vs tenant areas).
// Every page, server action and file route re-checks authorization server-side.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|brand|icon.png|apple-icon.png|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
