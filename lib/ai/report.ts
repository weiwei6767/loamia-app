import "server-only";
import { createClient } from "@/lib/supabase/server";
import { anthropic, CHAT_MODEL } from "./anthropic";

export type ReportCitation = {
  id: string;
  document_id: string;
  filename: string;
  chunk_index: number;
};

export async function generateReportContent(
  brandId: string,
  brandName: string,
  focus: string
): Promise<{ content: string; citations: ReportCitation[] }> {
  const supabase = await createClient();

  const { data: chunks, error } = await supabase
    .from("document_chunks")
    .select("id, document_id, chunk_index, content, documents(filename)")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(120);

  if (error) throw new Error(`load chunks: ${error.message}`);
  if (!chunks || chunks.length === 0) throw new Error("no_documents");

  const citations: ReportCitation[] = chunks.map((c) => ({
    id: c.id as string,
    document_id: c.document_id as string,
    filename: ((c.documents as unknown as { filename: string })?.filename) ?? "",
    chunk_index: c.chunk_index as number,
  }));

  const contextBlock = chunks
    .map((c, i) => `[${i + 1}] ${c.content}`)
    .join("\n\n---\n\n");

  const focusLine = focus.trim()
    ? `\n\n【使用者主題重點】\n${focus.trim()}\n`
    : "";

  const systemPrompt = `你是 Loamia 的結案報表生成助理。基於提供的品牌資料，為「${brandName}」產出一份結構化的月度結案報告。

## 結構（用 Markdown 標題）
# ${brandName} 結案報告

## 執行摘要
（3-5 行的高層級重點）

## 本期活動
（具體做了什麼，列點）

## 關鍵成效
（量化數據，來自資料）

## 觀察與洞察
（從資料中歸納的趨勢、異常）

## 下期建議
（具體可執行的建議）

## 規則
1. **數字與事實只能來自下方提供的資料**，不要編造任何數字
2. 引用具體資料時用 [n] 格式（例如「IG 互動率達 5.7% [3]」）
3. 用繁體中文撰寫，語氣專業但非僵硬
4. 如果某個區塊在資料中找不到內容，誠實寫「**本期資料中暫無相關資訊**」，不要硬編
5. 整體 800-1500 字之間
6. 不要重複資料原文，要做歸納與分析${focusLine}

## 品牌資料
${contextBlock}`;

  const client = await anthropic();
  const response = await client.messages.stream({
    model: CHAT_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: focus.trim()
          ? `請依重點「${focus.trim()}」生成結案報告。`
          : "請生成本期結案報告。",
      },
    ],
  });

  let content = "";
  for await (const event of response) {
    if (event.type !== "content_block_delta") continue;
    if (event.delta?.type !== "text_delta") continue;
    const text = event.delta.text;
    if (text) content += text;
  }

  return { content, citations };
}

export function makeAutoTitle(brandName: string, focus: string): string {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (focus.trim()) {
    return `${brandName} · ${focus.trim().slice(0, 30)}（${ym}）`;
  }
  return `${brandName} · ${ym} 結案報告`;
}
