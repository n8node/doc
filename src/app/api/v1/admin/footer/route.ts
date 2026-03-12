import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { getFooterConfig, setFooterConfig, type FooterConfig } from "@/lib/footer-config";

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const config = await getFooterConfig();
  return NextResponse.json(config);
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as Partial<FooterConfig>;
  const current = await getFooterConfig();
  const config: FooterConfig = {
    columns: Array.isArray(body.columns) && body.columns.length > 0 ? body.columns : current.columns,
    social: Array.isArray(body.social) ? body.social : current.social,
    copyright:
      typeof body.copyright === "string" && body.copyright.trim()
        ? body.copyright.trim()
        : current.copyright,
  };
  await setFooterConfig(config);
  return NextResponse.json({ ok: true });
}
