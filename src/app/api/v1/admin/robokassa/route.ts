import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";
import { getPublicBaseUrl } from "@/lib/app-url";
import { getDefaultRobokassaResultUrl } from "@/lib/robokassa";

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [merchantLogin, password1Set, password2Set, isTest] = await Promise.all([
    configStore.get("robokassa.merchant_login"),
    configStore.get("robokassa.password_1"),
    configStore.get("robokassa.password_2"),
    configStore.get("robokassa.is_test"),
  ]);

  const resultUrl = getDefaultRobokassaResultUrl();

  return NextResponse.json({
    merchantLogin: merchantLogin ?? "",
    password1Set: !!password1Set,
    password2Set: !!password2Set,
    isTest: isTest === "true" || isTest === "1",
    resultUrl,
    publicBaseUrl: getPublicBaseUrl(),
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const merchantLogin = body?.merchantLogin;
  const password1 = body?.password1;
  const password2 = body?.password2;
  const isTest = body?.isTest === true || body?.isTest === "true";

  if (!merchantLogin || typeof merchantLogin !== "string" || !merchantLogin.trim()) {
    return NextResponse.json(
      { error: "Обязательно: логин магазина (MerchantLogin)" },
      { status: 400 }
    );
  }

  const updates: Promise<void>[] = [
    configStore.set("robokassa.merchant_login", String(merchantLogin).trim(), {
      category: "payments",
      description: "Robokassa MerchantLogin",
    }),
    configStore.set("robokassa.is_test", isTest ? "true" : "false", {
      category: "payments",
      description: "Robokassa test mode",
    }),
  ];

  const mask = "••••••••";
  if (
    password1 &&
    typeof password1 === "string" &&
    password1.trim() &&
    password1 !== mask &&
    password1 !== "********"
  ) {
    updates.push(
      configStore.set("robokassa.password_1", password1.trim(), {
        isEncrypted: true,
        category: "payments",
        description: "Robokassa password 1",
      })
    );
  }
  if (
    password2 &&
    typeof password2 === "string" &&
    password2.trim() &&
    password2 !== mask &&
    password2 !== "********"
  ) {
    updates.push(
      configStore.set("robokassa.password_2", password2.trim(), {
        isEncrypted: true,
        category: "payments",
        description: "Robokassa password 2",
      })
    );
  }

  await Promise.all(updates);

  for (const k of [
    "robokassa.merchant_login",
    "robokassa.password_1",
    "robokassa.password_2",
    "robokassa.is_test",
  ]) {
    configStore.invalidate(k);
  }

  return NextResponse.json({ ok: true });
}
