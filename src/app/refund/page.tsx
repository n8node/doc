import { redirect } from "next/navigation";

export const metadata = {
  title: "Политика возврата средств — qoqon.ru",
  description: "Политика возврата средств",
};

export default function RefundPage() {
  redirect("/pages/refund");
}
