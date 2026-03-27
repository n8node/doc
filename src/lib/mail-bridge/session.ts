import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasFeature } from "@/lib/plan-service";

/** Настройки моста почты в кабинете: только сессия и тариф mail_bridge */
export async function getMailBridgeSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  if (!(await hasFeature(session.user.id, "mail_bridge"))) return null;
  return session.user.id;
}
