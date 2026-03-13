import { prisma } from "@/lib/prisma";

const BYTES_PER_GB = 1024 * 1024 * 1024;
const DAYS_PER_MONTH = 30;

/**
 * Конец месяца для даты
 */
function monthEnd(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * Фиксированные расходы, активные на указанный месяц.
 * Активны если sinceAt <= конец месяца (расход уже начался).
 */
export async function getActiveFixedExpensesCents(refDate: Date = new Date()): Promise<number> {
  const endOfMonth = monthEnd(refDate);
  const expenses = await prisma.platformExpense.findMany({
    where: {
      type: "fixed_monthly",
      sinceAt: { lte: endOfMonth },
    },
  });
  return expenses.reduce((s, e) => s + e.amountCents, 0);
}

/**
 * Переменные расходы (variable_per_gb_day) за месяц по объёму хранилища.
 * amountCents = стоимость за 1 ГБ в день (копейки).
 * Итог: amountCents * storageGB * 30 дней.
 */
export async function getVariableStorageExpensesCents(
  totalStorageBytes: number,
  refDate: Date = new Date()
): Promise<{ totalCents: number; items: { category: string; amountCents: number; storageGb: number }[] }> {
  const endOfMonth = monthEnd(refDate);
  const storageGb = totalStorageBytes / BYTES_PER_GB;
  const expenses = await prisma.platformExpense.findMany({
    where: {
      type: "variable_per_gb_day",
      sinceAt: { lte: endOfMonth },
    },
  });
  const items = expenses.map((e) => {
    const amountCents = Math.round(e.amountCents * storageGb * DAYS_PER_MONTH);
    return {
      category: e.category,
      amountCents,
      storageGb,
    };
  });
  const totalCents = items.reduce((s, i) => s + i.amountCents, 0);
  return { totalCents, items };
}

/**
 * Общий объём хранилища (сумма size всех файлов) в байтах
 */
export async function getTotalStorageBytes(): Promise<number> {
  const r = await prisma.file.aggregate({ _sum: { size: true } });
  return Number(r._sum.size ?? 0);
}
