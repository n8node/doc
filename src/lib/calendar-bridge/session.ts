import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasFeature } from "@/lib/plan-service";

/** Настройки моста в кабинете: только сессия и тариф calendar_bridge */
export async function getCalendarBridgeSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  if (!(await hasFeature(session.user.id, "calendar_bridge"))) return null;
  return session.user.id;
}
