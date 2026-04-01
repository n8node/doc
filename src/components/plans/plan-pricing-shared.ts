import type { PlanItem } from "./plan-pricing-types";
import {
  getTranscriptionAudioDetailLines,
  getTranscriptionVideoDetailLines,
} from "@/lib/transcription-quota-display";
import {
  hasTranscriptionAudio,
  hasTranscriptionVideo,
} from "@/lib/plan-transcription-features";

/** Порядок и подписи совпадают с админкой тарифов (публичные названия возможностей) */
export const planFeatureLabels: Record<string, string> = {
  video_player: "Видеоплеер",
  audio_player: "Аудиоплеер",
  share_links: "Публичные ссылки",
  folder_share: "Шаринг папок",
  shared_access_email: "Совместный доступ",
  rag_memory: "RAG-память",
  n8n_connection: "Подключение к n8n",
  sheets: "Таблицы",
  web_import: "Парсинг сайтов",
  ai_search: "AI-поиск по документам",
  document_chat: "AI чаты по документам",
  document_analysis: "AI-анализ документов",
  transcription_audio: "Транскрибация аудио",
  transcription_video: "Транскрибация видео",
  own_ai_keys: "Свой API-ключ (токены не списываются)",
  content_generation: "Генерация изображений",
  video_generation: "Генерация видео",
  calendar_bridge: "Мост календаря",
  mail_bridge: "Мост Email",
};

export function getPlanFeatureTooltipContent(
  plan: PlanItem,
  key: string,
  enabled: boolean,
): { title: string; lines: string[] } {
  const label = planFeatureLabels[key] ?? key;
  if (!enabled) {
    return {
      title: label,
      lines: ["Эта возможность не входит в выбранный тариф."],
    };
  }
  switch (key) {
    case "document_analysis":
      return {
        title: label,
        lines: [
          plan.aiAnalysisDocumentsQuota != null
            ? `Квота: ${plan.aiAnalysisDocumentsQuota} документов в месяц.`
            : "Безлимит по количеству документов для анализа в месяц.",
        ],
      };
    case "document_chat":
      return {
        title: label,
        lines: [
          plan.chatTokensQuota != null
            ? `Квота: ${plan.chatTokensQuota.toLocaleString("ru-RU")} токенов в месяц.`
            : "Безлимит токенов для чатов по документам.",
        ],
      };
    case "ai_search":
      return {
        title: label,
        lines: [
          plan.searchTokensQuota != null
            ? `Квота: ${plan.searchTokensQuota.toLocaleString("ru-RU")} токенов в месяц.`
            : "Безлимит токенов для AI-поиска по документам.",
        ],
      };
    case "transcription_audio":
      return {
        title: label,
        lines: getTranscriptionAudioDetailLines(plan),
      };
    case "transcription_video":
      return {
        title: label,
        lines: getTranscriptionVideoDetailLines(plan),
      };
    case "rag_memory":
      return {
        title: label,
        lines: [
          plan.ragDocumentsQuota != null
            ? `Квота: ${plan.ragDocumentsQuota} документов в RAG-коллекциях.`
            : "Безлимит документов в коллекциях памяти.",
        ],
      };
    case "content_generation":
      return {
        title: label,
        lines: [
          plan.imageGenerationCreditsQuota != null
            ? `Квота: ${plan.imageGenerationCreditsQuota.toLocaleString("ru-RU")} кредитов в месяц на генерацию изображений.`
            : "Безлимит по кредитам генерации изображений в рамках тарифа.",
        ],
      };
    case "video_generation":
      return {
        title: label,
        lines: [
          plan.videoGenerationCreditsQuota != null
            ? `Квота: ${plan.videoGenerationCreditsQuota.toLocaleString("ru-RU")} кредитов в месяц на генерацию видео.`
            : "Безлимит по кредитам генерации видео в рамках тарифа.",
        ],
      };
    case "web_import":
      return {
        title: label,
        lines: [
          plan.webImportPagesQuota != null
            ? `Квота парсинга: до ${plan.webImportPagesQuota.toLocaleString("ru-RU")} страниц в месяц.`
            : "Парсинг сайтов включён; лимит страниц уточняйте в описании тарифа.",
        ],
      };
    case "calendar_bridge":
      return {
        title: label,
        lines: [
          "(Яндекс → API / n8n). Синхронизация Яндекс.Календаря (CalDAV) и REST API для n8n: ключ cal_, раздел «Календари (CalDav)» в кабинете.",
        ],
      };
    case "mail_bridge":
      return {
        title: label,
        lines: [
          "(IMAP/SMTP, Яндекс → API / n8n). Кэш входящих, отправка, ключ mail_, раздел «Почта (IMAP/SMTP)» в кабинете.",
        ],
      };
    case "video_player":
    case "audio_player":
      return {
        title: label,
        lines: ["Воспроизведение медиа в облаке без скачивания файла целиком."],
      };
    case "n8n_connection":
      return {
        title: label,
        lines: ["Подключение PostgreSQL и таблиц к n8n для сценариев автоматизации."],
      };
    case "sheets":
      return {
        title: label,
        lines: ["Таблицы в облаке с поддержкой экспорта и интеграций."],
      };
    case "shared_access_email":
      return {
        title: label,
        lines: ["Совместный доступ к файлам и папкам по email."],
      };
    case "own_ai_keys":
      return {
        title: label,
        lines: ["Подключение своих ключей провайдеров AI без списания токенов с баланса тарифа."],
      };
    default:
      return {
        title: label,
        lines: ["Функция включена в этом тарифе."],
      };
  }
}

export function isPlanFeatureEnabled(
  plan: PlanItem,
  key: string,
): boolean {
  const f = plan.features ?? {};
  if (key === "transcription_audio") return hasTranscriptionAudio(f);
  if (key === "transcription_video") return hasTranscriptionVideo(f);
  return f[key] === true;
}
