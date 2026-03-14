import { LandingContentForm } from "@/components/admin/LandingContentForm";

export default function AdminLandingContentPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Контент главной страницы</h1>
      <LandingContentForm />
    </div>
  );
}
