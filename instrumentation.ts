export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    setTimeout(async () => {
      try {
        const { configStore } = await import("./src/lib/config-store");
        const { startTelegramBot, isTelegramBotRunning } = await import("./src/lib/telegram-bot-service");
        const autoStart = await configStore.get("telegram.bot_auto_start");
        if (autoStart === "true" && !isTelegramBotRunning()) {
          const r = await startTelegramBot();
          if (r.ok) console.log("[telegram-bot] Auto-started on boot");
          else console.warn("[telegram-bot] Auto-start failed:", r.message);
        }
      } catch (e) {
        console.warn("[telegram-bot] Auto-start check failed:", e);
      }
    }, 10000);
  }
}
