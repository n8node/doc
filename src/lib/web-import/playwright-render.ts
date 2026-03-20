import { chromium, type Browser } from "playwright";

const RENDER_TIMEOUT_MS = 45_000;
const NAV_WAIT_UNTIL: "domcontentloaded" | "load" | "networkidle" = "domcontentloaded";

/** Браузерный UA ближе к обычному Chrome, чтобы реже резали боты. */
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

let browserSingleton: Browser | null = null;
let browserLaunching: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserSingleton && !browserSingleton.isConnected()) {
    browserSingleton = null;
  }
  if (browserSingleton) {
    return browserSingleton;
  }
  if (browserLaunching) {
    return browserLaunching;
  }
  browserLaunching = chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    browserSingleton = await browserLaunching;
    return browserSingleton;
  } finally {
    browserLaunching = null;
  }
}

/**
 * Отдаёт HTML после выполнения JS на странице.
 * В Docker нужны системные библиотеки Chromium (см. Dockerfile) и кэш браузеров Playwright.
 */
export async function fetchRenderedHtml(url: string, maxBytes: number): Promise<string> {
  if (process.env.WEB_IMPORT_PLAYWRIGHT === "0") {
    throw new Error("Playwright отключён (WEB_IMPORT_PLAYWRIGHT=0)");
  }

  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: BROWSER_USER_AGENT,
    locale: "ru-RU",
    javaScriptEnabled: true,
  });
  try {
    const page = await context.newPage();
    await page.goto(url, {
      waitUntil: NAV_WAIT_UNTIL,
      timeout: RENDER_TIMEOUT_MS,
    });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    const html = await page.content();
    if (html.length > maxBytes) {
      throw new Error("Страница слишком большая после рендеринга");
    }
    return html;
  } finally {
    await context.close();
  }
}
