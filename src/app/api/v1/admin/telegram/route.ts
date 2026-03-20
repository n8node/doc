import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { configStore } from "@/lib/config-store";
import {
  getTelegramConfig,
  DEFAULT_REGISTER_MESSAGE,
  DEFAULT_REGISTER_EMAIL_VERIFIED_MESSAGE,
  DEFAULT_PAYMENT_MESSAGE,
  DEFAULT_LLM_WALLET_TOPUP_MESSAGE,
  DEFAULT_SPAM_REGISTRATION_MESSAGE,
} from "@/lib/telegram";

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [cfg, notifyTicket] = await Promise.all([
    getTelegramConfig(),
    import("@/lib/config-store").then((m) => m.configStore.get("telegram.notify_ticket_enabled")),
  ]);
  return NextResponse.json({
    chatId: cfg.chatId ?? "",
    botTokenSet: !!cfg.botToken,
    notifyRegisterEnabled: cfg.notifyRegisterEnabled,
    notifyPaymentEnabled: cfg.notifyPaymentEnabled,
    notifyLlmWalletTopupEnabled: cfg.notifyLlmWalletTopupEnabled,
    notifySpamRegistrationEnabled: cfg.notifySpamRegistrationEnabled,
    notifyTicketEnabled: notifyTicket === "true",
    registerMessage: cfg.registerMessage,
    registerEmailVerifiedMessage: cfg.registerEmailVerifiedMessage,
    paymentMessage: cfg.paymentMessage,
    llmWalletTopupMessage: cfg.llmWalletTopupMessage,
    spamRegistrationMessage: cfg.spamRegistrationMessage,
    defaultRegisterMessage: DEFAULT_REGISTER_MESSAGE,
    defaultRegisterEmailVerifiedMessage: DEFAULT_REGISTER_EMAIL_VERIFIED_MESSAGE,
    defaultPaymentMessage: DEFAULT_PAYMENT_MESSAGE,
    defaultLlmWalletTopupMessage: DEFAULT_LLM_WALLET_TOPUP_MESSAGE,
    defaultSpamRegistrationMessage: DEFAULT_SPAM_REGISTRATION_MESSAGE,
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
    notifyLlmWalletTopupEnabled,
    notifySpamRegistrationEnabled,
    notifyTicketEnabled,
    registerMessage,
    registerEmailVerifiedMessage,
    paymentMessage,
    llmWalletTopupMessage,
    spamRegistrationMessage,
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

  if (notifyLlmWalletTopupEnabled !== undefined) {
    updates.push(
      configStore.set(
        "telegram.notify_llm_wallet_topup_enabled",
        notifyLlmWalletTopupEnabled === true || notifyLlmWalletTopupEnabled === "true" ? "true" : "false",
        {
          category: "notifications",
          description: "Notify admin on LLM wallet top-up",
        }
      )
    );
  }

  updates.push(
    configStore.set(
      "telegram.notify_spam_registration_enabled",
      notifySpamRegistrationEnabled === true ||
        notifySpamRegistrationEnabled === "true"
        ? "true"
        : "false",
      {
        category: "notifications",
        description: "Notify on suspicious invite-based registration bursts",
      }
    )
  );

  if (notifyTicketEnabled !== undefined) {
    updates.push(
      configStore.set(
        "telegram.notify_ticket_enabled",
        notifyTicketEnabled === true || notifyTicketEnabled === "true" ? "true" : "false",
        { category: "notifications", description: "Notify on new support tickets" }
      )
    );
  }

  if (registerMessage != null && typeof registerMessage === "string") {
    updates.push(
      configStore.set("telegram.register_message", registerMessage.trim(), {
        category: "notifications",
        description: "Message template for registration",
      })
    );
  }

  if (registerEmailVerifiedMessage != null && typeof registerEmailVerifiedMessage === "string") {
    updates.push(
      configStore.set("telegram.register_email_verified_message", registerEmailVerifiedMessage.trim(), {
        category: "notifications",
        description: "Message template when email is verified",
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

  if (llmWalletTopupMessage != null && typeof llmWalletTopupMessage === "string") {
    updates.push(
      configStore.set("telegram.llm_wallet_topup_message", llmWalletTopupMessage.trim(), {
        category: "notifications",
        description: "Message template for LLM wallet top-up (admin)",
      })
    );
  }

  if (spamRegistrationMessage != null && typeof spamRegistrationMessage === "string") {
    updates.push(
      configStore.set(
        "telegram.spam_registration_message",
        spamRegistrationMessage.trim(),
        {
          category: "notifications",
          description: "Message template for suspicious registration alerts",
        }
      )
    );
  }

  await Promise.all(updates);

  configStore.invalidate("telegram.bot_token");
  configStore.invalidate("telegram.chat_id");
  configStore.invalidate("telegram.notify_register_enabled");
  configStore.invalidate("telegram.notify_payment_enabled");
  configStore.invalidate("telegram.notify_llm_wallet_topup_enabled");
  configStore.invalidate("telegram.notify_spam_registration_enabled");
  configStore.invalidate("telegram.notify_ticket_enabled");
  configStore.invalidate("telegram.register_message");
  configStore.invalidate("telegram.register_email_verified_message");
  configStore.invalidate("telegram.payment_message");
  configStore.invalidate("telegram.llm_wallet_topup_message");
  configStore.invalidate("telegram.spam_registration_message");

  return NextResponse.json({ ok: true });
}
