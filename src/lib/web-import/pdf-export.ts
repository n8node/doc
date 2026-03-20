import { PDFDocument, type PDFFont, rgb } from "pdf-lib";

let cachedFontBytes: ArrayBuffer | null = null;

async function loadNotoSans(): Promise<ArrayBuffer> {
  if (cachedFontBytes) return cachedFontBytes;
  const url =
    "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf";
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error("Не удалось загрузить шрифт для PDF");
  cachedFontBytes = await res.arrayBuffer();
  return cachedFontBytes;
}

function wrapByWidth(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      cur = test;
    } else {
      if (cur) lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

/**
 * PDF из текста (UTF-8, кириллица через Noto Sans).
 */
export async function buildPdfFromText(body: string, title?: string): Promise<Uint8Array> {
  const fontBytes = await loadNotoSans();
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(fontBytes);

  const fontSize = 10;
  const lineHeight = fontSize * 1.45;
  const margin = 48;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const textMaxWidth = pageWidth - margin * 2;

  const chunks: string[] = [];
  if (title?.trim()) {
    chunks.push(title.trim(), "");
  }
  chunks.push(body);

  const fullText = chunks.join("\n");
  const paragraphs = fullText.split("\n");

  let page = pdf.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - margin;

  const newPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    cursorY = pageHeight - margin;
  };

  for (const para of paragraphs) {
    const trimmed = para.trimEnd();
    if (!trimmed) {
      cursorY -= lineHeight * 0.4;
      if (cursorY < margin + lineHeight) newPage();
      continue;
    }
    const lines = wrapByWidth(trimmed, font, fontSize, textMaxWidth);
    for (const line of lines) {
      if (cursorY < margin + lineHeight) newPage();
      page.drawText(line, {
        x: margin,
        y: cursorY,
        size: fontSize,
        font,
        color: rgb(0.08, 0.09, 0.11),
      });
      cursorY -= lineHeight;
    }
    cursorY -= lineHeight * 0.15;
  }

  return pdf.save();
}
