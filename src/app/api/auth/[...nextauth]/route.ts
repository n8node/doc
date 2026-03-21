import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions, refreshAuthOptions } from "@/lib/auth";

const nextAuthHandler = NextAuth(authOptions);

/** После рестарта без срабатывания instrumentation провайдеры могли оставаться пустыми — подтягиваем VK перед каждым запросом к NextAuth (кэш config-store дешёвый). */
export async function GET(
  req: NextRequest,
  context: { params: { nextauth: string[] } }
) {
  await refreshAuthOptions();
  return nextAuthHandler(req, context);
}

export async function POST(
  req: NextRequest,
  context: { params: { nextauth: string[] } }
) {
  await refreshAuthOptions();
  return nextAuthHandler(req, context);
}
