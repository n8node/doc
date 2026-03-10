/**
 * Расчёт стоимости в копейках по токенам.
 * Упрощённая формула: 1₽/1M input, 3₽/1M output.
 */
export function calculateCostCents(tokensIn: number, tokensOut: number): number {
  const inputCents = (tokensIn / 1_000_000) * 100; // 100 копеек = 1₽ за 1M
  const outputCents = (tokensOut / 1_000_000) * 300; // 3₽ за 1M
  return Math.max(1, Math.ceil(inputCents + outputCents));
}
