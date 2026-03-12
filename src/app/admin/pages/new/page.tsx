import { PublicPageForm } from "@/components/admin/PublicPageForm";

export default function AdminPagesNewPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Новая публичная страница</h1>
      <PublicPageForm page={null} isNew />
    </div>
  );
}
