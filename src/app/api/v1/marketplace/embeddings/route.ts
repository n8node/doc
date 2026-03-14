import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getUserIdFromLlmKey } from "@/lib/llm-api-key-auth";
import { getOpenRouterApiKey } from "@/lib/marketplace/get-openrouter-key";
import { getMarketplaceMarginPercent, applyMargin, getBilledTokens } from "@/lib/marketplace/margin";
import { prisma } from "@/lib/prisma";
import { getBaseCostCents } from "@/lib/marketplace/provider-cost";
import { parseUsageTokens } from "@/lib/marketplace/usage";
import { getPublicBaseUrl } from "@/lib/app-url";

const OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";

/**
 * POST /api/v1/marketplace/embeddings
 * Proxy к OpenRouter. Требует Bearer QoQon_LLM_xxx
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;

  if (!token || !token.startsWith("QoQon_LLM_")) {
    return NextResponse.json(
      { error: "Требуется API-ключ LLM маркетплейса (Authorization: Bearer QoQon_LLM_xxx)" },
      { status: 401 }
    );
  }

  const userId = await getUserIdFromLlmKey(token);
  if (!userId) {
    return NextResponse.json({ error: "Недействительный API-ключ" }, { status: 401 });
  }

  const openRouterKey = await getOpenRouterApiKey();
  if (!openRouterKey) {
    return NextResponse.json(
      { error: "Сервис временно недоступен. Обратитесь к администратору." },
      { status: 503 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { llmWalletBalanceCents: true },
  });
  const balance = user?.llmWalletBalanceCents ?? 0;
  if (balance < 10) {
    return NextResponse.json(
      { error: "Недостаточно средств. Пополните баланс в личном кабинете." },
      { status: 402 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const baseUrl = getPublicBaseUrl();
  const res = await fetch(OPENROUTER_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": baseUrl,
      "X-Title": "QoQon LLM Marketplace",
    },
    body: JSON.stringify(body),
  });

  const resBody = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(resBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Invalid response from provider" },
      { status: 502 }
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      data?.error ?? { message: resBody },
      { status: res.status }
    );
  }

  const usage = data.usage as Record<string, unknown> | undefined;
  const { tokensIn, tokensOut } = parseUsageTokens(usage);
  const model = (typeof (data.model ?? (body as Record<string, unknown>).model) === "string"
    ? (data.model ?? (body as Record<string, unknown>).model)
    : "") as string || "unknown";

  if (tokensIn > 0) {
    const { baseCostCents, costUsd } = await getBaseCostCents(data, tokensIn, tokensOut);
    const marginPercent = await getMarketplaceMarginPercent();
    const costCents = applyMargin(baseCostCents, marginPercent);
    const metadata: Record<string, unknown> = {
      provider: "openrouter",
      billedTokens: getBilledTokens(tokensIn + tokensOut, marginPercent),
    };
    if (costUsd != null) metadata.costUsd = costUsd;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { llmWalletBalanceCents: { decrement: costCents } },
      }),
      prisma.marketplaceUsageEvent.create({
        data: {
          userId,
          category: "embeddings",
          model,
          tokensIn,
          tokensOut,
          costCents,
          metadata: metadata as Prisma.InputJsonValue,
        },
      }),
    ]);
  }

  return new NextResponse(resBody, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/json",
    },
  });
}
