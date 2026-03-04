export const FILES_SECTIONS = [
  "my-files",
  "recent",
  "photos",
  "shared",
  "history",
  "trash",
] as const;

export type FilesSection = (typeof FILES_SECTIONS)[number];

export const DEFAULT_FILES_SECTION: FilesSection = "my-files";

const FILES_SECTION_SET = new Set<FilesSection>(FILES_SECTIONS);

export function parseFilesSection(value: string | null | undefined): FilesSection {
  if (!value) return DEFAULT_FILES_SECTION;
  if (FILES_SECTION_SET.has(value as FilesSection)) {
    return value as FilesSection;
  }
  return DEFAULT_FILES_SECTION;
}

interface BuildDashboardFilesUrlInput {
  section?: FilesSection | null;
  folderId?: string | null;
  intent?: string | null;
  view?: "list" | "grid" | null;
}

export function buildDashboardFilesUrl(input: BuildDashboardFilesUrlInput = {}) {
  const params = new URLSearchParams();
  params.set("section", input.section ?? DEFAULT_FILES_SECTION);

  if (input.folderId) params.set("folderId", input.folderId);
  if (input.intent) params.set("intent", input.intent);
  if (input.view) params.set("view", input.view);

  return `/dashboard/files?${params.toString()}`;
}
