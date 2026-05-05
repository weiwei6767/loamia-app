"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createKol,
  updateKol,
  deleteKol,
  updateKolStatus,
  generateBrief,
  type KolState,
  type GenerateBriefState,
} from "./actions";

type Kol = {
  id: string;
  name: string;
  handle: string | null;
  platform: string | null;
  profile_url: string | null;
  followers: number | null;
  niche_tags: string[];
  contact_email: string | null;
  contact_phone: string | null;
  rate_note: string | null;
  status: string;
  campaign_name: string | null;
  brief: string | null;
  rate_paid: string | null;
  collab_notes: string | null;
  created_at: string;
};

const STATUS_OPTIONS: Array<{ value: string; label: string; color: string }> = [
  { value: "researching", label: "🔍 探索中", color: "text-[var(--muted)]" },
  { value: "contacted", label: "📩 已聯繫", color: "text-blue-400" },
  { value: "in_progress", label: "🤝 合作中", color: "text-[var(--accent)]" },
  { value: "completed", label: "✓ 已完成", color: "text-[var(--accent)]" },
  { value: "paused", label: "⏸ 暫停", color: "text-yellow-400" },
  { value: "rejected", label: "✕ 終止", color: "text-red-400" },
];

const PLATFORM_OPTIONS = [
  { value: "threads", label: "Threads" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "x", label: "X (Twitter)" },
  { value: "other", label: "其他" },
];

function statusMeta(value: string) {
  return STATUS_OPTIONS.find((s) => s.value === value) ?? STATUS_OPTIONS[0];
}

export function KolView({ brandId, kols }: { brandId: string; kols: Kol[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = kols.filter((k) => {
    if (filterStatus !== "all" && k.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !k.name.toLowerCase().includes(q) &&
        !(k.handle ?? "").toLowerCase().includes(q) &&
        !(k.niche_tags ?? []).some((t) => t.toLowerCase().includes(q))
      ) {
        return false;
      }
    }
    return true;
  });

  const counts = kols.reduce<Record<string, number>>((acc, k) => {
    acc[k.status] = (acc[k.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* Status filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setFilterStatus("all")}
          className={`text-xs px-3 py-1.5 border transition ${
            filterStatus === "all"
              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--background)] font-bold"
              : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)]/50"
          }`}
        >
          全部 · {kols.length}
        </button>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setFilterStatus(s.value)}
            className={`text-xs px-3 py-1.5 border transition ${
              filterStatus === s.value
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--background)] font-bold"
                : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)]/50"
            }`}
          >
            {s.label} · {counts[s.value] ?? 0}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          placeholder="搜尋名稱／帳號／領域..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="bg-[var(--accent)] px-4 py-2 text-xs font-bold tracking-wide text-[var(--background)] hover:bg-[var(--accent-glow)] transition"
        >
          {showAdd ? "✕ 取消" : "+ 新增 KOL"}
        </button>
      </div>

      {showAdd && <AddKolForm brandId={brandId} onClose={() => setShowAdd(false)} />}

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--muted)] py-12 text-center">
          {kols.length === 0
            ? "尚未新增任何 KOL。點上方「+ 新增 KOL」開始累積你的合作名單。"
            : "沒有符合條件的 KOL"}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((k) => (
            <KolCard
              key={k.id}
              kol={k}
              brandId={brandId}
              editing={editingId === k.id}
              onEditToggle={() => setEditingId((cur) => (cur === k.id ? null : k.id))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AddKolForm({ brandId, onClose }: { brandId: string; onClose: () => void }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<KolState, FormData>(createKol, undefined);

  useEffect(() => {
    if (state && "success" in state && state.success) {
      formRef.current?.reset();
      router.refresh();
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="border border-[var(--accent)]/40 bg-[var(--surface-2)] p-5 space-y-3"
    >
      <input type="hidden" name="brandId" value={brandId} />
      <div className="font-mono text-xs tracking-widest text-[var(--accent)]">+ 新增 KOL</div>
      <KolFormFields />
      {state && "error" in state && (
        <p className="text-xs text-red-400">{state.error}</p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-[var(--accent)] px-5 py-2 text-xs font-bold tracking-wide text-[var(--background)] hover:bg-[var(--accent-glow)] transition disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {pending ? <><span className="spinner" /> 建立中</> : "✓ 建立"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-xs px-3 py-2 border border-[var(--line)] text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          取消
        </button>
      </div>
    </form>
  );
}

function KolFormFields({ initial }: { initial?: Partial<Kol> } = {}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="顯示名稱 *" name="name" required defaultValue={initial?.name ?? ""} placeholder="例：阿明 Aming" />
        <Field label="帳號 (handle)" name="handle" defaultValue={initial?.handle ?? ""} placeholder="無 @" />
        <Select
          label="主要平台"
          name="platform"
          defaultValue={initial?.platform ?? ""}
          options={[{ value: "", label: "—" }, ...PLATFORM_OPTIONS]}
        />
        <Field label="個人主頁網址" name="profile_url" type="url" defaultValue={initial?.profile_url ?? ""} placeholder="https://..." />
        <Field label="粉絲數" name="followers" type="number" defaultValue={initial?.followers != null ? String(initial.followers) : ""} placeholder="例：50000" />
        <Field
          label="領域 / 標籤"
          name="niche_tags"
          defaultValue={initial?.niche_tags?.join("、") ?? ""}
          placeholder="用、或逗號分隔，例：美食、開箱、學生族群"
        />
        <Field label="聯絡 Email" name="contact_email" type="email" defaultValue={initial?.contact_email ?? ""} />
        <Field label="聯絡電話" name="contact_phone" defaultValue={initial?.contact_phone ?? ""} />
      </div>
      <Field label="費率備註" name="rate_note" defaultValue={initial?.rate_note ?? ""} placeholder="例：3 萬元 / 1 篇 IG 貼文" />

      <div className="border-t border-[var(--line)] pt-3 space-y-3">
        <div className="font-mono text-[10px] tracking-widest text-[var(--muted)]">本品牌合作資訊</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="狀態"
            name="status"
            defaultValue={initial?.status ?? "researching"}
            options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
          />
          <Field label="合作主題 / 活動名稱" name="campaign_name" defaultValue={initial?.campaign_name ?? ""} placeholder="例：母親節檔期" />
          <Field label="實付費用" name="rate_paid" defaultValue={initial?.rate_paid ?? ""} placeholder="例：NT$ 35,000" />
        </div>
        <Textarea
          label="合作備註"
          name="collab_notes"
          rows={3}
          defaultValue={initial?.collab_notes ?? ""}
          placeholder="關鍵提醒、上次合作觀察、需求細節..."
        />
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-mono tracking-wide text-[var(--muted)]">
        {label}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-sm focus:border-[var(--accent)] focus:outline-none"
      />
    </div>
  );
}

function Select({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-mono tracking-wide text-[var(--muted)]">
        {label}
      </label>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-sm focus:border-[var(--accent)] focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Textarea({
  label,
  name,
  rows = 3,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  rows?: number;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-mono tracking-wide text-[var(--muted)]">
        {label}
      </label>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none leading-relaxed"
      />
    </div>
  );
}

function KolCard({
  kol,
  brandId,
  editing,
  onEditToggle,
}: {
  kol: Kol;
  brandId: string;
  editing: boolean;
  onEditToggle: () => void;
}) {
  const router = useRouter();
  const meta = statusMeta(kol.status);
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [briefState, briefAction, briefPending] = useActionState<GenerateBriefState, FormData>(
    generateBrief,
    undefined
  );
  const [updateState, updateAction, updatePending] = useActionState<KolState, FormData>(
    updateKol,
    undefined
  );

  useEffect(() => {
    if (briefState && "success" in briefState && briefState.success) {
      setExpanded(true);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefState]);

  useEffect(() => {
    if (updateState && "success" in updateState && updateState.success) {
      router.refresh();
      onEditToggle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateState]);

  const briefText = briefState && "success" in briefState && briefState.success
    ? briefState.brief
    : kol.brief;

  if (editing) {
    return (
      <li className="border border-[var(--accent)]/40 bg-[var(--surface-2)] p-4 space-y-3">
        <form action={updateAction} className="space-y-3">
          <input type="hidden" name="id" value={kol.id} />
          <input type="hidden" name="brandId" value={brandId} />
          <KolFormFields initial={kol} />
          {updateState && "error" in updateState && (
            <p className="text-xs text-red-400">{updateState.error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={updatePending}
              className="bg-[var(--accent)] px-4 py-2 text-xs font-bold text-[var(--background)] hover:bg-[var(--accent-glow)] transition disabled:opacity-50"
            >
              {updatePending ? "儲存中..." : "✓ 儲存變更"}
            </button>
            <button
              type="button"
              onClick={onEditToggle}
              className="text-xs px-3 py-2 border border-[var(--line)] text-[var(--muted)]"
            >
              取消
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="border border-[var(--line)] bg-[var(--surface)] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-base font-bold truncate">{kol.name}</h3>
            {kol.handle && (
              <span className="text-xs text-[var(--muted)] font-mono">@{kol.handle}</span>
            )}
            {kol.platform && (
              <span className="text-[10px] px-1.5 py-0.5 border border-[var(--line)] text-[var(--muted)]">
                {kol.platform}
              </span>
            )}
            {kol.followers != null && (
              <span className="text-[10px] text-[var(--muted)] font-mono">
                {kol.followers.toLocaleString()} 粉絲
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <select
              value={kol.status}
              onChange={(e) =>
                startTransition(() => updateKolStatus(kol.id, brandId, e.target.value))
              }
              disabled={pending}
              className={`text-[10px] px-1.5 py-0.5 border border-[var(--line)] bg-[var(--surface-2)] font-mono ${meta.color}`}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            {kol.campaign_name && (
              <span className="text-[10px] text-[var(--muted)] font-mono">· {kol.campaign_name}</span>
            )}
          </div>

          {kol.niche_tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {kol.niche_tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-1.5 py-0.5 border border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)] font-mono"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {kol.profile_url && (
            <a
              href={kol.profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] px-2 py-1 border border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
            >
              ↗ 主頁
            </a>
          )}
          <button
            type="button"
            onClick={onEditToggle}
            className="text-[10px] px-2 py-1 border border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
          >
            ✏️ 編輯
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`刪除 KOL「${kol.name}」？`)) return;
              startTransition(() => deleteKol(kol.id, brandId));
            }}
            className="text-[10px] px-2 py-1 border border-[var(--line)] text-[var(--muted)] hover:border-red-400 hover:text-red-400 transition disabled:opacity-50"
          >
            ✕
          </button>
        </div>
      </div>

      {(kol.contact_email || kol.contact_phone || kol.rate_note || kol.collab_notes) && (
        <div className="text-xs text-[var(--muted)] grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
          {kol.contact_email && <div>📧 {kol.contact_email}</div>}
          {kol.contact_phone && <div>📞 {kol.contact_phone}</div>}
          {kol.rate_note && <div className="sm:col-span-2">💰 {kol.rate_note}</div>}
          {kol.collab_notes && <div className="sm:col-span-2 whitespace-pre-wrap">📝 {kol.collab_notes}</div>}
        </div>
      )}

      {/* AI Brief generator + display */}
      <div className="border-t border-[var(--line)] pt-3 space-y-2">
        <form action={briefAction} className="flex items-center gap-2 flex-wrap">
          <input type="hidden" name="id" value={kol.id} />
          <input type="hidden" name="brandId" value={brandId} />
          <button
            type="submit"
            disabled={briefPending}
            className="text-xs px-3 py-1.5 border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--background)] transition disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {briefPending ? (
              <>
                <span className="spinner" /> 生成中
              </>
            ) : briefText ? (
              "↻ 重新生成 Brief"
            ) : (
              "✨ AI 產生合作 Brief"
            )}
          </button>
          {briefText && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[10px] text-[var(--muted)] hover:text-[var(--accent)]"
            >
              {expanded ? "收起" : "展開"} Brief
            </button>
          )}
          {briefText && (
            <CopyBriefButton text={briefText} />
          )}
          {briefState && "error" in briefState && (
            <span className="text-xs text-red-400">{briefState.error}</span>
          )}
        </form>

        {briefText && expanded && (
          <div className="border border-[var(--line)] bg-[var(--surface-2)] p-3 text-xs leading-relaxed whitespace-pre-wrap">
            {briefText}
          </div>
        )}
      </div>
    </li>
  );
}

function CopyBriefButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className={`text-[10px] px-2 py-1 border transition ${
        copied
          ? "border-[var(--accent)] text-[var(--accent)]"
          : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
      }`}
    >
      {copied ? "✓ 已複製" : "📋 複製"}
    </button>
  );
}
