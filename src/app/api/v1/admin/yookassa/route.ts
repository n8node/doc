import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [shopId, secretKey, returnUrl, enabled] = await Promise.all([
    configStore.get("yookassa.shop_id"),
    configStore.get("yookassa.secret_key"),
    configStore.get("yookassa.return_url"),
    configStore.get("yookassa.enabled"),
  ]);

  return NextResponse.json({
    shopId: shopId ?? "",
    secretKeySet: !!secretKey,
    returnUrl: returnUrl ?? "https://qoqon.ru/dashboard/plans",
    enabled: enabled !== "false",
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { shopId, secretKey, returnUrl, enabled } = body;

  if (!shopId || typeof shopId !== "string") {
    return NextResponse.json(
      { error: "Обязательно: shopId" },
      { status: 400 }
    );
  }

  const defReturnUrl = "https://qoqon.ru/dashboard/plans";

  const updates: Promise<void>[] = [
    configStore.set("yookassa.shop_id", String(shopId).trim(), {
      category: "payments",
      description: "YooKassa Shop ID",
    }),
    configStore.set("yookassa.return_url", returnUrl && typeof returnUrl === "string" ? String(returnUrl).trim() : defReturnUrl, {
      category: "payments",
      description: "URL vozvrata posle oplaty",
    }),
    configStore.set("yookassa.enabled", enabled === true || enabled === "true" ? "true" : "false", {
      category: "payments",
      description: "Vkljuchen priem platezhej",
    }),
  ];

  if (secretKey && typeof secretKey === "string" && secretKey.trim() && secretKey !== "••••••••" && secretKey !== "********") {
    updates.push(
      configStore.set("yookassa.secret_key", secretKey.trim(), {
        isEncrypted: true,
        category: "payments",
        description: "YooKassa secret key",
      })
    );
  }

  await Promise.all(updates);

  configStore.invalidate("yookassa.shop_id");
  configStore.invalidate("yookassa.secret_key");
  configStore.invalidate("yookassa.return_url");
  configStore.invalidate("yookassa.enabled");

  return NextResponse.json({ ok: true });
}
