import { Card, CardHeader, CardContent } from "@/components/ui/card";

export default function DashboardSearchPage() {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Поиск</h2>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Полнотекстовый и AI-поиск по документам
        </p>
      </CardContent>
    </Card>
  );
}
