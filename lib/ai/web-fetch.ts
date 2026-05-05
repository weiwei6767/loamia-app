import "server-only";

export type FetchedPage = {
  url: string;
  title: string;
  description: string;
  text: string;
  truncated: boolean;
};

const MAX_TEXT_CHARS = 12000;
const FETCH_TIMEOUT_MS = 15000;
const UA =
  "Mozilla/5.0 (compatible; LoamiaBot/1.0; +https://loamia.xyz/bot)";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function extractMeta(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)\\s*=\\s*["']${name}["'][^>]+content\\s*=\\s*["']([^"']+)["']`,
    "i"
  );
  const re2 = new RegExp(
    `<meta[^>]+content\\s*=\\s*["']([^"']+)["'][^>]+(?:name|property)\\s*=\\s*["']${name}["']`,
    "i"
  );
  const m = html.match(re) ?? html.match(re2);
  return m?.[1] ? decodeEntities(m[1]) : null;
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m?.[1] ? decodeEntities(m[1].trim()) : "";
}

function extractVisibleText(html: string): string {
  let s = html;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export async function fetchPage(url: string): Promise<FetchedPage> {
  const u = new URL(url);
  if (!["http:", "https:"].includes(u.protocol)) {
    throw new Error("invalid_protocol");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(u.toString(), {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`fetch_${res.status}`);
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
    // still try; some servers send text/plain
  }
  const html = await res.text();

  const title =
    extractTitle(html) ||
    extractMeta(html, "og:title") ||
    extractMeta(html, "twitter:title") ||
    "";
  const description =
    extractMeta(html, "description") ||
    extractMeta(html, "og:description") ||
    extractMeta(html, "twitter:description") ||
    "";
  const visible = extractVisibleText(html);
  const truncated = visible.length > MAX_TEXT_CHARS;
  const text = truncated ? visible.slice(0, MAX_TEXT_CHARS) : visible;

  return { url: u.toString(), title, description, text, truncated };
}
