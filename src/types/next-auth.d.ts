import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: "OWNER" | "TENANT";
  }
  interface Session {
    user: {
      id: string;
      role: "OWNER" | "TENANT";
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: "OWNER" | "TENANT";
  }
}
