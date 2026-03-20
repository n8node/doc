import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProviderForUser } from "@/lib/ai/get-provider-for-user";
import {
  estimateTokensFromText,
  getCategoryQuotaState,
  recordTokenUsageEvent,
  TokenQuotaExceededError,
} from "@/lib/ai/token-usage";
import type { WebImportPageRow } from "@/lib/web-import/process-job";

type AiMode = "explain" | "contacts";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const jobId = typeof b.jobId === "string" ? b.jobId : "";
  const pageId = typeof b.pageId === "string" ? b.pageId : null;
  const mode = (typeof b.mode === "string" ? b.mode : "explain") as AiMode;

  if (!jobId) {
    return NextResponse.json({ error: "Укажите jobId" }, { status: 400 });
  }

  try {
    const job = await prisma.webImportJob.findFirst({
      where: { id: jobId, userId: session.user.id },
    });

    if (!job) {
      return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
    }

    const pages = job.pages as unknown as WebImportPageRow[];
    const page =
      pageId && pages.length
        ? pages.find((p) => p.id === pageId)
        : pages.find((p) => p.markdown && p.status === "done");

    const text = page?.markdown?.trim() ?? "";
    if (!text) {
      return NextResponse.json(
        { error: "Нет текста страницы. Дождитесь завершения импорта." },
        { status: 400 },
      );
    }

    const active = await getProviderForUser(session.user.id);
    if (!active) {
      return NextResponse.json(
        { error: "AI-провайдер не настроен. Обратитесь к администратору." },
        { status: 503 },
      );
    }

    const truncated = text.slice(0, 24_000);
    const userPrompt =
      mode === "contacts"
        ? `На основе следующего текста с веб-страницы извлеки контактные данные: телефоны, email, адрес, ссылки на соцсети, формы обратной связи. Если чего-то нет — не выдумывай. Ответ структурируй списком или короткими абзацами.\n\n---\n\n${truncated}`
        : `Кратко объясни суть следующего текста (статьи/страницы). 5–10 предложений на русском. Не выдумывай факты, опирайся только на текст.\n\n---\n\n${truncated}`;

    const chatQuotaState = !active.usedOwnKey
      ? await getCategoryQuotaState({
          userId: session.user.id,
          category: "CHAT_DOCUMENT",
        })
      : null;

    let projectedTokens = chatQuotaState?.used ?? 0;
    if (chatQuotaState?.hasQuota && chatQuotaState.quota != null) {
      const est = estimateTokensFromText(userPrompt, {
        charsPerToken: 3.2,
        min: 64,
        extra: 32,
      });
      projectedTokens += est;
      if (projectedTokens > chatQuotaState.quota) {
        return NextResponse.json(
          {
            error: "Превышена квота токенов чата по документам на этот период.",
          },
          { status: 402 },
        );
      }
    }

    try {
      const result = await active.provider.generateChatCompletion(
        [{ role: "user", content: userPrompt }],
        {
          systemPrompt:
            mode === "contacts"
              ? "Ты помогаешь извлекать контакты из текста веб-страниц. Не придумывай данные."
              : "Ты помогаешь кратко пересказывать содержание текстов с веб-страниц.",
        },
      );

      const usage = result.usage;
      if (usage && (usage.promptTokens > 0 || usage.completionTokens > 0)) {
        await recordTokenUsageEvent({
          userId: session.user.id,
          category: "CHAT_DOCUMENT",
          sourceType: "web_import_ai",
          sourceId: job.id,
          tokensIn: usage.promptTokens,
          tokensOut: usage.completionTokens,
          tokensTotal: usage.totalTokens,
          provider: active.providerName,
          model: result.model ?? null,
          metadata: { mode },
        });
      }

      return NextResponse.json({
        content: result.content,
        pageUrl: page?.url,
        model: result.model,
      });
    } catch (e) {
      if (e instanceof TokenQuotaExceededError) {
        return NextResponse.json({ error: e.message }, { status: 402 });
      }
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Ошибка AI" },
        { status: 500 },
      );
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ошибка" },
      { status: 500 },
    );
  }
}
