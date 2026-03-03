import type { Session } from "next-auth";

export function requireAdmin(session: Session | null): void {
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }
  if (session.user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
}
