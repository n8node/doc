import { Card, CardHeader, CardContent } from "@/components/ui/card";

export default function DashboardFilesPage() {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Файлы</h2>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Здесь будет файловый менеджер с загрузкой и AI-анализом
        </p>
      </CardContent>
    </Card>
  );
}
