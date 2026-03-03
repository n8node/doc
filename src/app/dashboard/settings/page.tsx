import { Card, CardHeader, CardContent } from "@/components/ui/card";

export default function DashboardSettingsPage() {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Настройки профиля</h2>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Настройки аккаунта и подписки
        </p>
      </CardContent>
    </Card>
  );
}
