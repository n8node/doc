import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function AdminTopbar() {
  const session = await getServerSession(authOptions);
  const initial = session?.user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/95 px-6 backdrop-blur">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Админ-панель</h1>
        <p className="text-sm text-slate-500">Управление системой</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 md:block">
          Поиск...
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
            {initial}
          </div>
          <div className="hidden text-left md:block">
            <p className="text-sm font-medium text-slate-800">{session?.user?.email}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
