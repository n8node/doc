import { redirect } from "next/navigation";

export const metadata = {
  title: "Правила приобретения — qoqon.ru",
  description: "Правила приобретения и использования цифровых продуктов и услуг",
};

export default function ShopTermsPage() {
  redirect("/pages/shop-terms");
}
