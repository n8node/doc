import { RoadmapAdminForm } from "@/components/admin/RoadmapAdminForm";

export default function AdminRoadmapPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Дорожная карта</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Публичная страница: <code className="rounded bg-muted px-1">/roadmap</code>. Линия на схеме
        идёт строго по календарной дате этапа (UTC), а не по порядку строк в этом списке. Этапы
        группируются по месяцу: каждая горизонталь — один календарный месяц, ряды чередуются слева
        направо и справа налево. Порядок «Вверх/Вниз» влияет только на удобство редактирования и на
        совпадение дат в один день. Между двумя выполненными этапами линия сплошная, иначе пунктир.
      </p>
      <RoadmapAdminForm />
    </div>
  );
}
