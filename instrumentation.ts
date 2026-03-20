export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { refreshAuthOptions } = await import("./src/lib/auth");
      await refreshAuthOptions();
    } catch (e) {
      console.warn("[auth] refreshAuthOptions on boot failed:", e);
    }

    setTimeout(async () => {
      try {
        const { configStore } = await import("./src/lib/config-store");
        const { startTelegramBot, isTelegramBotRunning } = await import("./src/lib/telegram-bot-service");
        const autoStartFromEnv = process.env.TELEGRAM_BOT_AUTO_START === "true";
        const autoStartFromConfig = (await configStore.get("telegram.bot_auto_start")) === "true";
        const shouldAutoStart = autoStartFromEnv || autoStartFromConfig;
        if (shouldAutoStart && !isTelegramBotRunning()) {
          const r = await startTelegramBot();
          if (r.ok) {
            console.log(
              autoStartFromEnv
                ? "[telegram-bot] Auto-started on boot (TELEGRAM_BOT_AUTO_START)"
                : "[telegram-bot] Auto-started on boot"
            );
          } else {
            console.warn("[telegram-bot] Auto-start failed:", r.message);
          }
        }
      } catch (e) {
        console.warn("[telegram-bot] Auto-start check failed:", e);
      }
    }, 10000);
  }
}
