import { N8nGuideContentForm } from "@/components/admin/N8nGuideContentForm";

export default function AdminN8nGuidePage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">
        Инструкция n8n
      </h1>
      <N8nGuideContentForm />
    </div>
  );
}
