import "server-only";
import { embed } from "./embeddings";
import mammoth from "mammoth";

export type ExtractInput = {
  buffer: Buffer;
  mimeType?: string | null;
  filename: string;
};

const MIME_PDF = "application/pdf";
const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MIME_XLS = "application/vnd.ms-excel";
const MIME_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const MIME_PPT = "application/vnd.ms-powerpoint";
const MIME_CSV = "text/csv";

function endsWith(filename: string, exts: string[]): boolean {
  const lower = filename.toLowerCase();
  return exts.some((e) => lower.endsWith(e));
}

export async function extractText({ buffer, mimeType, filename }: ExtractInput): Promise<string> {
  const mime = mimeType ?? "";

  if (mime === MIME_PDF || endsWith(filename, [".pdf"])) {
    const { extractText } = await import("unpdf");
    const result = await extractText(new Uint8Array(buffer));
    if (Array.isArray(result.text)) return result.text.join("\n");
    return String(result.text ?? "");
  }

  if (mime === MIME_DOCX || endsWith(filename, [".docx"])) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (
    mime === MIME_XLSX ||
    mime === MIME_XLS ||
    mime === MIME_CSV ||
    endsWith(filename, [".xlsx", ".xls", ".csv"])
  ) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buffer, { type: "buffer" });
    const parts: string[] = [];
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      if (csv.trim()) {
        parts.push(`## ${sheetName}\n${csv}`);
      }
    }
    return parts.join("\n\n");
  }

  if (mime === MIME_PPTX || mime === MIME_PPT || endsWith(filename, [".pptx", ".ppt"])) {
    return extractPptx(buffer);
  }

  // Default: treat as UTF-8 text
  return buffer.toString("utf-8");
}

async function extractPptx(buffer: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const aNum = parseInt(a.match(/slide(\d+)/)?.[1] ?? "0", 10);
      const bNum = parseInt(b.match(/slide(\d+)/)?.[1] ?? "0", 10);
      return aNum - bNum;
    });

  const slides: string[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const name = slideFiles[i];
    const file = zip.files[name];
    if (!file) continue;
    const xml = await file.async("text");
    const matches = xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g);
    const text = Array.from(matches)
      .map((m) => decodeXmlEntities(m[1]))
      .filter(Boolean)
      .join("\n");
    if (text) slides.push(`## Slide ${i + 1}\n${text}`);
  }
  return slides.join("\n\n");
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
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
