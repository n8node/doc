import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";
import {
  getTelegramConfig,
  DEFAULT_REGISTER_MESSAGE,
  DEFAULT_PAYMENT_MESSAGE,
} from "@/lib/telegram";

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cfg = await getTelegramConfig();
  return NextResponse.json({
    chatId: cfg.chatId ?? "",
    botTokenSet: !!cfg.botToken,
    notifyRegisterEnabled: cfg.notifyRegisterEnabled,
    notifyPaymentEnabled: cfg.notifyPaymentEnabled,
    registerMessage: cfg.registerMessage,
    paymentMessage: cfg.paymentMessage,
    defaultRegisterMessage: DEFAULT_REGISTER_MESSAGE,
    defaultPaymentMessage: DEFAULT_PAYMENT_MESSAGE,
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
  const {
    botToken,
    chatId,
    notifyRegisterEnabled,
    notifyPaymentEnabled,
    registerMessage,
    paymentMessage,
  } = body;

  const updates: Promise<void>[] = [];

  if (chatId != null && typeof chatId === "string") {
    updates.push(
      configStore.set("telegram.chat_id", String(chatId).trim(), {
        category: "notifications",
        description: "Telegram chat ID for admin notifications",
      })
    );
  }

  const botTokenValid =
    botToken &&
    typeof botToken === "string" &&
    botToken.trim() &&
    botToken !== "••••••••" &&
    botToken !== "********";

  if (botTokenValid) {
    updates.push(
      configStore.set("telegram.bot_token", botToken.trim(), {
        isEncrypted: true,
        category: "notifications",
        description: "Telegram bot token",
      })
    );
  }

  updates.push(
    configStore.set(
      "telegram.notify_register_enabled",
      notifyRegisterEnabled === true || notifyRegisterEnabled === "true" ? "true" : "false",
      { category: "notifications", description: "Notify on new user registration" }
    )
  );

  updates.push(
    configStore.set(
      "telegram.notify_payment_enabled",
      notifyPaymentEnabled === true || notifyPaymentEnabled === "true" ? "true" : "false",
      { category: "notifications", description: "Notify on successful payment" }
    )
  );

  if (registerMessage != null && typeof registerMessage === "string") {
    updates.push(
      configStore.set("telegram.register_message", registerMessage.trim(), {
        category: "notifications",
        description: "Message template for registration",
      })
    );
  }

  if (paymentMessage != null && typeof paymentMessage === "string") {
    updates.push(
      configStore.set("telegram.payment_message", paymentMessage.trim(), {
        category: "notifications",
        description: "Message template for payment",
      })
    );
  }

  await Promise.all(updates);

  configStore.invalidate("telegram.bot_token");
  configStore.invalidate("telegram.chat_id");
  configStore.invalidate("telegram.notify_register_enabled");
  configStore.invalidate("telegram.notify_payment_enabled");
  configStore.invalidate("telegram.register_message");
  configStore.invalidate("telegram.payment_message");

  return NextResponse.json({ ok: true });
}
