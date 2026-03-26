import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { resolveRecipientEmails } from "@/lib/collaborative-share-service";

const MAX_EMAILS = 50;

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const raw = body.emails;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "emails array required" }, { status: 400 });
  }
  const emails = raw
    .filter((e): e is string => typeof e === "string")
    .slice(0, MAX_EMAILS);
  const results = await resolveRecipientEmails(emails);
  return NextResponse.json({ results });
}
