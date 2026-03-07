import Link from "next/link";

export const metadata = {
  title: "Политика конфиденциальности — qoqon.ru",
  description: "Политика конфиденциальности",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-foreground">Политика конфиденциальности</h1>
        <p className="mt-4 text-muted-foreground">Содержимое страницы в разработке.</p>
        <Link href="/" className="mt-6 inline-block text-sm text-primary hover:underline">
          ← На главную
        </Link>
      </div>
    </main>
  );
}
