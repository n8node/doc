import type { ComponentType } from "react";
import {
  FolderOpen,
  Clock3,
  ImageIcon,
  Share2,
  History,
  Trash2,
  Search,
  BrainCircuit,
  Database,
  MessageCircle,
  Key,
  Store,
  Sparkles,
  Table2,
  FileText,
  Video,
} from "lucide-react";
import {
  buildDashboardFilesUrl,
  type FilesSection,
} from "@/lib/files-navigation";

export type ModuleId =
  | "storage"
  | "ai_tools"
  | "generation"
  | "integrations"
  | "tools";

export interface NavItem {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  section?: FilesSection;
}

export interface NavGroup {
  id: ModuleId;
  label: string;
  items: NavItem[];
  featureGate?: string;
  alwaysVisible?: boolean;
}

export const MODULE_LABELS: Record<ModuleId, string> = {
  storage: "Файлы",
  ai_tools: "AI и RAG",
  generation: "Генерация",
  integrations: "Интеграции",
  tools: "Инструменты",
};

export const MODULE_DESCRIPTIONS: Record<ModuleId, string> = {
  storage: "Хранение, навигация и управление файлами",
  ai_tools: "RAG-память, векторная база, AI чаты",
  generation: "Генерация текста, изображений, видео",
  integrations: "API-ключи и маркетплейс провайдеров",
  tools: "Поиск по файлам, таблицы",
};

export const navGroups: NavGroup[] = [
  {
    id: "storage",
    label: "Файлы",
    alwaysVisible: true,
    items: [
      { href: buildDashboardFilesUrl({ section: "my-files" }), icon: FolderOpen, label: "Мои файлы", section: "my-files" },
      { href: buildDashboardFilesUrl({ section: "recent" }), icon: Clock3, label: "Недавние", section: "recent" },
      { href: buildDashboardFilesUrl({ section: "photos" }), icon: ImageIcon, label: "Фото", section: "photos" },
      { href: buildDashboardFilesUrl({ section: "shared" }), icon: Share2, label: "Общий доступ", section: "shared" },
      { href: buildDashboardFilesUrl({ section: "history" }), icon: History, label: "История", section: "history" },
      { href: buildDashboardFilesUrl({ section: "trash" }), icon: Trash2, label: "Корзина", section: "trash" },
    ],
  },
  {
    id: "ai_tools",
    label: "AI и RAG",
    items: [
      { href: "/dashboard/rag-memory", icon: BrainCircuit, label: "RAG-память" },
      { href: "/dashboard/embeddings", icon: Database, label: "Векторная база" },
      { href: "/dashboard/document-chats", icon: MessageCircle, label: "AI чаты по документам" },
    ],
  },
  {
    id: "generation",
    label: "Генерация",
    featureGate: "content_generation",
    items: [
      { href: "/dashboard/generate/text", icon: FileText, label: "Текст" },
      { href: "/dashboard/generate/image", icon: Sparkles, label: "Изображения" },
      { href: "/dashboard/generate/video", icon: Video, label: "Видео" },
    ],
  },
  {
    id: "integrations",
    label: "Интеграции",
    items: [
      { href: "/dashboard/api-docs", icon: Key, label: "API настройки" },
      { href: "/dashboard/marketplace", icon: Store, label: "API маркетплейс" },
    ],
  },
  {
    id: "tools",
    label: "Инструменты",
    items: [
      { href: "/dashboard/search", icon: Search, label: "Поиск по файлам" },
      { href: "/dashboard/sheets", icon: Table2, label: "Таблицы" },
    ],
  },
];

export type ModulePrefs = Partial<Record<ModuleId, boolean>>;

const DEFAULTS: Record<ModuleId, boolean> = {
  storage: true,
  ai_tools: true,
  generation: true,
  integrations: true,
  tools: true,
};

export function resolveModulePrefs(raw: unknown): Record<ModuleId, boolean> {
  const result = { ...DEFAULTS };
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const key of Object.keys(DEFAULTS) as ModuleId[]) {
      if (typeof o[key] === "boolean") result[key] = o[key] as boolean;
    }
  }
  result.storage = true;
  return result;
}

export function isGroupVisible(
  group: NavGroup,
  modulePrefs: Record<ModuleId, boolean>,
  planFeatures: Record<string, boolean>,
): boolean {
  if (group.alwaysVisible) return true;
  if (group.featureGate && !planFeatures[group.featureGate]) return false;
  return modulePrefs[group.id] !== false;
}
