import { isProcessable, processDocument } from "./processing-service";
import { getDoclingClient } from "./client";

/**
 * Fire-and-forget: trigger document processing in background.
 * Safe to call from API routes — runs independently of the response lifecycle.
 * Errors are logged but never thrown.
 */
export function triggerProcessingInBackground(params: {
  fileId: string;
  s3Key: string;
  filename: string;
  mimeType: string;
  userId: string;
}): void {
  if (!isProcessable(params.mimeType)) return;

  (async () => {
    try {
      const docling = getDoclingClient();
      const available = await docling.isAvailable();
      if (!available) return;

      await processDocument(
        params.fileId,
        params.s3Key,
        params.filename,
        params.mimeType,
        params.userId,
      );
    } catch (err) {
      console.error("[auto-process] Background processing failed:", err);
    }
  })();
}
