import { RoadmapAdminForm } from "@/components/admin/RoadmapAdminForm";

export default function AdminRoadmapPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Дорожная карта</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Публичная страница: <code className="rounded bg-muted px-1">/roadmap</code>. Порядок этапов
        соответствует «змейке»: первая половина — верхний ряд слева направо, вторая — нижний справа
        налево. Линия между двумя готовыми этапами сплошная, иначе пунктир.
      </p>
      <RoadmapAdminForm />
    </div>
  );
}
