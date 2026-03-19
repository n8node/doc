"use client";

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body className="antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
          <h2 className="text-lg font-semibold">Ошибка приложения</h2>
          <p className="max-w-md text-center text-sm text-muted-foreground">
            Произошла ошибка. Попробуйте обновить страницу.
          </p>
          <button
            onClick={() => reset()}
            className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
          >
            Обновить
          </button>
        </div>
      </body>
    </html>
  );
}
