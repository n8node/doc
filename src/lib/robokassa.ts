import crypto from "crypto";
import { configStore } from "./config-store";
import { getPublicBaseUrl } from "./app-url";

const ROBOKASSA_PAY_URL = "https://auth.robokassa.ru/Merchant/Index.aspx";

export interface RobokassaConfig {
  merchantLogin: string;
  password1: string;
  password2: string;
  isTest: boolean;
}

export async function getRobokassaConfig(): Promise<RobokassaConfig | null> {
  const [merchantLogin, password1, password2, isTestRaw] = await Promise.all([
    configStore.get("robokassa.merchant_login"),
    configStore.get("robokassa.password_1"),
    configStore.get("robokassa.password_2"),
    configStore.get("robokassa.is_test"),
  ]);

  if (!merchantLogin?.trim() || !password1 || !password2) {
    return null;
  }

  const isTest =
    isTestRaw === "true" ||
    isTestRaw === "1" ||
    String(isTestRaw).toLowerCase() === "yes";

  return {
    merchantLogin: merchantLogin.trim(),
    password1,
    password2,
    isTest,
  };
}

function md5HexUpper(s: string): string {
  return crypto.createHash("md5").update(s, "utf8").digest("hex").toUpperCase();
}

/** Подпись запроса на оплату (пароль #1). Без Receipt и Shp_*. */
export function robokassaPaymentSignature(params: {
  merchantLogin: string;
  outSum: string;
  invId: number;
  password1: string;
}): string {
  const base = `${params.merchantLogin}:${params.outSum}:${params.invId}:${params.password1}`;
  return md5HexUpper(base);
}

/** Подпись уведомления Result URL (пароль #2). */
export function robokassaResultSignature(params: {
  outSum: string;
  invId: string;
  password2: string;
  shpSorted: string[];
}): string {
  let base = `${params.outSum}:${params.invId}:${params.password2}`;
  for (const part of params.shpSorted) {
    base += `:${part}`;
  }
  return md5HexUpper(base);
}

export function robokassaSignaturesEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a.trim().toUpperCase(), "utf8");
  const bb = Buffer.from(b.trim().toUpperCase(), "utf8");
  if (aa.length !== bb.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

/**
 * Собирает Shp_* из записи параметров (только ключи вида Shp_*), сортирует для подписи.
 * Формат элементов: Shp_key=value
 */
export function robokassaCollectShpForResult(
  entries: Iterable<[string, string]>
): string[] {
  const list: { key: string; value: string }[] = [];
  for (const [rawKey, rawVal] of Array.from(entries)) {
    const key = rawKey.trim();
    if (!/^Shp_/i.test(key)) continue;
    const normKey = key.startsWith("Shp_") ? key : key.replace(/^shp_/i, "Shp_");
    list.push({ key: normKey, value: rawVal });
  }
  list.sort((a, b) => a.key.toLowerCase().localeCompare(b.key.toLowerCase()));
  return list.map((x) => `${x.key}=${x.value}`);
}

export function formatRobokassaOutSum(amountRubInt: number): string {
  return amountRubInt.toFixed(2);
}

/** Сумма из Robokassa (до 6 знаков) в копейках для сравнения с amountCents. */
export function robokassaOutSumToCents(outSum: string): number {
  const n = Number.parseFloat(String(outSum).replace(",", "."));
  if (!Number.isFinite(n)) return -1;
  return Math.round(n * 100);
}

export function buildRobokassaPaymentUrl(params: {
  config: RobokassaConfig;
  outSum: string;
  invId: number;
  description: string;
}): string {
  const signature = robokassaPaymentSignature({
    merchantLogin: params.config.merchantLogin,
    outSum: params.outSum,
    invId: params.invId,
    password1: params.config.password1,
  });

  const u = new URL(ROBOKASSA_PAY_URL);
  u.searchParams.set("MerchantLogin", params.config.merchantLogin);
  u.searchParams.set("OutSum", params.outSum);
  u.searchParams.set("InvId", String(params.invId));
  u.searchParams.set("Description", params.description.slice(0, 100));
  u.searchParams.set("SignatureValue", signature);
  u.searchParams.set("IsTest", params.config.isTest ? "1" : "0");
  u.searchParams.set("Encoding", "utf-8");
  const culture = process.env.ROBOKASSA_CULTURE?.trim();
  if (culture) {
    u.searchParams.set("Culture", culture);
  }
  return u.toString();
}

export function getDefaultRobokassaResultUrl(): string {
  return `${getPublicBaseUrl()}/api/wallet/robokassa/result`;
}
