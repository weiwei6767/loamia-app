import "server-only";
import { anthropic, CHAT_MODEL } from "./anthropic";

type VisionResult = {
  analysis: string;
};

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
            source: {
              type: "base64",
              media_type: mimeType,
              data: base64,
            },
          },
          {
            type: "text",
            text: `請分析這張報表 / 簡報的視覺風格，產出一段「風格指引」，會用來指導 AI 產生類似風格的內容。

請依序描述：
1. **整體配色**：背景色、主要文字色、強調色（盡量描述具體色感或大致色相，例：「深藍底配橘色強調」）
2. **字型風格**：襯線 / 無襯線、是否使用等寬字體、粗細層級
3. **排版**：單欄 / 多欄、留白程度、對齊方式、章節分隔感
4. **元素特色**：標題如何呈現、是否大量使用表格、圖表類型偏好、是否有引言/案例方塊
5. **整體調性**：極簡 / 企業正式 / 編輯雜誌 / 數據導向 / 活潑 / 經典 / 其他

用繁體中文寫，200-400 字。直接寫風格描述，不要前言（例如「這張圖...」），假設讀者是另一個 AI。`,
          },
        ],
      },
    ],
  });

  const block = response.content[0];
  if (!block || block.type !== "text" || !block.text) {
    throw new Error("Vision 沒回應內容");
  }
  return { analysis: block.text };
}
