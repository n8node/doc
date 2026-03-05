import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { encryptApiKey, maskApiKey, decryptApiKey } from "@/lib/ai/encrypt";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  try { requireAdmin(session); } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const provider = await prisma.aiProvider.findUnique({
    where: { id: params.id },
  });
  if (!provider) {
    return NextResponse.json({ error: "Провайдер не найден" }, { status: 404 });
  }

  return NextResponse.json({
    id: provider.id,
    name: provider.name,
    type: provider.type,
    purpose: provider.purpose,
    baseUrl: provider.baseUrl,
    modelName: provider.modelName,
    chatModelName: provider.chatModelName,
    apiKeyMasked: provider.apiKey ? maskApiKey(decryptApiKey(provider.apiKey)) : null,
    hasApiKey: !!provider.apiKey,
    folderId: provider.folderId,
    isActive: provider.isActive,
    config: provider.config,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  try { requireAdmin(session); } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const provider = await prisma.aiProvider.findUnique({
    where: { id: params.id },
  });
  if (!provider) {
    return NextResponse.json({ error: "Провайдер не найден" }, { status: 404 });
  }

  const body = await request.json();
  const { baseUrl, modelName, chatModelName, apiKey, folderId, isActive, config } = body;

  const data: Record<string, unknown> = {};
  if (baseUrl !== undefined) data.baseUrl = baseUrl || null;
  if (modelName !== undefined) data.modelName = modelName || null;
  if (chatModelName !== undefined) data.chatModelName = chatModelName || null;
  if (folderId !== undefined) data.folderId = folderId || null;
  if (isActive !== undefined) data.isActive = !!isActive;
  if (config !== undefined) data.config = config;
  if (apiKey && typeof apiKey === "string" && apiKey.trim()) {
    data.apiKey = encryptApiKey(apiKey.trim());
  }

  const updated = await prisma.aiProvider.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    type: updated.type,
    isActive: updated.isActive,
    modelName: updated.modelName,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  try { requireAdmin(session); } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const provider = await prisma.aiProvider.findUnique({
    where: { id: params.id },
    include: { _count: { select: { tasks: true } } },
  });
  if (!provider) {
    return NextResponse.json({ error: "Провайдер не найден" }, { status: 404 });
  }
  if (provider._count.tasks > 0) {
    return NextResponse.json(
      { error: `Нельзя удалить: ${provider._count.tasks} связанных задач` },
      { status: 409 },
    );
  }

  await prisma.aiProvider.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
