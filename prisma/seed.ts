import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminHash = await hash("admin123", 12);
  const user = await prisma.user.upsert({
    where: { email: "admin@qoqon.ru" },
    create: {
      email: "admin@qoqon.ru",
      passwordHash: adminHash,
      role: "ADMIN",
    },
    update: {},
  });
  console.log("Seed: admin user", user.email);

  const freePlan = await prisma.plan.upsert({
    where: { name: "Бесплатный" },
    create: {
      name: "Бесплатный",
      isFree: true,
      storageQuota: BigInt(25 * 1024 * 1024 * 1024), // 25GB
      maxFileSize: BigInt(512 * 1024 * 1024), // 512MB
      features: {
        video_player: true,
        audio_player: true,
        share_links: true,
        folder_share: true,
        ai_search: false,
        document_chat: false,
        rag_memory: false,
        n8n_connection: false,
      },
      priceMonthly: null,
      priceYearly: null,
    },
    update: {
      isFree: true,
      storageQuota: BigInt(25 * 1024 * 1024 * 1024),
      maxFileSize: BigInt(512 * 1024 * 1024),
      features: {
        video_player: true,
        audio_player: true,
        share_links: true,
        folder_share: true,
        ai_search: false,
        document_chat: false,
        rag_memory: false,
        n8n_connection: false,
      },
    },
  });
  console.log("Seed: plan", freePlan.name);

  const defaultDocPages = [
    { slug: "getting-started", title: "Начало работы", sortOrder: 0, content: "<p>Руководство по началу работы с сервисом.</p><h2>Регистрация</h2><p>Для регистрации потребуется инвайт-ключ. Активные ключи можно посмотреть на странице <a href=\"/invites\">Инвайт-ключи</a>.</p><h2>Вход</h2><p>После регистрации войдите с помощью email и пароля или через Telegram.</p>" },
    { slug: "files", title: "Файлы и хранилище", sortOrder: 1, content: "<p>Загружайте документы, фото и видео в своё личное хранилище.</p><h2>Секции</h2><ul><li><strong>Мои файлы</strong> — основные файлы и папки</li><li><strong>Недавние</strong> — недавно просмотренные</li><li><strong>Фото</strong> — изображения</li><li><strong>Общий доступ</strong> — расшаренные файлы</li><li><strong>История</strong> — действия с файлами</li><li><strong>Корзина</strong> — удалённые файлы</li></ul><p>Здесь можно вставить скриншот интерфейса.</p>" },
    { slug: "search", title: "Поиск", sortOrder: 2, content: "<p>Семантический поиск по смыслу — находите нужное без точного совпадения слов.</p><p>AI анализирует содержимое документов и помогает находить релевантные результаты по смыслу запроса.</p>" },
    { slug: "document-chats", title: "AI-чаты по документам", sortOrder: 3, content: "<p>Задавайте вопросы по своим документам — AI отвечает на основе содержимого.</p><h2>Как использовать</h2><ol><li>Выберите документ</li><li>Откройте чат</li><li>Задайте вопрос</li></ol>" },
    { slug: "rag-memory", title: "RAG-память", sortOrder: 4, content: "<p>Настройте, как система запоминает и использует ваши файлы для AI.</p>" },
    { slug: "embeddings", title: "Векторная база", sortOrder: 5, content: "<p>Просмотр эмбеддингов и индексов для семантического поиска.</p>" },
    { slug: "api", title: "API и интеграции", sortOrder: 6, content: "<p>Подключайте внешние системы через REST API. Создайте API-ключ в настройках.</p>" },
    { slug: "plans", title: "Тарифы", sortOrder: 7, content: "<p>Информация о тарифных планах и лимитах.</p>" },
    { slug: "settings", title: "Настройки", sortOrder: 8, content: "<p>Профиль, уведомления, привязка Telegram и другие настройки.</p>" },
  ];

  for (const p of defaultDocPages) {
    await prisma.docPage.upsert({
      where: { slug: p.slug },
      create: p,
      update: { title: p.title, sortOrder: p.sortOrder },
    });
  }
  console.log("Seed: doc pages", defaultDocPages.length);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
