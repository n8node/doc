import { redirect } from "next/navigation";

export const metadata = {
  title: "Правила пользования — qoqon.ru",
  description: "Правила пользования сайтом",
};

export default function TermsPage() {
  redirect("/pages/terms");
}
