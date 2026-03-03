import { redirect } from "next/navigation";
import { buildDashboardFilesUrl, DEFAULT_FILES_SECTION } from "@/lib/files-navigation";

export default function DashboardPage() {
  redirect(buildDashboardFilesUrl({ section: DEFAULT_FILES_SECTION }));
}
