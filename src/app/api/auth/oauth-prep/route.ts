import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600,
  secure: process.env.NODE_ENV === "production",
};

/**
 * Перед signIn("vk") задаёт cookie с режимом (login | register | link) и опционально инвайт.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const mode = body.mode as string | undefined;
  const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode.trim() : undefined;

  if (mode !== "login" && mode !== "register" && mode !== "link") {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  if (mode === "link") {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set("oauth_vk_link_user", userId, COOKIE_OPTS);
    res.cookies.set("oauth_vk_mode", "link", COOKIE_OPTS);
    res.cookies.delete("oauth_vk_invite");
    return res;
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("oauth_vk_mode", mode, COOKIE_OPTS);
  if (inviteCode) {
    res.cookies.set("oauth_vk_invite", inviteCode, COOKIE_OPTS);
  } else {
    res.cookies.delete("oauth_vk_invite");
  }
  res.cookies.delete("oauth_vk_link_user");
  return res;
}
