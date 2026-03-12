import { redirect } from "next/navigation";

export const metadata = {
  title: "Политика конфиденциальности — qoqon.ru",
  description: "Политика конфиденциальности",
};

export default function PrivacyPolicyPage() {
  redirect("/pages/privacy-policy");
}
