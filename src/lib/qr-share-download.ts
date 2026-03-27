import QRCode from "qrcode";
import { jsPDF } from "jspdf";

const QR_COLOR = { dark: "#000000", light: "#ffffff" } as const;

const QR_OPTS_FULL = {
  errorCorrectionLevel: "M" as const,
  margin: 2,
  width: 512,
  color: QR_COLOR,
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/** Превью в диалоге (меньше размер файла). */
export function getQrPreviewDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    ...QR_OPTS_FULL,
    width: 220,
  });
}

export async function downloadQrPng(text: string, filename = "qr-share.png") {
  const dataUrl = await QRCode.toDataURL(text, QR_OPTS_FULL);
  downloadDataUrl(dataUrl, filename);
}

export async function downloadQrSvg(text: string, filename = "qr-share.svg") {
  const svg = await QRCode.toString(text, {
    type: "svg",
    width: 512,
    margin: 2,
    color: QR_COLOR,
    errorCorrectionLevel: "M",
  });
  downloadBlob(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    filename,
  );
}

/** Простой EPS: чёрные модули на белом фоне (для печати). */
export function buildQrEps(text: string): string {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const { modules } = qr;
  const n = modules.size;
  const pts = 200;
  const cell = pts / n;
  const lines: string[] = [
    "%!PS-Adobe-3.0 EPSF-3.0",
    `%%BoundingBox: 0 0 ${pts} ${pts}`,
    "%%Title: QR Code",
    "%%EndComments",
    "save",
    "1 1 1 setrgbcolor",
    `0 0 ${pts} ${pts} rectfill`,
    "0 0 0 setrgbcolor",
  ];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (modules.get(row, col)) {
        const x = col * cell;
        const y = (n - 1 - row) * cell;
        lines.push(`${x} ${y} ${cell} ${cell} rectfill`);
      }
    }
  }
  lines.push("restore", "%%EOF");
  return lines.join("\n");
}

export function downloadQrEps(text: string, filename = "qr-share.eps") {
  const eps = buildQrEps(text);
  downloadBlob(new Blob([eps], { type: "application/postscript" }), filename);
}

export async function downloadQrPdf(text: string, filename = "qr-share.pdf") {
  const dataUrl = await QRCode.toDataURL(text, QR_OPTS_FULL);
  const pdf = new jsPDF({ unit: "mm", format: [80, 80] });
  const side = 70;
  const pad = 5;
  pdf.addImage(dataUrl, "PNG", pad, pad, side, side);
  const blob = pdf.output("blob");
  downloadBlob(blob, filename);
}
