import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { getEmbeddingsForCollection } from "@/lib/docling/vector-store";
import { isN8nDbEnabled, getN8nDbConnectionParams } from "@/lib/n8n-db/client";
import { createN8nConnection, hashN8nPassword } from "@/lib/n8n-db/service";
import { nanoid } from "nanoid";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: collectionId } = await ctx.params;

  const collection = await prisma.vectorCollection.findFirst({
    where: { id: collectionId, userId },
    include: { n8nPgConnections: { orderBy: { createdAt: "desc" } } },
  });

  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  const connections = collection.n8nPgConnections.map((c) => ({
    id: c.id,
    dbRoleName: c.dbRoleName,
    viewName: c.viewName,
    createdAt: c.createdAt.toISOString(),
  }));

  return NextResponse.json({
    connections,
    n8nDbEnabled: isN8nDbEnabled(),
    connectionParams: getN8nDbConnectionParams(),
  });
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isN8nDbEnabled()) {
    return NextResponse.json(
      { error: "Подключение n8n не настроено на сервере" },
      { status: 503 }
    );
  }

  const { id: collectionId } = await ctx.params;

  const collection = await prisma.vectorCollection.findFirst({
    where: { id: collectionId, userId },
    include: { files: { select: { fileId: true } } },
  });

  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  const fileIds = collection.files.map((f) => f.fileId);
  const embeddings = await getEmbeddingsForCollection(collectionId, fileIds);

  if (embeddings.length === 0) {
    return NextResponse.json(
      { error: "В коллекции нет эмбеддингов. Сначала векторизуйте файлы." },
      { status: 400 }
    );
  }

  const connectionId = nanoid(16);

  try {
    const result = await createN8nConnection(
      connectionId,
      collectionId,
      embeddings
    );

    const passwordHash = await hashN8nPassword(result.dbPassword);

    await prisma.n8nPgConnection.create({
      data: {
        id: connectionId,
        userId,
        collectionId,
        dbRoleName: result.dbRoleName,
        dbPasswordHash: passwordHash,
        viewName: result.viewName,
      },
    });

    const params = getN8nDbConnectionParams();

    return NextResponse.json({
      connectionId: result.connectionId,
      dbRoleName: result.dbRoleName,
      dbPassword: result.dbPassword,
      viewName: result.viewName,
      host: params?.host ?? "",
      port: params?.port ?? 5432,
      database: params?.database ?? "",
      ssl: params?.ssl ?? true,
    });
  } catch (err) {
    console.error("[n8n-connections] Create error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Ошибка создания подключения",
      },
      { status: 500 }
    );
  }
}
