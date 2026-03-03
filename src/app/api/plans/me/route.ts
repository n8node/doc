import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPlan } from "@/lib/plan-service";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plan = await getUserPlan(session.user.id);
  if (!plan)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({
    ...plan,
    storageQuota: Number(plan.storageQuota),
    maxFileSize: Number(plan.maxFileSize),
  });
}
