# Отчёт по UX-улучшениям

**Дата:** 12 марта 2025  
**Ветка:** `main`

## Сводка

Реализовано 5 UX-улучшений. Каждый шаг выполнен с отдельным коммитом и push.

---

## Выполненные улучшения

### 1. Уведомления: пометить прочитанным при клике в dropdown
**Коммит:** `1850dd9`

**Что сделано:**
- При клике на непрочитанное уведомление в выпадающем списке оно помечается как прочитанное.
- Локальное обновление состояния для быстрой визуальной обратной связи.

**Файл:** `src/components/layout/NotificationsDropdown.tsx`

---

### 2. Клавиатурные сочетания в FileManager
**Коммит:** `a152c5a`

**Что сделано:**
- **Escape** — снять выделение с файлов/папок.
- **Delete / Backspace** — удалить выбранные элементы.
- **Ctrl+A** — выделить всё на странице.
- **Enter** — открыть выбранную папку или воспроизвести медиафайл.

**Файл:** `src/components/files/FileManager.tsx`

---

### 3. История поиска в AI-поиске
**Коммит:** `7e237ea`

**Что сделано:**
- Сохранение последних 10 поисковых запросов в `localStorage` (ключ `ai-search-history`).
- Блок «Вы искали:» с кликабельными чипами.
- При клике на чип выполняется соответствующий поиск.

**Файл:** `src/app/dashboard/search/page.tsx`

---

### 4. Document-chats: CTA при пустом списке
**Коммит:** `8c68db5`

**Что сделано:**
- Обновлён empty state для пустого списка чатов по документам.
- Пошаговая инструкция (1–2–3).
- Явный CTA «Перейти к файлам и начать чат» с иконкой.

**Файл:** `src/app/dashboard/document-chats/page.tsx`

---

### 5. Заблокированные функции: tooltip с замком в FileManager
**Коммит:** `5fffb77`

**Что сделано:**
- **FileCard:** добавлены пропсы `processLocked` и `transcribeLocked` — показ кнопки с иконкой замка и подсказкой, когда нет доступа.
- **FileManager:** передача `processLocked` при `!documentAnalysisAllowed`, `transcribeLocked` при `transcriptionQuotaExceeded`.
- Inline-кнопки в grid-режиме (фото-сетка) с теми же tooltip и состоянием locked.
- **Поддержка анализа изображений в фото-сетке:** добавлены MIME-типы `image/png`, `image/jpeg`, `image/jpg`, `image/tiff`, `image/bmp` в `PROCESSABLE_MIMES` (backend Docling поддерживает OCR для изображений).
- **TooltipProvider** добавлен в корневой `layout.tsx` для корректной работы tooltip во всём приложении.

**Файлы:**
- `src/components/files/FileCard.tsx`
- `src/components/files/FileManager.tsx`
- `src/lib/docling/processing-service.ts`
- `src/app/layout.tsx`

---

## Чеклист для деплоя

- [ ] **Termius (SSH):** синхронизация Git  
  ```bash
  cd /opt/dropbox-ru && git pull origin main
  ```

- [ ] **Termius:** миграция БД (если были изменения схемы; в данном релизе — нет).

- [ ] **Termius:** пересборка и запуск  
  ```bash
  docker compose build app && docker compose up -d
  ```

---

## Локальная проверка

```bash
# Установка зависимостей (если ещё не установлены)
npm install

# Запуск в режиме разработки
npm run dev
```

Проверить:
1. Уведомления — клик по непрочитанному → пометка прочитанным.
2. Файлы — Esc, Delete, Ctrl+A, Enter.
3. AI-поиск — история запросов «Вы искали:».
4. Document-chats — пустой список → CTA и инструкция.
5. Файлы — заблокированные кнопки «Анализ» и «Транскрибация» с замком и tooltip; фото в сетке — кнопка «Анализ» для изображений.
