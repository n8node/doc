import { redirect } from "next/navigation";

export default async function OnlyofficeEditPage() {
  redirect("/dashboard/files");
}
