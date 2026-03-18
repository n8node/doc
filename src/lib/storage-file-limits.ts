import { configStore } from "@/lib/config-store";

const KEYS = {
  maxFileSizeImageMb: "storage.max_file_size_image_mb",
  maxFileSizeVideoMb: "storage.max_file_size_video_mb",
  maxFileSizeArchiveMb: "storage.max_file_size_archive_mb",
  maxFileSizeOtherMb: "storage.max_file_size_other_mb",
} as const;

export type FileSizeCategory = "image" | "video" | "archive" | "other";

const DEFAULTS_MB: Record<FileSizeCategory, number> = {
  image: 150,
  video: 500,
  archive: 200,
  other: 512,
};

const ABSOLUTE_MAX_MB = 5 * 1024; // 5 GB

function parseMb(key: string, value: string | null, defaultMb: number): number {
  if (value == null || value.trim() === "") return defaultMb;
  const n = parseInt(value.trim(), 10);
  if (!Number.isFinite(n) || n < 0) return defaultMb;
  return Math.min(n, ABSOLUTE_MAX_MB);
}

export async function getMaxFileSizeImageMb(): Promise<number> {
  const v = await configStore.get(KEYS.maxFileSizeImageMb);
  return parseMb(KEYS.maxFileSizeImageMb, v, DEFAULTS_MB.image);
}

export async function getMaxFileSizeVideoMb(): Promise<number> {
  const v = await configStore.get(KEYS.maxFileSizeVideoMb);
  return parseMb(KEYS.maxFileSizeVideoMb, v, DEFAULTS_MB.video);
}

export async function getMaxFileSizeArchiveMb(): Promise<number> {
  const v = await configStore.get(KEYS.maxFileSizeArchiveMb);
  return parseMb(KEYS.maxFileSizeArchiveMb, v, DEFAULTS_MB.archive);
}

export async function getMaxFileSizeOtherMb(): Promise<number> {
  const v = await configStore.get(KEYS.maxFileSizeOtherMb);
  return parseMb(KEYS.maxFileSizeOtherMb, v, DEFAULTS_MB.other);
}

/** Лимит в байтах для категории (для сохранения сгенерированных изображений и т.д.). */
export async function getMaxFileSizeBytesForCategory(category: FileSizeCategory): Promise<bigint> {
  const mb =
    category === "image"
      ? await getMaxFileSizeImageMb()
      : category === "video"
        ? await getMaxFileSizeVideoMb()
        : category === "archive"
          ? await getMaxFileSizeArchiveMb()
          : await getMaxFileSizeOtherMb();
  return BigInt(mb) * BigInt(1024 * 1024);
}

/** Все лимиты в MB для админки. */
export async function getStorageFileLimitsMb(): Promise<Record<FileSizeCategory, number>> {
  const [image, video, archive, other] = await Promise.all([
    getMaxFileSizeImageMb(),
    getMaxFileSizeVideoMb(),
    getMaxFileSizeArchiveMb(),
    getMaxFileSizeOtherMb(),
  ]);
  return { image, video, archive, other };
}

export async function setStorageFileLimitsMb(limits: Partial<Record<FileSizeCategory, number>>): Promise<void> {
  const desc = { category: "storage" as const, description: "Лимит размера файла по категории (МБ)" };
  if (typeof limits.image === "number" && limits.image >= 0) {
    await configStore.set(KEYS.maxFileSizeImageMb, String(Math.min(limits.image, ABSOLUTE_MAX_MB)), desc);
  }
  if (typeof limits.video === "number" && limits.video >= 0) {
    await configStore.set(KEYS.maxFileSizeVideoMb, String(Math.min(limits.video, ABSOLUTE_MAX_MB)), desc);
  }
  if (typeof limits.archive === "number" && limits.archive >= 0) {
    await configStore.set(KEYS.maxFileSizeArchiveMb, String(Math.min(limits.archive, ABSOLUTE_MAX_MB)), desc);
  }
  if (typeof limits.other === "number" && limits.other >= 0) {
    await configStore.set(KEYS.maxFileSizeOtherMb, String(Math.min(limits.other, ABSOLUTE_MAX_MB)), desc);
  }
}

/** Определить категорию по MIME и имени файла (для загрузки). */
export function fileCategoryFromMime(mimeType: string, fileName?: string): FileSizeCategory {
  const mime = (mimeType || "").toLowerCase();
  const name = (fileName || "").toLowerCase();
  if (
    mime.startsWith("image/") ||
    /\.(jpe?g|png|gif|webp|avif|bmp|ico|svg|heic)$/i.test(name)
  ) {
    return "image";
  }
  if (
    mime.startsWith("video/") ||
    mime === "application/x-mpegurl" ||
    /\.(mp4|webm|mov|avi|mkv|m4v|wmv|flv|m3u8)$/i.test(name)
  ) {
    return "video";
  }
  if (
    mime.includes("zip") ||
    mime.includes("tar") ||
    mime.includes("rar") ||
    mime.includes("7z") ||
    /\.(zip|tar|gz|bz2|xz|rar|7z|ar)$/i.test(name)
  ) {
    return "archive";
  }
  return "other";
}
