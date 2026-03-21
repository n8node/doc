export async function register() {
  /** В Node при старте `NEXT_RUNTIME` может быть `nodejs`, а в standalone/Docker иногда не задан — тогда refresh не выполнялся, VK пропадал после перезапуска. Edge — пропускаем (нет Prisma). */
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }

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
