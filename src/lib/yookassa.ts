import { configStore } from "./config-store";
import { getPublicBaseUrl } from "./app-url";

export interface YookassaConfig {
  shopId: string;
  secretKey: string;
  returnUrl: string;
  enabled: boolean;
}

export async function getYookassaConfig(): Promise<YookassaConfig | null> {
  const [shopId, secretKey, returnUrl, enabled] = await Promise.all([
    configStore.get("yookassa.shop_id"),
    configStore.get("yookassa.secret_key"),
    configStore.get("yookassa.return_url"),
    configStore.get("yookassa.enabled"),
  ]);

  if (!shopId || !secretKey || enabled !== "true") {
    return null;
  }

  return {
    shopId,
    secretKey,
    returnUrl: returnUrl || `${getPublicBaseUrl()}/dashboard/plans`,
    enabled: true,
  };
}

const YOOKASSA_PAYMENTS_URL = "https://api.yookassa.ru/v3/payments";

export async function createYookassaPayment(params: {
  amount: number;
  description: string;
  returnUrl: string;
  metadata: Record<string, string>;
  config: YookassaConfig;
  idempotenceKey: string;
}): Promise<{ confirmationUrl: string; paymentId: string } | { error: string }> {
  const { amount, description, returnUrl, metadata, config, idempotenceKey } = params;

  const auth = Buffer.from(`${config.shopId}:${config.secretKey}`, "utf8").toString("base64");

  const body = {
    amount: {
      value: amount.toFixed(2),
      currency: "RUB",
    },
    capture: true,
    description,
    confirmation: {
      type: "redirect",
      return_url: returnUrl,
    },
    metadata,
  };

  try {
    const res = await fetch(YOOKASSA_PAYMENTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        "Idempotence-Key": idempotenceKey,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data?.description || data?.message || `HTTP ${res.status}`;
      return { error: errMsg };
    }

    const confirmationUrl = data?.confirmation?.confirmation_url;
    const paymentId = data?.id;

    if (!confirmationUrl || !paymentId) {
      return { error: "Некорректный ответ от ЮKassa" };
    }

    return { confirmationUrl, paymentId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
    return { error: msg };
  }
}
