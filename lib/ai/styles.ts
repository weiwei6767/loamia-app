import type { Lang } from "./report";

export type StyleKey = "minimal" | "corporate" | "editorial" | "data" | "vibrant" | "classic";

export type StyleDef = {
  key: StyleKey;
  zh: string;
  en: string;
  desc: { zh: string; en: string };
  // SVG preview (160x100 viewBox, neutral)
  preview: string;
  // CSS to apply to report container
  css: {
    bg: string;
    fg: string;
    accent: string;
    surface: string;
    fontHeading: string;
    fontBody: string;
  };
  // Hint added to AI prompt for content generation
  promptHint: { zh: string; en: string };
};

export const STYLES: Record<StyleKey, StyleDef> = {
  minimal: {
    key: "minimal",
    zh: "極簡白",
    en: "Minimal",
    desc: { zh: "白底大量留白、襯線標題", en: "White, generous whitespace, serif headlines" },
    preview: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="100" fill="#FFFFFF"/>
      <rect x="20" y="22" width="60" height="6" fill="#111111"/>
      <rect x="20" y="36" width="100" height="2" fill="#E5E5E5"/>
      <rect x="20" y="46" width="80" height="2" fill="#E5E5E5"/>
      <rect x="20" y="56" width="90" height="2" fill="#E5E5E5"/>
      <rect x="20" y="74" width="40" height="6" fill="#111111"/>
    </svg>`,
    css: {
      bg: "#fcfcf9",
      fg: "#1a1a18",
      accent: "#111111",
      surface: "#ffffff",
      fontHeading: "Georgia, 'Playfair Display', serif",
      fontBody: "system-ui, -apple-system, sans-serif",
    },
    promptHint: {
      zh: "標題簡短有力，段落留白多，避免過度修飾",
      en: "Concise headlines, ample whitespace, avoid over-decoration",
    },
  },
  corporate: {
    key: "corporate",
    zh: "企業級",
    en: "Corporate",
    desc: { zh: "深藍灰、結構化、嚴謹", en: "Navy/gray, structured, conservative" },
    preview: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="100" fill="#F5F7FA"/>
      <rect x="0" y="0" width="160" height="20" fill="#1E3A5F"/>
      <rect x="20" y="6" width="40" height="8" fill="#FFFFFF"/>
      <rect x="20" y="32" width="50" height="5" fill="#1E3A5F"/>
      <rect x="20" y="44" width="120" height="2" fill="#C5CCD3"/>
      <rect x="20" y="52" width="100" height="2" fill="#C5CCD3"/>
      <rect x="20" y="60" width="110" height="2" fill="#C5CCD3"/>
      <rect x="20" y="78" width="20" height="12" fill="#1E3A5F"/>
      <rect x="44" y="78" width="20" height="12" fill="#4A6B8A"/>
      <rect x="68" y="78" width="20" height="12" fill="#7894AE"/>
    </svg>`,
    css: {
      bg: "#f5f7fa",
      fg: "#1e3a5f",
      accent: "#1e3a5f",
      surface: "#ffffff",
      fontHeading: "system-ui, -apple-system, sans-serif",
      fontBody: "system-ui, -apple-system, sans-serif",
    },
    promptHint: {
      zh: "結構化、邏輯清晰、適度使用編號清單",
      en: "Structured, logical, judicious use of numbered lists",
    },
  },
  editorial: {
    key: "editorial",
    zh: "編輯誌",
    en: "Editorial",
    desc: { zh: "雜誌式、大標題、敘事感", en: "Magazine-like, big headlines, narrative" },
    preview: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="100" fill="#FAF7F2"/>
      <rect x="20" y="14" width="120" height="14" fill="#2C2018"/>
      <rect x="20" y="34" width="60" height="2" fill="#8B6F4E"/>
      <rect x="20" y="46" width="55" height="2" fill="#3C2E22"/>
      <rect x="20" y="54" width="55" height="2" fill="#3C2E22"/>
      <rect x="20" y="62" width="50" height="2" fill="#3C2E22"/>
      <rect x="85" y="46" width="55" height="44" fill="#D4B996"/>
    </svg>`,
    css: {
      bg: "#faf7f2",
      fg: "#2c2018",
      accent: "#8b6f4e",
      surface: "#ffffff",
      fontHeading: "Georgia, 'Playfair Display', serif",
      fontBody: "Georgia, serif",
    },
    promptHint: {
      zh: "敘事性強、可用引言/小故事開頭、文學感",
      en: "Narrative, may use anecdotal openings, literary tone",
    },
  },
  data: {
    key: "data",
    zh: "數據導向",
    en: "Data-driven",
    desc: { zh: "表格密集、數字優先", en: "Table-dense, numbers first" },
    preview: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="100" fill="#0F1419"/>
      <rect x="14" y="14" width="50" height="6" fill="#00E5A0"/>
      <rect x="14" y="28" width="132" height="1" fill="#2A3340"/>
      <g fill="#7AE3C0">
        <rect x="14" y="36" width="14" height="8"/>
        <rect x="32" y="36" width="14" height="8"/>
        <rect x="50" y="36" width="14" height="8"/>
        <rect x="68" y="36" width="14" height="8"/>
        <rect x="86" y="36" width="14" height="8"/>
      </g>
      <g fill="#3A4858">
        <rect x="14" y="50" width="20" height="3"/>
        <rect x="38" y="50" width="20" height="3"/>
        <rect x="62" y="50" width="20" height="3"/>
        <rect x="86" y="50" width="20" height="3"/>
      </g>
      <rect x="14" y="62" width="100" height="1" fill="#2A3340"/>
      <rect x="14" y="70" width="40" height="20" fill="#1A4A3A"/>
      <rect x="60" y="70" width="40" height="20" fill="#1A4A3A"/>
      <rect x="106" y="70" width="40" height="20" fill="#1A4A3A"/>
    </svg>`,
    css: {
      bg: "#0f1419",
      fg: "#e8eef4",
      accent: "#00e5a0",
      surface: "#1a232e",
      fontHeading: "'JetBrains Mono', monospace",
      fontBody: "system-ui, -apple-system, sans-serif",
    },
    promptHint: {
      zh: "每段以數字開頭，多用 Markdown 表格，KPI 強調",
      en: "Lead each section with numbers, use Markdown tables, emphasize KPIs",
    },
  },
  vibrant: {
    key: "vibrant",
    zh: "鮮活",
    en: "Vibrant",
    desc: { zh: "漸層配色、現代、有能量", en: "Gradients, modern, energetic" },
    preview: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#FF6B6B"/>
          <stop offset="0.5" stop-color="#FFD93D"/>
          <stop offset="1" stop-color="#6BCB77"/>
        </linearGradient>
      </defs>
      <rect width="160" height="100" fill="url(#g1)"/>
      <rect x="14" y="14" width="132" height="72" rx="6" fill="#FFFFFF" opacity="0.96"/>
      <rect x="24" y="24" width="50" height="6" fill="#FF6B6B"/>
      <rect x="24" y="38" width="100" height="2" fill="#666"/>
      <rect x="24" y="46" width="90" height="2" fill="#666"/>
      <rect x="24" y="58" width="20" height="14" fill="#FF6B6B"/>
      <rect x="48" y="58" width="20" height="14" fill="#FFD93D"/>
      <rect x="72" y="58" width="20" height="14" fill="#6BCB77"/>
    </svg>`,
    css: {
      bg: "#fff5f0",
      fg: "#2d1b3d",
      accent: "#ff6b6b",
      surface: "#ffffff",
      fontHeading: "system-ui, -apple-system, sans-serif",
      fontBody: "system-ui, -apple-system, sans-serif",
    },
    promptHint: {
      zh: "活潑用詞、適度使用 emoji、項目清單豐富",
      en: "Lively language, modest emoji use, rich bullet lists",
    },
  },
  classic: {
    key: "classic",
    zh: "經典顧問",
    en: "Classic",
    desc: { zh: "傳統顧問報告、襯線、嚴謹", en: "Traditional consulting, serif, rigorous" },
    preview: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="100" fill="#FAFAF7"/>
      <rect x="20" y="16" width="120" height="1" fill="#1A1A1A"/>
      <rect x="20" y="22" width="80" height="6" fill="#1A1A1A"/>
      <rect x="20" y="34" width="120" height="1" fill="#888"/>
      <rect x="20" y="44" width="80" height="2" fill="#1A1A1A"/>
      <rect x="20" y="52" width="120" height="2" fill="#444"/>
      <rect x="20" y="60" width="120" height="2" fill="#444"/>
      <rect x="20" y="68" width="100" height="2" fill="#444"/>
      <rect x="20" y="84" width="120" height="1" fill="#1A1A1A"/>
    </svg>`,
    css: {
      bg: "#fafaf7",
      fg: "#1a1a1a",
      accent: "#5a4a32",
      surface: "#ffffff",
      fontHeading: "'Times New Roman', Times, serif",
      fontBody: "'Times New Roman', Times, serif",
    },
    promptHint: {
      zh: "嚴謹用詞、邏輯三段論、引用權威資料",
      en: "Rigorous language, logical argumentation, cite authoritative data",
    },
  },
};

export const STYLE_KEYS = Object.keys(STYLES) as StyleKey[];

export function getStyleHint(key: StyleKey | undefined, lang: Lang): string {
  if (!key) return "";
  const s = STYLES[key];
  return s ? s.promptHint[lang] : "";
}

export function isValidStyle(s: unknown): s is StyleKey {
  return typeof s === "string" && s in STYLES;
}
