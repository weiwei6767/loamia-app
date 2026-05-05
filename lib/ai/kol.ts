import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anthropic, CHAT_MODEL } from "./anthropic";
import { assembleBrandBrainContext, formatBrandBrainPrompt } from "./brand-brain";

export type KolForBrief = {
  name: string;
  handle: string | null;
  platform: string | null;
  followers: number | null;
  niche_tags: string[] | null;
  rate_note: string | null;
  campaign_name: string | null;
};

export async function generateKolBrief(
  supabase: SupabaseClient,
  brandId: string,
  brandName: string,
  kol: KolForBrief
): Promise<string> {
  const brain = await assembleBrandBrainContext(supabase, brandId);
  const brainBlock = brain ? formatBrandBrainPrompt(brain) : "";

  const kolLines: string[] = [];
  kolLines.push(`- 顯示名稱：${kol.name}`);
  if (kol.handle) kolLines.push(`- 帳號：@${kol.handle}`);
  if (kol.platform) kolLines.push(`- 主要平台：${kol.platform}`);
  if (kol.followers != null) kolLines.push(`- 粉絲數：${kol.followers.toLocaleString()}`);
  if (kol.niche_tags && kol.niche_tags.length > 0)
    kolLines.push(`- 領域 / 標籤：${kol.niche_tags.join("、")}`);
  if (kol.rate_note) kolLines.push(`- 已知費率：${kol.rate_note}`);

  const systemPrompt = `你是 Loamia 的 KOL 合作 Brief 撰寫助理，為「${brandName}」與下方 KOL 撰寫一份**結構完整、可直接寄出**的合作 Brief。

## 寫作目標
這份 brief 是要寄給該 KOL 看的，因此要：
- 用合作邀約的口吻（尊重、清楚、有誠意），不是內部備忘錄
- 簡潔但有重點，不囉嗦
- 用繁體中文

## 必含結構（依此順序）
1. **合作目標**（1 段，30–60 字）
2. **關於品牌**（1 段：呼應 Brand Identity 的定位 + 一兩個品牌亮點，60–100 字）
3. **為什麼選擇你**（1 段，連結 KOL 的領域 / 受眾與品牌定位，30–60 字）
4. **建議內容方向**（3 個 bullet，每個一句話，可選的角度／創意切入）
5. **規範與避諱**
   - 必提：[列舉 brand identity 重點、禁忌詞]
   - 必避：（從 Brand Brain Identity 的 taboo_words 提取）
6. **時程／素材／費用建議**（簡短列點，提醒「實際以正式合約為準」）
7. **聯絡與下一步**（簡短）

## 內容規則
- 數字、KPI、過往案例**只能來自下方 Brand Brain 資料**，沒有就不寫具體數字
- 「為什麼選擇你」段落要具體連結 KOL 的領域，不要模糊套話
- 整體長度約 400–700 字
- 不使用 emoji
- 結尾不要署名（讓 AE 自己加）`;

  const userMessage = `${brainBlock ? `# Brand Brain\n${brainBlock}\n\n` : ""}# KOL 資訊
${kolLines.join("\n")}

# 本次合作主題（campaign）
${kol.campaign_name ? kol.campaign_name : "（未指定，請給通用合作邀約版本）"}

請輸出純文字 Brief（不需 Markdown 標題符號 #）。`;

  const client = await anthropic();
  const stream = client.messages.stream({
    model: CHAT_MODEL,
    max_tokens: 2500,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  let raw = "";
  for await (const event of stream) {
    if (event.type !== "content_block_delta") continue;
    if (event.delta?.type !== "text_delta") continue;
    if (event.delta.text) raw += event.delta.text;
  }

  return raw.trim();
}
