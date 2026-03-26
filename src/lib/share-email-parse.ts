const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function normalizeShareEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Разделители: запятая, ;, перевод строки, пробел */
export function parseEmailList(input: string): string[] {
  const parts = input.split(/[\s,;]+/);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const n = normalizeShareEmail(p);
    if (!n || !EMAIL_RE.test(n)) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}
