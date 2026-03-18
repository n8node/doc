"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function GenerateTextPage() {
  return (
    <div className="container max-w-2xl py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-6 w-6 text-primary" />
            Генерация текста
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6 py-12">
          <p className="text-center text-muted-foreground">
            Раздел находится в разработке и скоро порадует пользователей функционалом.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
