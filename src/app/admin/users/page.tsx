import { Card } from "@/components/ui/card";

export default function AdminUsersPage() {
  return (
    <Card className="p-6">
      <h2 className="mb-2 text-lg font-semibold text-foreground">
        Пользователи
      </h2>
      <p className="text-sm text-muted-foreground">
        Управление пользователями и ролями
      </p>
    </Card>
  );
}
