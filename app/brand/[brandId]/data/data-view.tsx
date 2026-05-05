"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadDocument, deleteDocument, deleteDocumentsBatch, updateDocumentTags } from "../actions";
import { useI18n } from "@/lib/i18n/provider";
import { UploadProgressList } from "../upload-progress";

type Doc = {
  id: string;
  filename: string;
  status: "pending" | "processing" | "ready" | "error" | string;
  byte_size: number | null;
  created_at: string;
  error_message: string | null;
  tags: string[] | null;
};

type StagedFile = {
  id: string;
  file: File;
};

type ToastStatus = "uploading" | "done" | "error";

type Toast = {
  id: string;
  filename: string;
  status: ToastStatus;
  error?: string;
};

const TOAST_AUTO_DISMISS_MS = 4000;

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function DataView({ brandId, documents }: { brandId: string; documents: Doc[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showList, setShowList] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const stats = {
    total: documents.length,
    ready: documents.filter((d) => d.status === "ready").length,
    processing: documents.filter((d) => d.status === "processing" || d.status === "pending").length,
    error: documents.filter((d) => d.status === "error").length,
  };

  function isAutoFetched(d: Doc): boolean {
    return (d.tags ?? []).includes("auto-fetched");
  }

  const allTags = Array.from(
    new Set(documents.flatMap((d) => d.tags ?? []))
  ).sort();

  const filteredDocs = documents.filter((d) => {
    if (search.trim() && !d.filename.toLowerCase().includes(search.toLowerCase())) return false;
    if (activeTags.size > 0) {
      const docTags = new Set(d.tags ?? []);
      for (const tag of activeTags) {
        if (!docTags.has(tag)) return false;
      }
    }
    return true;
  });

  const userDocs = filteredDocs.filter((d) => !isAutoFetched(d));
  const autoDocs = filteredDocs.filter((d) => isAutoFetched(d));

  function toggleTag(tag: string) {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    setStaged((prev) => [
      ...prev,
      ...arr.map((file) => ({ id: crypto.randomUUID(), file })),
    ]);
  }

  function removeStaged(id: string) {
    setStaged((prev) => prev.filter((s) => s.id !== id));
  }

  function clearStaged() {
    setStaged([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function updateToast(id: string, patch: Partial<Toast>) {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  async function uploadAll() {
    if (staged.length === 0 || uploading) return;
    setUploading(true);

    const items = staged.map((s) => {
      const toastId = crypto.randomUUID();
      return { staged: s, toastId };
    });

    setToasts((prev) => [
      ...prev,
      ...items.map(({ staged: s, toastId }) => ({
        id: toastId,
        filename: s.file.name,
        status: "uploading" as ToastStatus,
      })),
    ]);

    setStaged([]);
    if (fileInputRef.current) fileInputRef.current.value = "";

    await Promise.all(
      items.map(async ({ staged: s, toastId }) => {
        const fd = new FormData();
        fd.set("brandId", brandId);
        fd.set("file", s.file);
        try {
          const result = await uploadDocument(undefined, fd);
          if (result && "success" in result && result.success && !("error" in result && result.error)) {
            updateToast(toastId, { status: "done" });
            setTimeout(() => dismissToast(toastId), TOAST_AUTO_DISMISS_MS);
          } else if (result && "error" in result && result.error) {
            updateToast(toastId, { status: "error", error: result.error });
          } else {
            updateToast(toastId, { status: "done" });
            setTimeout(() => dismissToast(toastId), TOAST_AUTO_DISMISS_MS);
          }
        } catch (err) {
          updateToast(toastId, {
            status: "error",
            error: err instanceof Error ? err.message : "unknown",
          });
        }
      })
    );

    setUploading(false);
    router.refresh();
  }

  function handleDelete(docId: string) {
    if (!confirm(t("data.delete.confirm"))) return;
    startTransition(() => deleteDocument(docId, brandId));
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filteredDocs.length && filteredDocs.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredDocs.map((d) => d.id)));
    }
  }

  function handleBatchDelete() {
    if (selected.size === 0) return;
    if (!confirm(t("data.list.delete_confirm"))) return;
    const ids = Array.from(selected);
    setSelected(new Set());
    startTransition(() => deleteDocumentsBatch(ids, brandId));
  }

  return (
    <>
      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[var(--line)] mb-8">
        <StatCell label={t("data.stats.total")} value={stats.total} />
        <StatCell label={t("data.stats.ready")} value={stats.ready} accent />
        <StatCell label={t("data.stats.processing")} value={stats.processing} pulse />
        <StatCell label={t("data.stats.error")} value={stats.error} danger />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
        }}
        className={`relative border-2 border-dashed transition-all duration-200 ${
          dragOver ? "dropzone-active" : "border-[var(--line)] tech-grid-bg hover:border-[var(--accent)]/50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.md,.pdf,.docx,.xlsx,.xls,.csv,.pptx,.ppt"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label="upload"
        />
        <div className="relative pointer-events-none p-10 text-center">
          <div className="font-mono text-5xl text-[var(--accent)] mb-3 tracking-widest">▲</div>
          <div className="font-mono text-sm tracking-widest text-[var(--accent)]">
            {t("data.dropzone.title")}
          </div>
          <div className="mt-2 text-xs text-[var(--muted)]">
            {t("data.dropzone.or")}{" "}
            <span className="text-[var(--accent)] underline">{t("data.dropzone.click")}</span>
          </div>
          <div className="mt-4 text-[10px] tracking-wider text-[var(--muted)] font-mono">
            {t("data.dropzone.formats")}
          </div>
        </div>
      </div>

      {/* Staged files */}
      {staged.length > 0 && (
        <div className="mt-4 border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-mono text-xs tracking-widest text-[var(--accent)]">
              {t("data.staged.title")} · {staged.length}
            </div>
            <button
              type="button"
              onClick={clearStaged}
              className="text-xs text-[var(--muted)] hover:text-red-400"
            >
              {t("data.staged.clear")}
            </button>
          </div>
          <ul className="space-y-1.5 mb-4">
            {staged.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 text-sm bg-[var(--surface-2)] px-3 py-2"
              >
                <span className="truncate flex-1">{s.file.name}</span>
                <span className="text-xs text-[var(--muted)] shrink-0">
                  {formatSize(s.file.size)}
                </span>
                <button
                  type="button"
                  onClick={() => removeStaged(s.id)}
                  className="text-[var(--muted)] hover:text-red-400 px-1"
                  aria-label="remove"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={uploadAll}
            disabled={uploading}
            className="w-full sm:w-auto px-6 py-2 bg-[var(--accent)] text-[var(--background)] font-bold text-sm hover:bg-[var(--accent-glow)] disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {uploading ? <span className="spinner" /> : "↑"} {t("data.staged.upload")} · {staged.length}
          </button>
        </div>
      )}

      {/* Saved list (collapsed) */}
      <div className="mt-8">
        <button
          type="button"
          onClick={() => setShowList((v) => !v)}
          className="w-full text-left flex items-center justify-between px-4 py-3 border border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]/50 transition"
        >
          <span className="font-mono text-xs tracking-widest text-[var(--muted)]">
            {t("data.list.expand")} · {documents.length}
          </span>
          <span className="text-[var(--accent)] text-sm">{showList ? "▲" : "▼"}</span>
        </button>

        <UploadProgressList brandId={brandId} />

        {showList && (
          <div className="mt-3 space-y-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="text"
              placeholder={t("data.list.search")}
              className="w-full text-sm px-3 py-2 border border-[var(--line)] bg-[var(--surface-2)] focus:border-[var(--accent)] focus:outline-none"
            />

            {allTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-[var(--muted)] font-mono mr-1">標籤：</span>
                {allTags.map((tag) => {
                  const active = activeTags.has(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`text-[10px] px-2 py-1 border transition ${
                        active
                          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--background)] font-bold"
                          : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)]/50 hover:text-[var(--foreground)]"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
                {activeTags.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTags(new Set())}
                    className="text-[10px] text-[var(--muted)] hover:text-red-400 ml-1"
                  >
                    ✕ 清除標籤篩選
                  </button>
                )}
              </div>
            )}

            {filteredDocs.length > 0 && (
              <div className="flex items-center justify-between gap-2 py-1.5 px-2 border border-[var(--line)] bg-[var(--surface-2)]">
                <label className="flex items-center gap-2 text-xs text-[var(--muted)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.size === filteredDocs.length && filteredDocs.length > 0}
                    ref={(el) => {
                      if (el)
                        el.indeterminate =
                          selected.size > 0 && selected.size < filteredDocs.length;
                    }}
                    onChange={toggleSelectAll}
                    className="accent-[var(--accent)]"
                  />
                  <span>
                    {selected.size > 0
                      ? `${t("data.list.deselect")} (${selected.size})`
                      : t("data.list.select_all")}
                  </span>
                </label>
                {selected.size > 0 && (
                  <button
                    type="button"
                    onClick={handleBatchDelete}
                    disabled={pending}
                    className="text-xs px-2 py-1 border border-red-400/40 text-red-400 hover:bg-red-400 hover:text-[var(--background)] transition disabled:opacity-50"
                  >
                    {pending ? <span className="spinner" /> : `✕ ${t("data.list.delete_selected")} (${selected.size})`}
                  </button>
                )}
              </div>
            )}

            {filteredDocs.length === 0 ? (
              <p className="text-sm text-[var(--muted)] py-4 text-center">—</p>
            ) : (
              <>
                {userDocs.length > 0 && (
                  <DocSection
                    title="📄 你上傳的文件"
                    count={userDocs.length}
                    docs={userDocs}
                    brandId={brandId}
                    selected={selected}
                    toggleSelect={toggleSelect}
                    handleDelete={handleDelete}
                    t={t}
                  />
                )}
                {autoDocs.length > 0 && (
                  <DocSection
                    title="🤖 自動爬取（BRAIN 分析來源）"
                    count={autoDocs.length}
                    docs={autoDocs}
                    brandId={brandId}
                    selected={selected}
                    toggleSelect={toggleSelect}
                    handleDelete={handleDelete}
                    t={t}
                    collapsible
                    defaultCollapsed={autoDocs.length > 3}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Toast container — fixed bottom-right */}
      <div className="fixed bottom-20 right-4 md:right-6 z-50 space-y-2 max-w-[360px] w-[calc(100vw-2rem)]">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
        ))}
      </div>
    </>
  );
}

function DocSection({
  title,
  count,
  docs,
  brandId,
  selected,
  toggleSelect,
  handleDelete,
  t,
  collapsible = false,
  defaultCollapsed,
}: {
  title: string;
  count: number;
  docs: Doc[];
  brandId: string;
  selected: Set<string>;
  toggleSelect: (id: string) => void;
  handleDelete: (id: string) => void;
  t: ReturnType<typeof useI18n>["t"];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(collapsible && (defaultCollapsed ?? collapsible));
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => collapsible && setCollapsed((v) => !v)}
        className={`w-full flex items-center justify-between px-2 py-1.5 ${
          collapsible ? "cursor-pointer hover:bg-[var(--surface-2)]" : "cursor-default"
        }`}
        disabled={!collapsible}
      >
        <span className="font-mono text-[11px] tracking-widest text-[var(--accent)]">
          {title} · {count}
        </span>
        {collapsible && (
          <span className="text-[var(--muted)] text-xs">{collapsed ? "▼" : "▲"}</span>
        )}
      </button>
      {!collapsed && (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li
              key={d.id}
              className={`border bg-[var(--surface-2)] p-3 flex items-start gap-3 transition ${
                selected.has(d.id)
                  ? "border-[var(--accent)]"
                  : "border-[var(--line)]"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(d.id)}
                onChange={() => toggleSelect(d.id)}
                className="accent-[var(--accent)] mt-1 shrink-0"
                aria-label={`select ${d.filename}`}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-sm">{d.filename}</div>
                <div className="mt-1 text-xs text-[var(--muted)] flex items-center gap-2 font-mono">
                  <StatusDot status={d.status} />
                  <span>{statusLabel(d.status, t)}</span>
                  <span>·</span>
                  <span>{formatSize(d.byte_size)}</span>
                  <span>·</span>
                  <span>{new Date(d.created_at).toLocaleDateString()}</span>
                </div>
                <DocTagEditor
                  docId={d.id}
                  brandId={brandId}
                  tags={d.tags ?? []}
                />
                {d.error_message && (
                  <div className="mt-1 text-xs text-red-400 break-words">{d.error_message}</div>
                )}
              </div>
              <button
                onClick={() => handleDelete(d.id)}
                className="text-[var(--muted)] hover:text-red-400 shrink-0"
                aria-label="delete"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DocTagEditor({
  docId,
  brandId,
  tags,
}: {
  docId: string;
  brandId: string;
  tags: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function commit(newTags: string[]) {
    startTransition(async () => {
      await updateDocumentTags(docId, brandId, newTags);
      router.refresh();
    });
  }

  function addFromDraft() {
    const newTags = [...tags];
    draft
      .split(/[,，、\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((t) => {
        if (!newTags.includes(t)) newTags.push(t);
      });
    setDraft("");
    setEditing(false);
    commit(newTags);
  }

  function removeTag(tag: string) {
    commit(tags.filter((t) => t !== tag));
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] font-mono"
        >
          {tag}
          <button
            type="button"
            disabled={pending}
            onClick={() => removeTag(tag)}
            className="hover:text-red-400 transition disabled:opacity-50"
            aria-label={`remove ${tag}`}
          >
            ✕
          </button>
        </span>
      ))}
      {editing ? (
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addFromDraft();
            } else if (e.key === "Escape") {
              setDraft("");
              setEditing(false);
            }
          }}
          onBlur={() => {
            if (draft.trim()) addFromDraft();
            else setEditing(false);
          }}
          placeholder="新標籤..."
          className="text-[10px] px-1.5 py-0.5 border border-[var(--accent)]/50 bg-[var(--surface)] focus:border-[var(--accent)] focus:outline-none w-24"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={pending}
          className="text-[10px] px-1.5 py-0.5 border border-dashed border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition disabled:opacity-50"
        >
          + 加標籤
        </button>
      )}
    </div>
  );
}

function StatCell({
  label,
  value,
  accent,
  pulse,
  danger,
}: {
  label: string;
  value: number;
  accent?: boolean;
  pulse?: boolean;
  danger?: boolean;
}) {
  const color = danger
    ? "text-red-400"
    : accent
      ? "text-[var(--accent)]"
      : pulse
        ? "text-yellow-400"
        : "text-[var(--foreground)]";
  return (
    <div className="bg-[var(--surface)] p-4 sm:p-5 flex flex-col gap-1">
      <div className="font-mono text-[10px] tracking-widest text-[var(--muted)]">{label}</div>
      <div className={`font-mono font-bold text-3xl tabular ${color}`}>
        {String(value).padStart(2, "0")}
        {pulse && value > 0 && (
          <span className="ml-2 inline-block w-2 h-2 rounded-full bg-yellow-400 align-middle"
            style={{ animation: "pulse-dot 1.4s ease-in-out infinite" }}
          />
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ready: "bg-[var(--accent)]",
    processing: "bg-yellow-400",
    pending: "bg-yellow-400",
    error: "bg-red-400",
  };
  const cls = colors[status] ?? "bg-[var(--muted)]";
  const animated = status === "processing" || status === "pending";
  return (
    <span
      className={`w-1.5 h-1.5 rounded-full ${cls} inline-block`}
      style={animated ? { animation: "pulse-dot 1.4s ease-in-out infinite" } : undefined}
    />
  );
}

function statusLabel(status: string, t: (k: never) => string): string {
  if (status === "ready") return "READY";
  if (status === "processing") return "PROCESSING";
  if (status === "pending") return "PENDING";
  if (status === "error") return "ERROR";
  return status.toUpperCase();
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { t } = useI18n();
  const isError = toast.status === "error";
  const isDone = toast.status === "done";
  const isUploading = toast.status === "uploading";

  return (
    <div
      style={{ animation: "toast-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)" }}
      className={`border bg-[var(--surface)] backdrop-blur-xl shadow-2xl ${
        isError
          ? "border-red-400/50"
          : isDone
            ? "border-[var(--accent)]/50"
            : "border-[var(--line)]"
      }`}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            isError ? "bg-red-400" : isDone ? "bg-[var(--accent)]" : "bg-yellow-400"
          }`}
          style={
            isUploading ? { animation: "pulse-dot 1.4s ease-in-out infinite" } : undefined
          }
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm truncate font-medium">{toast.filename}</div>
          <div
            className={`text-xs font-mono mt-0.5 tracking-wide ${
              isError ? "text-red-400" : isDone ? "text-[var(--accent)]" : "text-[var(--muted)]"
            }`}
          >
            {isError ? `✕ ${t("data.toast.error")}` : isDone ? `✓ ${t("data.toast.done")}` : `↑ ${t("data.toast.uploading")}...`}
          </div>
          {isError && toast.error && (
            <div className="text-[10px] text-red-400 mt-0.5 break-words">{toast.error}</div>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-[var(--muted)] hover:text-[var(--foreground)] text-sm shrink-0"
          aria-label="dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
