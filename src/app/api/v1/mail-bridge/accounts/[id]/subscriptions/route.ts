import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMailBridgeSessionUserId } from "@/lib/mail-bridge/session";
import { listYandexMailFolders } from "@/lib/mail-bridge/list-folders";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getMailBridgeSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;

  const account = await prisma.mailBridgeAccount.findFirst({
    where: { id, userId },
  });
  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { folderPaths?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const paths = Array.from(
    new Set(
      Array.isArray(body.folderPaths)
        ? body.folderPaths.filter((x): x is string => typeof x === "string" && x.length > 0)
        : [],
    ),
  );

  if (paths.length === 0) {
    return NextResponse.json({ error: "Выберите хотя бы одну папку" }, { status: 400 });
  }

  const remote = await listYandexMailFolders(account.encryptedCredentials);
  if (!remote.ok) {
    return NextResponse.json({ error: remote.error ?? "Не удалось получить список папок" }, { status: 400 });
  }

  const valid = new Set(remote.folders.map((f) => f.path));
  for (const p of paths) {
    if (!valid.has(p)) {
      return NextResponse.json({ error: `Неизвестная папка: ${p}` }, { status: 400 });
    }
  }

  const byPath = new Map(remote.folders.map((f) => [f.path, f] as const));

  await prisma.$transaction(async (tx) => {
    await tx.mailBridgeFolderSubscription.deleteMany({
      where: { accountId: account.id },
    });

    for (const p of paths) {
      const meta = byPath.get(p);
      await tx.mailBridgeFolderSubscription.create({
        data: {
          accountId: account.id,
          folderPath: p,
          displayName: meta?.name ?? p,
          enabled: true,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
