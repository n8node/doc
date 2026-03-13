import { Prisma, TokenUsageCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Quotas = Record<TokenUsageCategory, number | null>;

export function estimateTokensFromText(
  textOrLength: string | number,
  options?: { charsPerToken?: number; min?: number; extra?: number },
): number {
  const length =
    typeof textOrLength === "number" ? textOrLength : textOrLength.length;
  const charsPerToken = options?.charsPerToken ?? 4;
  const min = options?.min ?? 1;
  const extra = options?.extra ?? 0;
  return Math.max(min, Math.ceil(length / charsPerToken) + extra);
}

export class TokenQuotaExceededError extends Error {
  category: TokenUsageCategory;
  quota: number;
  used: number;
  requested: number;

  constructor(params: {
    category: TokenUsageCategory;
    quota: number;
    used: number;
    requested: number;
  }) {
    super("TOKEN_QUOTA_EXCEEDED");
    this.category = params.category;
    this.quota = params.quota;
    this.used = params.used;
    this.requested = params.requested;
  }
}

function daysInMonthUtc(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addMonthsClamped(anchor: Date, months: number): Date {
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth() + months;
  const targetYear = y + Math.floor(m / 12);
  const targetMonth = ((m % 12) + 12) % 12;
  const day = Math.min(anchor.getUTCDate(), daysInMonthUtc(targetYear, targetMonth));
  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      day,
      anchor.getUTCHours(),
      anchor.getUTCMinutes(),
      anchor.getUTCSeconds(),
      anchor.getUTCMilliseconds(),
    ),
  );
}

function computeCycleRange(anchor: Date, now = new Date()) {
  let start = anchor;
  let next = addMonthsClamped(start, 1);
  while (next <= now) {
    start = next;
    next = addMonthsClamped(start, 1);
  }
  return { cycleStart: start, cycleEnd: next };
}

function emptyUsageByCategory(): Record<TokenUsageCategory, number> {
  return {
    CHAT_DOCUMENT: 0,
    SEARCH: 0,
    EMBEDDING: 0,
    TRANSCRIPTION: 0,
  };
}

export async function getUserBillingContext(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      createdAt: true,
      plan: {
        select: {
          id: true,
          name: true,
          isFree: true,
          chatTokensQuota: true,
          searchTokensQuota: true,
          embeddingTokensQuota: true,
        },
      },
    },
  });
  if (!user) return null;

  const lastSucceededPayment = await prisma.payment.findFirst({
    where: { userId, status: "succeeded" },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    select: { paidAt: true, createdAt: true },
  });

  const usesFreeAnchor = !user.plan || user.plan.isFree || !lastSucceededPayment;
  const anchor = usesFreeAnchor
    ? user.createdAt
    : (lastSucceededPayment.paidAt ?? lastSucceededPayment.createdAt);
  const { cycleStart, cycleEnd } = computeCycleRange(anchor);

  return {
    userId: user.id,
    plan: user.plan,
    anchorType: usesFreeAnchor ? "registration" : "last_payment",
    anchorDate: anchor,
    cycleStart,
    cycleEnd,
  };
}

export function getPlanTokenQuotas(plan: {
  chatTokensQuota?: number | null;
  searchTokensQuota?: number | null;
  embeddingTokensQuota?: number | null;
} | null): Quotas {
  return {
    CHAT_DOCUMENT: plan?.chatTokensQuota ?? null,
    SEARCH: plan?.searchTokensQuota ?? null,
    EMBEDDING: plan?.embeddingTokensQuota ?? null,
    TRANSCRIPTION: null, // квота транскрибации — по минутам, не по токенам
  };
}

/** Сумма квот по токенам (CHAT, SEARCH, EMBEDDING). TRANSCRIPTION исключён — квота по минутам. */
export function getTotalQuota(quotas: Quotas): number | null {
  const tokenCategories = ["CHAT_DOCUMENT", "SEARCH", "EMBEDDING"] as const;
  const values = tokenCategories.map((k) => quotas[k]);
  if (values.some((v) => v == null)) return null;
  return (values as number[]).reduce((sum, v) => sum + v, 0);
}

export async function getTokenUsageSummary(
  userId: string,
  options?: {
    since?: Date;
    includeNonBillable?: boolean;
  },
) {
  const where: Prisma.TokenUsageEventWhereInput = {
    userId,
    ...(options?.since ? { createdAt: { gte: options.since } } : {}),
    ...(options?.includeNonBillable ? {} : { isBillable: true }),
  };

  const [grouped, aggregate] = await Promise.all([
    prisma.tokenUsageEvent.groupBy({
      by: ["category"],
      where,
      _sum: { tokensTotal: true, tokensIn: true, tokensOut: true },
      _count: { _all: true },
    }),
    prisma.tokenUsageEvent.aggregate({
      where,
      _sum: { tokensTotal: true, tokensIn: true, tokensOut: true },
      _count: { _all: true },
    }),
  ]);

  const byCategory = emptyUsageByCategory();
  const byCategoryCount = emptyUsageByCategory();
  for (const row of grouped) {
    byCategory[row.category] = row._sum.tokensTotal ?? 0;
    byCategoryCount[row.category] = row._count._all;
  }

  return {
    totalTokens: aggregate._sum.tokensTotal ?? 0,
    totalTokensIn: aggregate._sum.tokensIn ?? 0,
    totalTokensOut: aggregate._sum.tokensOut ?? 0,
    totalEvents: aggregate._count._all,
    byCategory,
    byCategoryCount,
  };
}

export async function assertTokenQuotaAvailable(params: {
  userId: string;
  category: TokenUsageCategory;
  estimatedTokens: number;
}) {
  const estimated = Math.max(0, Math.ceil(params.estimatedTokens));
  if (estimated <= 0) return;

  const billing = await getUserBillingContext(params.userId);
  if (!billing) return;

  const quotas = getPlanTokenQuotas(billing.plan);
  const quota = quotas[params.category];
  if (quota == null) return;

  const usage = await getTokenUsageSummary(params.userId, {
    since: billing.cycleStart,
    includeNonBillable: false,
  });
  const used = usage.byCategory[params.category] ?? 0;
  if (used + estimated > quota) {
    throw new TokenQuotaExceededError({
      category: params.category,
      quota,
      used,
      requested: estimated,
    });
  }
}

export async function getCategoryQuotaState(params: {
  userId: string;
  category: TokenUsageCategory;
}) {
  const billing = await getUserBillingContext(params.userId);
  if (!billing) {
    return {
      hasQuota: false,
      quota: null as number | null,
      used: 0,
      cycleStart: null as Date | null,
      cycleEnd: null as Date | null,
    };
  }

  const quota = getPlanTokenQuotas(billing.plan)[params.category];
  if (quota == null) {
    return {
      hasQuota: false,
      quota: null as number | null,
      used: 0,
      cycleStart: billing.cycleStart,
      cycleEnd: billing.cycleEnd,
    };
  }

  const usage = await getTokenUsageSummary(params.userId, {
    since: billing.cycleStart,
    includeNonBillable: false,
  });

  return {
    hasQuota: true,
    quota,
    used: usage.byCategory[params.category] ?? 0,
    cycleStart: billing.cycleStart,
    cycleEnd: billing.cycleEnd,
  };
}

export async function recordTokenUsageEvent(params: {
  userId: string;
  category: TokenUsageCategory;
  sourceType: string;
  sourceId?: string | null;
  tokensIn?: number;
  tokensOut?: number;
  tokensTotal?: number;
  provider?: string | null;
  model?: string | null;
  isBillable?: boolean;
  metadata?: Prisma.JsonValue;
}) {
  const tokensIn = Math.max(0, Math.floor(params.tokensIn ?? 0));
  const tokensOut = Math.max(0, Math.floor(params.tokensOut ?? 0));
  const computedTotal = Math.max(0, tokensIn + tokensOut);
  const tokensTotal = Math.max(
    computedTotal,
    Math.max(0, Math.floor(params.tokensTotal ?? computedTotal)),
  );
  if (tokensTotal <= 0) return null;

  return prisma.tokenUsageEvent.create({
    data: {
      userId: params.userId,
      category: params.category,
      sourceType: params.sourceType,
      sourceId: params.sourceId ?? null,
      tokensIn,
      tokensOut,
      tokensTotal,
      provider: params.provider ?? null,
      model: params.model ?? null,
      isBillable: params.isBillable ?? true,
      metadata:
        params.metadata === undefined
          ? undefined
          : (params.metadata as Prisma.InputJsonValue),
    },
  });
}
