"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractText, chunkText, buildChunkRows } from "@/lib/ai/ingest";

export type UploadState = { error?: string; success?: string } | undefined;

async function ingestSingleFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  file: File,
  brand: { id: string; agency_id: string }
): Promise<{ ok: true; filename: string } | { ok: false; filename: string; error: string }> {
  if (file.size === 0) return { ok: false, filename: file.name, error: "空檔案" };
  if (file.size > 50 * 1024 * 1024) return { ok: false, filename: file.name, error: "超過 50MB" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, "");
  const storagePath = `${brand.agency_id}/${brand.id}/${Date.now()}-${crypto.randomUUID()}${safeExt}`;

  const { error: uploadErr } = await supabase.storage
    .from("documents")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });
  if (uploadErr) return { ok: false, filename: file.name, error: `上傳失敗：${uploadErr.message}` };

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .insert({
      brand_id: brand.id,
      agency_id: brand.agency_id,
      filename: file.name,
      storage_path: storagePath,
      mime_type: file.type,
      byte_size: file.size,
      status: "processing",
      progress_pct: 5,
    })
    .select()
    .single();
  if (docErr || !doc) return { ok: false, filename: file.name, error: docErr?.message ?? "建立 document 失敗" };

  const setProgress = async (pct: number) => {
    await supabase.from("documents").update({ progress_pct: pct }).eq("id", doc.id);
  };

  try {
    console.log(`[ingest] start ${file.name} (${file.size}B, ${file.type})`);
    await setProgress(15);
    const text = await extractText({ buffer, mimeType: file.type, filename: file.name });
    console.log(`[ingest] extracted ${text.length} chars`);
    if (!text.trim()) throw new Error("檔案沒有可讀文字");
    await setProgress(35);

    const chunks = chunkText(text);
    console.log(`[ingest] chunked into ${chunks.length} pieces`);
    await setProgress(50);

    const rows = await buildChunkRows(chunks, doc.id, brand.id, brand.agency_id);
    console.log(`[ingest] embedded ${rows.length} chunks`);
    await setProgress(90);

    if (rows.length > 0) {
      const { error: chunkErr } = await supabase.from("document_chunks").insert(rows);
      if (chunkErr) throw new Error(`DB insert: ${chunkErr.message}`);
    }

    await supabase
      .from("documents")
      .update({ status: "ready", progress_pct: 100 })
      .eq("id", doc.id);
    console.log(`[ingest] done ${file.name}`);
    return { ok: true, filename: file.name };
  } catch (err) {
    console.error(`[ingest] failed ${file.name}:`, err);
    const msg = err instanceof Error ? err.message : "ingest 失敗";
    await supabase
      .from("documents")
      .update({ status: "error", error_message: msg, progress_pct: 0 })
      .eq("id", doc.id);
    return { ok: false, filename: file.name, error: msg };
  }
}

export async function uploadDocument(
  _state: UploadState,
  formData: FormData
): Promise<UploadState> {
  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  const brandId = String(formData.get("brandId") ?? "");

  if (files.length === 0) return { error: "請選擇檔案" };
  if (!brandId) return { error: "缺少 brandId" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "未登入" };

  const { data: brand } = await supabase
    .from("brands")
    .select("id, agency_id")
    .eq("id", brandId)
    .single();
  if (!brand) return { error: "品牌不存在或無權限" };

  const results = await Promise.all(
    files.map((f) => ingestSingleFile(supabase, f, brand))
  );

  const successes = results.filter((r) => r.ok);
  const failures = results.filter((r): r is { ok: false; filename: string; error: string } => !r.ok);

  revalidatePath(`/brand/${brandId}`);

  if (failures.length > 0) {
    const detail = failures.map((f) => `${f.filename}：${f.error}`).join("\n");
    if (successes.length === 0) return { error: detail };
    return {
      success: `成功 ${successes.length} 個 / 失敗 ${failures.length} 個`,
      error: detail,
    } as unknown as UploadState;
  }

  return { success: `已處理 ${successes.length} 個檔案` };
}

export async function deleteDocument(documentId: string, brandId: string) {
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", documentId)
    .single();

  if (doc?.storage_path) {
    await supabase.storage.from("documents").remove([doc.storage_path]);
  }
  await supabase.from("documents").delete().eq("id", documentId);
  revalidatePath(`/brand/${brandId}`);
  revalidatePath(`/brand/${brandId}/data`);
}

export type DocumentPreview = {
  ok: true;
  filename: string;
  mimeType: string | null;
  signedUrl: string;
  textContent: string | null;
  truncated: boolean;
} | { ok: false; error: string };

export async function getDocumentPreview(documentId: string): Promise<DocumentPreview> {
  const supabase = await createClient();
  const { data: doc, error } = await supabase
    .from("documents")
    .select("filename, storage_path, mime_type")
    .eq("id", documentId)
    .single();
  if (error || !doc) return { ok: false, error: error?.message ?? "找不到文件" };
  const storagePath = doc.storage_path as string | null;
  if (!storagePath) return { ok: false, error: "此文件沒有原始檔案" };

  const { data: signed, error: signErr } = await supabase.storage
    .from("documents")
    .createSignedUrl(storagePath, 600); // 10 minutes
  if (signErr || !signed?.signedUrl) {
    return { ok: false, error: signErr?.message ?? "產生連結失敗" };
  }

  const mime = (doc.mime_type as string | null) ?? "";
  const isTextLike =
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "" ||
    storagePath.toLowerCase().endsWith(".txt") ||
    storagePath.toLowerCase().endsWith(".md") ||
    storagePath.toLowerCase().endsWith(".csv");

  let textContent: string | null = null;
  let truncated = false;
  if (isTextLike) {
    const { data: blob, error: dlErr } = await supabase.storage
      .from("documents")
      .download(storagePath);
    if (!dlErr && blob) {
      const buf = Buffer.from(await blob.arrayBuffer());
      const raw = buf.toString("utf-8");
      const MAX = 50_000;
      if (raw.length > MAX) {
        textContent = raw.slice(0, MAX);
        truncated = true;
      } else {
        textContent = raw;
      }
    }
  }

  return {
    ok: true,
    filename: doc.filename as string,
    mimeType: mime || null,
    signedUrl: signed.signedUrl,
    textContent,
    truncated,
  };
}

export async function updateDocumentTags(
  documentId: string,
  brandId: string,
  tags: string[]
): Promise<void> {
  const cleaned = tags
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .slice(0, 20);
  const supabase = await createClient();
  await supabase
    .from("documents")
    .update({ tags: cleaned.length > 0 ? cleaned : null })
    .eq("id", documentId);
  revalidatePath(`/brand/${brandId}/data`);
}

export async function deleteDocumentsBatch(documentIds: string[], brandId: string) {
  if (documentIds.length === 0) return;
  const supabase = await createClient();

  const { data: docs } = await supabase
    .from("documents")
    .select("id, storage_path")
    .in("id", documentIds);

  if (docs && docs.length > 0) {
    const paths = docs
      .map((d) => d.storage_path as string | null)
      .filter((p): p is string => Boolean(p));
    if (paths.length > 0) {
      await supabase.storage.from("documents").remove(paths);
    }
    await supabase
      .from("documents")
      .delete()
      .in("id", docs.map((d) => d.id as string));
  }

  revalidatePath(`/brand/${brandId}`);
  revalidatePath(`/brand/${brandId}/data`);
}

export async function deleteThread(threadId: string, brandId: string) {
  const supabase = await createClient();
  await supabase.from("chat_threads").delete().eq("id", threadId);
  revalidatePath(`/brand/${brandId}`);
  redirect(`/brand/${brandId}`);
}

export async function setBrandStatus(brandId: string, status: "active" | "archived") {
  const supabase = await createClient();
  await supabase.from("brands").update({ status }).eq("id", brandId);
  revalidatePath(`/brand/${brandId}`);
  revalidatePath("/dashboard");
}

export async function renameThread(threadId: string, brandId: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) return;
  const supabase = await createClient();
  await supabase.from("chat_threads").update({ title: trimmed.slice(0, 80) }).eq("id", threadId);
  revalidatePath(`/brand/${brandId}`);
}
