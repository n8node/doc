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

/** Ставка НДС для чека (1 = без НДС). См. справочник ЮKassa. */
const DEFAULT_RECEIPT_VAT_CODE = 1;

function truncateReceiptDescription(text: string, maxLen = 128): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

/**
 * Чек 54‑ФЗ в теле платежа. При включённых чеках в ЮKassa без него — «Receipt is missing or illegal».
 */
async function buildReceiptPayload(params: {
  amountRub: number;
  itemDescription: string;
  customerEmail: string;
}): Promise<Record<string, unknown>> {
  const vatRaw = await configStore.get("yookassa.receipt_vat_code");
  const vatParsed = parseInt(String(vatRaw ?? DEFAULT_RECEIPT_VAT_CODE), 10);
  const vatCode =
    Number.isFinite(vatParsed) && vatParsed >= 1 && vatParsed <= 6
      ? vatParsed
      : DEFAULT_RECEIPT_VAT_CODE;

  const value = params.amountRub.toFixed(2);
  const receipt: Record<string, unknown> = {
    customer: {
      email: params.customerEmail.trim(),
    },
    items: [
      {
        description: truncateReceiptDescription(params.itemDescription),
        quantity: "1",
        amount: {
          value,
          currency: "RUB",
        },
        vat_code: vatCode,
        payment_mode: "full_payment",
        payment_subject: "service",
      },
    ],
  };

  const taxSystemRaw = await configStore.get("yookassa.tax_system_code");
  if (taxSystemRaw != null && String(taxSystemRaw).trim() !== "") {
    const t = parseInt(String(taxSystemRaw).trim(), 10);
    if (Number.isFinite(t) && t >= 1 && t <= 6) {
      receipt.tax_system_code = t;
    }
  }

  return receipt;
}

export async function createYookassaPayment(params: {
  amount: number;
  description: string;
  returnUrl: string;
  metadata: Record<string, string>;
  config: YookassaConfig;
  idempotenceKey: string;
  /** Email для фискального чека (54‑ФЗ). */
  customerEmail: string;
}): Promise<{ confirmationUrl: string; paymentId: string } | { error: string }> {
  const { amount, description, returnUrl, metadata, config, idempotenceKey, customerEmail } =
    params;

  if (!customerEmail?.trim()) {
    return { error: "Для оплаты нужен email в профиле (для чека 54‑ФЗ)." };
  }

  const auth = Buffer.from(`${config.shopId}:${config.secretKey}`, "utf8").toString("base64");

  const receipt = await buildReceiptPayload({
    amountRub: amount,
    itemDescription: description,
    customerEmail,
  });

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
    receipt,
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
