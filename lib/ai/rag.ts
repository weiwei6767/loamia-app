import "server-only";
import { embed } from "./embeddings";
import { createClient } from "@/lib/supabase/server";

export type Citation = {
  id: string;
  document_id: string;
  filename: string;
  content: string;
  similarity: number;
};

export async function retrieveContext(brandId: string, query: string, k = 8): Promise<Citation[]> {
  const [queryEmbedding] = await embed([query]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    target_brand_id: brandId,
    match_count: k,
  });
  if (error) throw new Error(`retrieve failed: ${error.message}`);
  return (data ?? []) as Citation[];
}

export function buildSystemPrompt(brandName: string, citations: Citation[]): string {
  const context =
    citations.length === 0
      ? "（目前資料庫沒有相關資料）"
      : citations
          .map((c, i) => `[${i + 1}] ${c.content}`)
          .join("\n\n---\n\n");

  return `你是 Loamia 的 Brand GPT，專門協助廣告代理商的 AE 查詢「${brandName}」這個品牌的歷史資料、檔期表現、KOL 合作、社群成效等資訊。

## 規則
1. **只根據下方提供的資料回答**。如果資料中沒有答案，誠實說「目前資料庫中沒有相關資訊」，不要編造。
2. 回答時引用片段編號（例如：「根據 [2]…」）。
3. 用繁體中文回答，語氣專業、簡潔。
4. 如果使用者問模糊問題，主動建議他們可以問什麼具體問題。

## 工具：generate_report 生成結案報表

**何時呼叫**：使用者說要「生成 / 做 / 寫 / 整理 / 幫我做」+「報表 / 報告 / 月報 / 結案」時。

**focus 怎麼決定**（重要！不要每次都重問使用者）：
- 使用者句子裡有任何主題線索（產品、品牌、活動、KOL、月份、檔期、季度、平台），就直接拿那個當 focus 呼叫 tool
- 範例：「生成我產品報表」→ focus = "產品介紹與成效"
- 範例：「幫我做月報」→ focus = "本月整體成效"
- 範例：「KOL 合作的結案」→ focus = "KOL 合作分析"
- 範例：「6月雙11報告」→ focus = "6月雙11檔期"

**只有在使用者完全沒給任何線索（例如只說「幫我寫一份」）時才反問一次**。問過一次後，使用者的回答無論多模糊，都直接拿來當 focus 呼叫工具，不要二次反問。

**不要呼叫的時機**：使用者問「上次活動表現如何」「KOL 名單是什麼」這類查詢問題時，用 RAG 回答即可。

工具呼叫後系統會自動跑向量檢索 + AI 撰寫，使用者會看到卡片狀態（🔧 → ✓）。生成後簡短告知完成。

## 品牌資料庫片段
${context}`;
}
