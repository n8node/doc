import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";

const YOOKASSA_ME_URL = "https://api.yookassa.ru/v3/me";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { shopId, secretKey } = body;

  let useShopId: string;
  let useSecretKey: string;

  if (shopId && secretKey && secretKey !== "••••••••") {
    useShopId = String(shopId).trim();
    useSecretKey = String(secretKey).trim();
  } else {
    const [storedShopId, storedSecretKey] = await Promise.all([
      configStore.get("yookassa.shop_id"),
      configStore.get("yookassa.secret_key"),
    ]);
    if (!storedShopId || !storedSecretKey) {
      return NextResponse.json(
        { ok: false, message: "Укажите Shop ID и секретный ключ (или сохраните настройки)" },
        { status: 400 }
      );
    }
    useShopId = storedShopId;
    useSecretKey = storedSecretKey;
  }

  const auth = Buffer.from(`${useShopId}:${useSecretKey}`, "utf8").toString("base64");

  try {
    const res = await fetch(YOOKASSA_ME_URL, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data?.description || data?.message || `HTTP ${res.status}`;
      return NextResponse.json(
        { ok: false, message: errMsg },
        { status: 400 }
      );
    }

    const accountId = data?.account_id ?? useShopId;
    const status = data?.status ?? "enabled";

    return NextResponse.json({
      ok: true,
      message: "Подключение успешно!",
      accountId: String(accountId),
      status: String(status),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
    return NextResponse.json(
      { ok: false, message: msg },
      { status: 400 }
    );
  }
}
