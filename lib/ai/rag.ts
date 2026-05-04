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

## 品牌資料庫片段
${context}`;
}
