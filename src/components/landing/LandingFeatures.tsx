import Link from "next/link";
import { Cloud, Search, MessageSquare, Puzzle } from "lucide-react";

const FEATURES = [
  {
    icon: Cloud,
    title: "Облачное хранилище",
    description: "Файлы, папки, версии. Документы, фото, видео в одном месте.",
    href: "/dashboard/files",
  },
  {
    icon: Search,
    title: "AI-поиск",
    description: "Семантический поиск по смыслу — находите без точного совпадения слов.",
    href: "/dashboard/search",
  },
  {
    icon: MessageSquare,
    title: "RAG и чаты",
    description: "Вопросы по документам, RAG-память, векторные коллекции.",
    href: "/dashboard/document-chats",
  },
  {
    icon: Puzzle,
    title: "API и маркетплейс",
    description: "REST API, LLM-модели, единый кошелёк, интеграции n8n.",
    href: "/dashboard/api-docs",
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="border-t border-border bg-surface2/50 px-4 py-16">
      <div className="container mx-auto max-w-5xl">
        <h2 className="mb-10 text-center text-2xl font-bold text-foreground sm:text-3xl">
          Возможности
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <Link
              key={f.title}
              href={f.href}
              className="group rounded-2xl border border-border bg-surface/95 p-6 transition-all hover:border-primary/30 hover:shadow-lg"
            >
              <f.icon className="mb-4 h-10 w-10 text-primary" />
              <h3 className="mb-2 font-semibold text-foreground">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
