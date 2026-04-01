import { configStore } from "./config-store";
import { getYookassaConfig } from "./yookassa";
import { getRobokassaConfig } from "./robokassa";

export type ActivePaymentProviderId = "yookassa" | "robokassa";

export async function getStoredActivePaymentProvider(): Promise<ActivePaymentProviderId> {
  const raw = (await configStore.get("payments.active_provider"))?.trim().toLowerCase();
  return raw === "robokassa" ? "robokassa" : "yookassa";
}

/**
 * Какой провайдер реально используется при создании платежа.
 * Ошибка — если активный провайдер не сконфигурирован.
 */
export async function resolveActivePaymentProvider(): Promise<
  { provider: ActivePaymentProviderId } | { error: string }
> {
  const active = await getStoredActivePaymentProvider();

  if (active === "robokassa") {
    const cfg = await getRobokassaConfig();
    if (!cfg) {
      return {
        error:
          "Выбрана Robokassa, но не заданы логин магазина или пароли #1/#2 в настройках.",
      };
    }
    return { provider: "robokassa" };
  }

  const y = await getYookassaConfig();
  if (!y) {
    return {
      error:
        "Выбрана ЮKassa, но она не настроена или отключена в настройках платежей.",
    };
  }
  return { provider: "yookassa" };
}
