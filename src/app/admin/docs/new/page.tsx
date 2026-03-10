import { DocsPageForm } from "@/components/admin/DocsPageForm";

export default function AdminDocsNewPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Новая страница документации</h1>
      <DocsPageForm page={null} isNew />
    </div>
  );
}
