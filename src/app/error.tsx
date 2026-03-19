"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App Error]", error.message, error.digest, error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-lg font-semibold text-foreground">Что-то пошло не так</h2>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        Произошла ошибка при загрузке страницы. Попробуйте обновить страницу.
      </p>
      <Button onClick={() => reset()} variant="outline">
        Попробовать снова
      </Button>
    </div>
  );
}
