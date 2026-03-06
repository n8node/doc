# Отчёт: Telegram уведомления для админа

## Реализовано

1. **Сервис** `src/lib/telegram.ts`
   - `getTelegramConfig()` — чтение настроек
   - `sendTelegramMessage()` — отправка в Telegram API
   - `formatRegisterMessage()`, `formatPaymentMessage()` — шаблоны с плейсхолдерами

2. **API**
   - `GET /api/v1/admin/telegram` — настройки (токен маскируется)
   - `POST /api/v1/admin/telegram` — сохранение
   - `POST /api/v1/admin/telegram/test` — тестовое сообщение

3. **Админка**
   - Вкладка «Telegram» в настройках
   - Форма: токен бота, ID чата, флаги и шаблоны для регистрации и оплаты
   - Кнопка «Отправить тестовое сообщение»
   - Пункт «Telegram» в сайдбаре админки

4. **Интеграции**
   - Регистрация: уведомление после `user.create` (при включённой опции)
   - Оплата: уведомление после успешного webhook от ЮKassa

---

## Список пушей в main

| # | Commit   | Описание                                      |
|---|----------|-----------------------------------------------|
| 1 | 303c78c  | feat(telegram): add telegram service for admin notifications |
| 2 | 4413f94  | feat(telegram): admin API GET/POST settings and test endpoint |
| 3 | df1ecbf  | feat(telegram): TelegramSettingsForm and admin tab |
| 4 | 070aeda  | feat(telegram): notify on user registration   |
| 5 | 12788df  | feat(telegram): notify on successful payment  |

**Диапазон:** `14f3bde` → `12788df`

---

## Использование

1. Админка → Настройки → вкладка **Telegram**
2. Указать токен бота (от @BotFather) и ID чата
3. Включить «Уведомлять о регистрации» и/или «Уведомлять об оплате»
4. При необходимости настроить шаблоны сообщений
5. Сохранить и нажать «Отправить тестовое сообщение»
