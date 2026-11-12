import NextAuth from "next-auth";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { authConfig } from "./auth.config";

// Auth.js's request gate: reads the session, applies the owner/tenant rules in authConfig.callbacks.authorized,
// and re-attaches the current (refreshed) session cookie to the response.
const authGate = NextAuth(authConfig).auth as unknown as (request: NextRequest, event: NextFetchEvent) => Promise<Response>;

/**
 * Coarse route gating (login required, owner vs tenant areas) for page loads.
 * Every page, server action and file route re-checks authorization server-side.
 *
 * Form submissions (Server Functions are POSTs to the page they are used on) skip the gate: Auth.js would
 * re-attach the CURRENT session cookie to the very response in which sign-in or sign-out sets a new one.
 * On Netlify that stale cookie won, so signing out - or signing in as someone else - kept the previous
 * user signed in. Server actions check permissions themselves (assertOwner / assertTenant / getSessionUser).
 */
export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (request.method !== "GET" && request.method !== "HEAD") return NextResponse.next();
  return authGate(request, event);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|brand|icon.png|apple-icon.png|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
