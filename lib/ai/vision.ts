import "server-only";
import { anthropic, CHAT_MODEL } from "./anthropic";

export type StyleColors = {
  bg: string;
  fg: string;
  accent: string;
  surface: string;
  headingFont: "serif" | "sans-serif" | "monospace";
  bodyFont: "serif" | "sans-serif" | "monospace";
  layout: "single-column" | "two-column" | "card-based" | "magazine";
};

export type VisionResult = {
  analysis: string;
  colors: StyleColors | null;
};

const VISION_PROMPT = `請仔細分析這張報表 / 簡報的視覺風格。

**只輸出嚴格 JSON**（第一個字必須是 \`{\`，最後一個字是 \`}\`，不要包 \`\`\`json 也不要任何前言/結語/說明）：

{
  "bg": "#XXXXXX",
  "fg": "#XXXXXX",
  "accent": "#XXXXXX",
  "surface": "#XXXXXX",
  "headingFont": "serif" | "sans-serif" | "monospace",
  "bodyFont": "serif" | "sans-serif" | "monospace",
  "layout": "single-column" | "two-column" | "card-based" | "magazine",
  "analysis": "200-400 字的繁體中文風格描述..."
}

規則：
- bg = 整體背景色
- fg = 主要文字顏色
- accent = 標題或強調用的顏色（不是 bg/fg）
- surface = 卡片或區塊背景色（如果跟 bg 一樣就填一樣的）
- 顏色必須是 hex（例 "#FAFAF7"），不能用色名
- analysis 要寫：整體調性、字級層級、章節分隔感、特殊元素（表格/引言/方塊）、整體美學標籤（極簡 / 企業 / 編輯誌 / 數據 / 活潑 / 經典）`;

function safeColor(s: unknown, fallback: string): string {
  if (typeof s !== "string") return fallback;
  if (!/^#[0-9a-fA-F]{3,8}$/.test(s)) return fallback;
  return s;
}

function safeFont(s: unknown): "serif" | "sans-serif" | "monospace" {
  if (s === "serif" || s === "sans-serif" || s === "monospace") return s;
  return "sans-serif";
}

function safeLayout(s: unknown): StyleColors["layout"] {
  if (s === "single-column" || s === "two-column" || s === "card-based" || s === "magazine") return s;
  return "single-column";
}

export async function analyzeStyleFromImage(
  buffer: Buffer,
  mimeType: string
): Promise<VisionResult> {
  const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!allowed.includes(mimeType)) {
    throw new Error(`不支援的圖片格式：${mimeType}`);
  }
  const base64 = buffer.toString("base64");
  const client = await anthropic();

  const response = await client.messages.create({
    model: CHAT_MODEL,
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType, data: base64 },
          },
          { type: "text", text: VISION_PROMPT },
        ],
      },
    ],
  });

  const block = response.content[0];
  if (!block || block.type !== "text" || !block.text) {
    throw new Error("Vision 沒回應內容");
  }

  const raw = block.text.trim();

  // Try to find JSON in response (in case AI wraps with markdown despite instructions)
  let parsed: Record<string, unknown> | null = null;
  const directParse = tryParse(raw);
  if (directParse) {
    parsed = directParse;
  } else {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) parsed = tryParse(match[0]);
  }

  let analysis = raw;
  let colors: StyleColors | null = null;

  if (parsed) {
    if (typeof parsed.analysis === "string") analysis = parsed.analysis;
    colors = {
      bg: safeColor(parsed.bg, "#fcfcf9"),
      fg: safeColor(parsed.fg, "#1a1a18"),
      accent: safeColor(parsed.accent, "#1a1a18"),
      surface: safeColor(parsed.surface, safeColor(parsed.bg, "#ffffff")),
      headingFont: safeFont(parsed.headingFont),
      bodyFont: safeFont(parsed.bodyFont),
      layout: safeLayout(parsed.layout),
    };
  }

  return { analysis, colors };
}

function tryParse(s: string): Record<string, unknown> | null {
  try {
    const obj = JSON.parse(s);
    return typeof obj === "object" && obj !== null ? (obj as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
