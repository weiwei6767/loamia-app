"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractText, chunkText, buildChunkRows } from "@/lib/ai/ingest";

export type UploadState = { error?: string; success?: string } | undefined;

export async function uploadDocument(
  _state: UploadState,
  formData: FormData
): Promise<UploadState> {
  const file = formData.get("file") as File | null;
  const brandId = String(formData.get("brandId") ?? "");
  if (!file || file.size === 0) return { error: "請選擇檔案" };
  if (!brandId) return { error: "缺少 brandId" };
  if (file.size > 50 * 1024 * 1024) return { error: "檔案不能超過 50MB" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "未登入" };

  const { data: brand } = await supabase
    .from("brands")
    .select("id, agency_id")
    .eq("id", brandId)
    .single();
  if (!brand) return { error: "品牌不存在或無權限" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, "");
  const storagePath = `${brand.agency_id}/${brand.id}/${Date.now()}-${crypto.randomUUID()}${safeExt}`;

  const { error: uploadErr } = await supabase.storage
    .from("documents")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });
  if (uploadErr) return { error: `上傳失敗：${uploadErr.message}` };

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
    })
    .select()
    .single();
  if (docErr || !doc) return { error: docErr?.message ?? "建立 document 失敗" };

  try {
    console.log(`[ingest] start ${file.name} (${file.size}B, ${file.type})`);
    const text = await extractText({ buffer, mimeType: file.type, filename: file.name });
    console.log(`[ingest] extracted ${text.length} chars`);
    if (!text.trim()) throw new Error("檔案沒有可讀文字");

    const chunks = chunkText(text);
    console.log(`[ingest] chunked into ${chunks.length} pieces`);

    const rows = await buildChunkRows(chunks, doc.id, brand.id, brand.agency_id);
    console.log(`[ingest] embedded ${rows.length} chunks`);

    if (rows.length > 0) {
      const { error: chunkErr } = await supabase.from("document_chunks").insert(rows);
      if (chunkErr) throw new Error(`DB insert: ${chunkErr.message}`);
    }

    await supabase.from("documents").update({ status: "ready" }).eq("id", doc.id);
    console.log(`[ingest] done ${file.name}`);
  } catch (err) {
    console.error(`[ingest] failed ${file.name}:`, err);
    const msg = err instanceof Error ? `${err.message}${err.cause ? ` (cause: ${err.cause})` : ""}` : "ingest 失敗";
    await supabase
      .from("documents")
      .update({ status: "error", error_message: msg })
      .eq("id", doc.id);
    return { error: msg };
  }

  revalidatePath(`/brand/${brandId}`);
  return { success: `已處理：${file.name}` };
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
