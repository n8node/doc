import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { getDoclingClient } from "@/lib/docling/client";
import { verifyPgvectorExtension } from "@/lib/docling/vector-store";

/**
 * GET /api/admin/docling — health check for Docling service and pgvector
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const docling = getDoclingClient();

  const [doclingAvailable, pgvectorInstalled, formats] = await Promise.all([
    docling.isAvailable(),
    verifyPgvectorExtension(),
    docling.supportedFormats().catch(() => null),
  ]);

  return NextResponse.json({
    docling: {
      available: doclingAvailable,
      url: process.env.DOCLING_URL || "http://localhost:8000",
      formats: formats?.formats ?? [],
      ocrLanguages: formats?.ocr_languages ?? [],
    },
    pgvector: {
      installed: pgvectorInstalled,
    },
  });
}
