import "server-only";
import { embed } from "./embeddings";
import mammoth from "mammoth";

export type ExtractInput = {
  buffer: Buffer;
  mimeType?: string | null;
  filename: string;
};

export async function extractText({ buffer, mimeType, filename }: ExtractInput): Promise<string> {
  const lower = filename.toLowerCase();
  const isPdf = mimeType === "application/pdf" || lower.endsWith(".pdf");
  const isDocx =
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx");

  if (isPdf) {
    const mod = await import("pdf-parse");
    const pdfParse = (mod as { default?: unknown }).default ?? mod;
    const fn = pdfParse as (b: Buffer) => Promise<{ text: string }>;
    const result = await fn(buffer);
    return result.text;
  }

  if (isDocx) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // Default: treat as UTF-8 text
  return buffer.toString("utf-8");
}

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

export function chunkText(text: string): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length === 0) return [];
  if (cleaned.length <= CHUNK_SIZE) return [cleaned];

  const chunks: string[] = [];
  let pos = 0;
  while (pos < cleaned.length) {
    const end = Math.min(pos + CHUNK_SIZE, cleaned.length);
    let slice = cleaned.slice(pos, end);
    const isLast = end >= cleaned.length;

    if (!isLast) {
      const lastBreak = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf("。"),
        slice.lastIndexOf(". "),
        slice.lastIndexOf("\n")
      );
      if (lastBreak > CHUNK_SIZE / 2) {
        slice = slice.slice(0, lastBreak + 1);
      }
    }

    chunks.push(slice.trim());
    if (isLast) break;

    pos += Math.max(1, slice.length - CHUNK_OVERLAP);
  }
  return chunks.filter((c) => c.length > 0);
}

export async function buildChunkRows(
  chunks: string[],
  documentId: string,
  brandId: string,
  agencyId: string
) {
  if (chunks.length === 0) return [];

  // Batch embeddings (OpenAI accepts up to 2048 inputs per call, but keep safer)
  const BATCH = 64;
  const embeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const out = await embed(batch);
    embeddings.push(...out);
  }

  return chunks.map((content, idx) => ({
    document_id: documentId,
    brand_id: brandId,
    agency_id: agencyId,
    chunk_index: idx,
    content,
    embedding: embeddings[idx],
  }));
}
