"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveBrandIdentity,
  autoFillBrandIdentity,
  addCompetitor,
  deleteIntelligence,
  type IdentityState,
  type AutoFillState,
  type AddCompetitorState,
} from "./actions";
import { UploadProgressList } from "../upload-progress";

type Toast = {
  id: string;
  kind: "running" | "ok" | "err";
  text: string;
};

type ToastApi = {
  push: (text: string, kind: "ok" | "err" | "running") => string;
  update: (id: string, text: string, kind: "ok" | "err" | "running") => void;
  dismiss: (id: string) => void;
};

type Identity = {
  name: string;
  positioning: string;
  target_audience: string;
  tone_guide: string;
  taboo_words: string[];
};

type IntelligenceItem = {
  id: string;
  category: string;
  title: string;
  content: string;
  source: string | null;
  created_at: string;
};

type WinningItem = {
  id: string;
  pattern_type: string;
  example_text: string;
  context_summary: string | null;
  outcome_score: number | null;
  created_at: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  competitor: "競品",
  market_trend: "市場趨勢",
  industry_term: "產業術語",
  audience_insight: "受眾洞察",
};

export function BrainView({
  brandId,
  identity,
  intelligence,
  winning,
}: {
  brandId: string;
  identity: Identity;
  intelligence: IntelligenceItem[];
  winning: WinningItem[];
}) {
  const competitors = intelligence.filter((i) => i.category === "competitor");
  const others = intelligence.filter((i) => i.category !== "competitor");

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastApi: ToastApi = {
    push: (text, kind) => {
      const id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now() + Math.random());
      setToasts((prev) => [...prev, { id, text, kind }]);
      if (kind !== "running") {
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
      }
      return id;
    },
    update: (id, text, kind) => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, text, kind } : t)));
      if (kind !== "running") {
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
      }
    },
    dismiss: (id) => setToasts((prev) => prev.filter((t) => t.id !== id)),
  };

  return (
    <div className="space-y-10">
      <BrandIdentitySection brandId={brandId} initial={identity} toast={toastApi} />
      <CompetitorSection brandId={brandId} competitors={competitors} toast={toastApi} />
      <UploadProgressList brandId={brandId} />
      {others.length > 0 && <OtherIntelligenceSection brandId={brandId} items={others} />}
      <WinningMemorySection winning={winning} />

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 space-y-2 max-w-[360px] w-[calc(100vw-2rem)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{ animation: "toast-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)" }}
            className={`border bg-[var(--surface)] backdrop-blur-xl shadow-2xl ${
              t.kind === "err"
                ? "border-red-400/50"
                : t.kind === "ok"
                  ? "border-[var(--accent)]/50"
                  : "border-[var(--line)]"
            }`}
          >
            <div className="px-4 py-3 flex items-center gap-3">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  t.kind === "err" ? "bg-red-400" : t.kind === "ok" ? "bg-[var(--accent)]" : "bg-yellow-400"
                }`}
                style={t.kind === "running" ? { animation: "pulse-dot 1.4s ease-in-out infinite" } : undefined}
              />
              <div className="min-w-0 flex-1 text-xs leading-relaxed">
                {t.kind === "err" ? "✕ " : t.kind === "ok" ? "✓ " : "↻ "}
                {t.text}
              </div>
              <button
                type="button"
                onClick={() => toastApi.dismiss(t.id)}
                className="text-[var(--muted)] hover:text-[var(--foreground)] text-sm shrink-0"
                aria-label="dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Layer 1: Brand Identity ──────────────────────────

function BrandIdentitySection({
  brandId,
  initial,
  toast,
}: {
  brandId: string;
  initial: Identity;
  toast: ToastApi;
}) {
  const router = useRouter();
  const [positioning, setPositioning] = useState(initial.positioning);
  const [audience, setAudience] = useState(initial.target_audience);
  const [tone, setTone] = useState(initial.tone_guide);
  const [taboo, setTaboo] = useState(initial.taboo_words.join("、"));

  const [saveState, saveAction, savePending] = useActionState<IdentityState, FormData>(
    saveBrandIdentity,
    undefined
  );
  const [autoState, autoAction, autoPending] = useActionState<AutoFillState, FormData>(
    autoFillBrandIdentity,
    undefined
  );
  const [showAuto, setShowAuto] = useState(false);
  const [autoUrl, setAutoUrl] = useState("");
  const savePendingRef = useRef(false);
  const autoPendingRef = useRef(false);
  const saveToastRef = useRef<string | null>(null);
  const autoToastRef = useRef<string | null>(null);

  const isDirty =
    positioning !== initial.positioning ||
    audience !== initial.target_audience ||
    tone !== initial.tone_guide ||
    taboo !== initial.taboo_words.join("、");

  // Save brand identity: toast on pending → ok/err
  useEffect(() => {
    if (savePending && !savePendingRef.current) {
      savePendingRef.current = true;
      saveToastRef.current = toast.push("正在儲存 Brand Identity...", "running");
    } else if (!savePending && savePendingRef.current && saveState) {
      savePendingRef.current = false;
      const tid = saveToastRef.current;
      if (tid) {
        if ("success" in saveState && saveState.success) {
          toast.update(tid, "Brand Identity 已儲存（寫入 brands 表，下次 AI 生成自動讀取）", "ok");
        } else if ("error" in saveState) {
          toast.update(tid, `儲存失敗：${saveState.error}`, "err");
        }
      }
      saveToastRef.current = null;
    }
  }, [savePending, saveState, toast]);

  // Auto-fill: pending toast + clear URL on success
  useEffect(() => {
    if (autoPending && !autoPendingRef.current) {
      autoPendingRef.current = true;
      autoToastRef.current = toast.push("🌐 正在抓取網頁並 AI 分析...", "running");
    } else if (!autoPending && autoPendingRef.current && autoState) {
      autoPendingRef.current = false;
      const tid = autoToastRef.current;
      if (tid) {
        if ("success" in autoState && autoState.success) {
          const dataNote = autoState.savedToDataId ? "（原始內容已存入 DATA）" : "";
          toast.update(tid, `分析完成${dataNote}，請按「✓ 套用到下方欄位」`, "ok");
          setAutoUrl(""); // clear URL right after success so user can paste next one
        } else if ("error" in autoState) {
          toast.update(tid, `分析失敗：${autoState.error}`, "err");
        }
      }
      autoToastRef.current = null;
    }
  }, [autoPending, autoState, toast]);

  function applyAutoResult() {
    if (!autoState || !("success" in autoState) || !autoState.success) return;
    const next = {
      positioning: autoState.positioning,
      target_audience: autoState.target_audience,
      tone_guide: autoState.tone_guide,
      taboo_words: autoState.taboo_words.join("、"),
    };
    setPositioning(next.positioning);
    setAudience(next.target_audience);
    setTone(next.tone_guide);
    setTaboo(next.taboo_words);
    setAutoUrl("");
    setShowAuto(false);

    // Auto-save to Supabase brands table immediately
    const fd = new FormData();
    fd.append("brandId", brandId);
    fd.append("positioning", next.positioning);
    fd.append("target_audience", next.target_audience);
    fd.append("tone_guide", next.tone_guide);
    fd.append("taboo_words", next.taboo_words);
    saveAction(fd);
    setTimeout(() => router.refresh(), 800);
  }

  return (
    <section className="border border-[var(--line)] bg-[var(--surface)] p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-mono text-xs tracking-widest text-[var(--accent)]">
            LAYER 1 · BRAND IDENTITY
          </div>
          <h3 className="mt-1 text-lg font-bold">我是誰</h3>
        </div>
        <button
          type="button"
          onClick={() => setShowAuto((v) => !v)}
          className="text-xs px-3 py-1.5 border border-[var(--accent)]/50 text-[var(--accent)] hover:bg-[var(--accent)]/10 transition"
        >
          🪄 從網址自動分析
        </button>
      </div>

      {showAuto && (
        <form action={autoAction} className="bg-[var(--surface-2)] border border-[var(--line)] p-4 space-y-3">
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            貼上品牌官網連結，AI 會抓內容並自動填入下方四個欄位。你可以再手動微調。
          </p>
          <input type="hidden" name="brandId" value={brandId} />
          <div className="flex gap-2 flex-wrap">
            <input
              name="url"
              type="url"
              required
              value={autoUrl}
              onChange={(e) => setAutoUrl(e.target.value)}
              placeholder="https://yourbrand.com"
              className="flex-1 min-w-[200px] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={autoPending}
              className="bg-[var(--accent)] px-4 py-2 text-xs font-bold tracking-wide text-[var(--background)] hover:bg-[var(--accent-glow)] transition disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {autoPending ? (
                <>
                  <span className="spinner" /> 分析中
                </>
              ) : (
                "🪄 分析"
              )}
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--muted)] cursor-pointer">
            <input
              type="checkbox"
              name="saveToData"
              value="1"
              className="accent-[var(--accent)]"
            />
            <span>同時保存原始抓取內容到 DATA 知識庫（標籤：brand_identity / auto-fetched）</span>
          </label>
          {autoState && "error" in autoState && (
            <p className="text-xs text-red-400">{autoState.error}</p>
          )}
          {autoState && "success" in autoState && autoState.success && (
            <div className="space-y-2 border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-3">
              <p className="text-xs text-[var(--accent)] font-mono">
                ✓ 分析完成{autoState.savedToDataId ? "（已存入 DATA）" : ""}，預覽：
              </p>
              <div className="text-xs space-y-1.5">
                {autoState.brand_name && (
                  <div><span className="text-[var(--muted)]">品牌：</span>{autoState.brand_name}</div>
                )}
                <div><span className="text-[var(--muted)]">定位：</span>{autoState.positioning}</div>
                <div><span className="text-[var(--muted)]">受眾：</span>{autoState.target_audience}</div>
                <div><span className="text-[var(--muted)]">語氣：</span>{autoState.tone_guide}</div>
                {autoState.taboo_words.length > 0 && (
                  <div>
                    <span className="text-[var(--muted)]">禁忌詞：</span>
                    {autoState.taboo_words.join("、")}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={applyAutoResult}
                className="text-xs px-3 py-1.5 bg-[var(--accent)] text-[var(--background)] font-bold hover:bg-[var(--accent-glow)] transition"
              >
                ✓ 套用到下方欄位
              </button>
            </div>
          )}
        </form>
      )}

      <form action={saveAction} className="space-y-4">
        <input type="hidden" name="brandId" value={brandId} />

        <Field
          label="定位 (Positioning)"
          name="positioning"
          value={positioning}
          onChange={setPositioning}
          rows={3}
          placeholder="例：台北中山區的手搖飲品牌，主打日式抹茶，調性親切年輕"
        />
        <Field
          label="目標受眾 (Target Audience)"
          name="target_audience"
          value={audience}
          onChange={setAudience}
          rows={3}
          placeholder="例：18-30 歲女性上班族，重視 IG 拍照感、追求精緻日常"
        />
        <Field
          label="語氣指南 (Tone Guide)"
          name="tone_guide"
          value={tone}
          onChange={setTone}
          rows={2}
          placeholder="例：親切口語、年輕活潑、適度用 emoji、不過度推銷"
        />
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="block text-xs font-medium tracking-wide text-[var(--muted)]">
              禁忌詞 (Taboo Words)
            </label>
            {taboo && (
              <button
                type="button"
                onClick={() => setTaboo("")}
                className="text-[10px] text-[var(--muted)] hover:text-red-400 transition"
                title="清空此欄"
              >
                ✕ 清空
              </button>
            )}
          </div>
          <input
            name="taboo_words"
            type="text"
            value={taboo}
            onChange={(e) => setTaboo(e.target.value)}
            placeholder="用、或逗號分隔，例：便宜、廉價、平價"
            className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="submit"
            disabled={savePending}
            onClick={() => {
              setTimeout(() => router.refresh(), 600);
            }}
            className={`px-5 py-2.5 text-xs font-bold tracking-wide transition disabled:opacity-50 inline-flex items-center gap-1.5 ${
              isDirty
                ? "bg-[var(--accent)] text-[var(--background)] hover:bg-[var(--accent-glow)] ring-2 ring-[var(--accent)]/40"
                : "bg-[var(--accent)]/40 text-[var(--background)]/70"
            }`}
          >
            {savePending ? <><span className="spinner" /> 儲存中</> : "💾 儲存 Brand Identity"}
          </button>
          {isDirty && !savePending && (
            <span className="text-xs text-yellow-400 font-mono">⚠ 尚未儲存變更</span>
          )}
          {!isDirty && !savePending && (positioning || audience || tone || taboo) && (
            <span className="text-xs text-[var(--accent)] font-mono">✓ 已儲存</span>
          )}
          <span className="text-[10px] text-[var(--muted)] font-mono">
            儲存於 brands 表 + 同步到 DATA「自動爬取」區塊
          </span>
        </div>
      </form>
    </section>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  rows = 2,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="block text-xs font-medium tracking-wide text-[var(--muted)]">
          {label}
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-[10px] text-[var(--muted)] hover:text-red-400 transition"
            title="清空此欄"
          >
            ✕ 清空
          </button>
        )}
      </div>
      <textarea
        name={name}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none leading-relaxed"
      />
    </div>
  );
}

// ─── Layer 2: Competitors ──────────────────────────────

function CompetitorSection({
  brandId,
  competitors,
  toast,
}: {
  brandId: string;
  competitors: IntelligenceItem[];
  toast: ToastApi;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<AddCompetitorState, FormData>(
    addCompetitor,
    undefined
  );
  const [url, setUrl] = useState("");
  const [saveToData, setSaveToData] = useState(false);
  const pendingRef = useRef(false);
  const toastRef = useRef<string | null>(null);

  // Toast lifecycle
  useEffect(() => {
    if (pending && !pendingRef.current) {
      pendingRef.current = true;
      toastRef.current = toast.push(
        "🌐 抓取競品網站 → AI 判斷相關性 → 摘要策略...",
        "running"
      );
    } else if (!pending && pendingRef.current && state) {
      pendingRef.current = false;
      const tid = toastRef.current;
      if (tid) {
        if ("success" in state && state.success) {
          const dataNote = state.savedToDataId ? "+ 原始內容已存入 DATA" : "";
          toast.update(tid, `競品分析已加入 ${dataNote}`, "ok");
          setUrl("");
          setSaveToData(false);
          setTimeout(() => router.refresh(), 300);
        } else if ("irrelevant" in state && state.irrelevant) {
          toast.update(
            tid,
            `AI 判斷不是競品（相關性 ${state.relevance_score}/10），請看下方說明`,
            "err"
          );
        } else if ("error" in state) {
          toast.update(tid, `分析失敗：${state.error}`, "err");
        }
      }
      toastRef.current = null;
    }
  }, [pending, state, toast, router]);

  const irrelevant = state && "irrelevant" in state && state.irrelevant;

  return (
    <section className="border border-[var(--line)] bg-[var(--surface)] p-5 space-y-4">
      <div>
        <div className="font-mono text-xs tracking-widest text-[var(--accent)]">
          LAYER 2 · MARKET INTELLIGENCE
        </div>
        <h3 className="mt-1 text-lg font-bold">外部世界 · 競品</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          貼上競品官網/IG/Threads，AI 會先判斷是否真的是你的競品（防止亂分析），然後摘要策略 + 找出差異化機會。
        </p>
      </div>

      <form action={action} className="space-y-2">
        <input type="hidden" name="brandId" value={brandId} />
        <div className="flex gap-2 flex-wrap">
          <input
            name="url"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://competitor-brand.com"
            className="flex-1 min-w-[200px] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending}
            className="bg-[var(--accent)] px-4 py-2 text-xs font-bold tracking-wide text-[var(--background)] hover:bg-[var(--accent-glow)] transition disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {pending ? (
              <>
                <span className="spinner" /> 分析中
              </>
            ) : (
              "+ 新增競品"
            )}
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-[var(--muted)] cursor-pointer">
          <input
            type="checkbox"
            name="saveToData"
            value="1"
            checked={saveToData}
            onChange={(e) => setSaveToData(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          <span>同時保存原始抓取內容到 DATA 知識庫（標籤：competitor / auto-fetched）</span>
        </label>
      </form>

      {irrelevant && (
        <div className="border border-yellow-400/40 bg-yellow-400/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <span className="text-xl shrink-0">⚠️</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-yellow-300">
                AI 判斷這似乎不是你的競品
              </div>
              <div className="text-[10px] text-[var(--muted)] font-mono mt-0.5">
                相關性 {state.relevance_score}/10
              </div>
            </div>
          </div>
          <div className="text-xs leading-relaxed text-[var(--foreground)]/85">
            <span className="text-[var(--muted)]">AI 判斷理由：</span>
            {state.relevance_reason}
          </div>
          <div className="text-xs text-[var(--muted)]">
            如果你確定這是相關競品（例如剛起步的小眾品牌、AI 沒抓到關係），可強制加入：
          </div>
          <form action={action} className="flex gap-2 flex-wrap">
            <input type="hidden" name="brandId" value={brandId} />
            <input type="hidden" name="url" value={state.url} />
            <input type="hidden" name="force" value="1" />
            {state.saveToData && <input type="hidden" name="saveToData" value="1" />}
            <button
              type="submit"
              disabled={pending}
              className="text-xs px-3 py-1.5 border border-yellow-400 text-yellow-300 hover:bg-yellow-400/20 transition"
            >
              {pending ? "處理中..." : "強制加入（我確定有相關）"}
            </button>
          </form>
        </div>
      )}

      {competitors.length === 0 ? (
        <p className="text-xs text-[var(--muted)] py-4">尚未追蹤任何競品</p>
      ) : (
        <ul className="space-y-3">
          {competitors.map((c) => (
            <IntelligenceCard key={c.id} item={c} brandId={brandId} />
          ))}
        </ul>
      )}
    </section>
  );
}

function IntelligenceCard({ item, brandId }: { item: IntelligenceItem; brandId: string }) {
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="border border-[var(--line)] bg-[var(--surface-2)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] tracking-widest text-[var(--accent)]">
              {CATEGORY_LABEL[item.category] ?? item.category}
            </span>
            <span className="text-[10px] text-[var(--muted)]">
              · {new Date(item.created_at).toLocaleDateString()}
            </span>
            {item.source && (
              <a
                href={item.source}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-[var(--muted)] hover:text-[var(--accent)]"
              >
                來源 ↗
              </a>
            )}
          </div>
          <div className="mt-1 text-sm font-bold">{item.title}</div>
          <div
            className={`mt-2 text-xs leading-relaxed text-[var(--foreground)]/85 whitespace-pre-wrap ${
              expanded ? "" : "line-clamp-3"
            }`}
          >
            {item.content}
          </div>
          {item.content.length > 200 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1.5 text-[10px] text-[var(--muted)] hover:text-[var(--accent)]"
            >
              {expanded ? "收起 ▲" : "展開 ▼"}
            </button>
          )}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm(`刪除「${item.title}」？`)) return;
            startTransition(() => deleteIntelligence(item.id, brandId));
          }}
          className="shrink-0 text-[10px] text-[var(--muted)] hover:text-red-400 transition"
        >
          ✕
        </button>
      </div>
    </li>
  );
}

function OtherIntelligenceSection({
  brandId,
  items,
}: {
  brandId: string;
  items: IntelligenceItem[];
}) {
  return (
    <section className="border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
      <div className="font-mono text-xs tracking-widest text-[var(--accent)]">
        市場觀察 · 受眾洞察
      </div>
      <ul className="space-y-3">
        {items.map((i) => (
          <IntelligenceCard key={i.id} item={i} brandId={brandId} />
        ))}
      </ul>
    </section>
  );
}

// ─── Layer 3: Winning Memory ───────────────────────────

function WinningMemorySection({ winning }: { winning: WinningItem[] }) {
  return (
    <section className="border border-[var(--line)] bg-[var(--surface)] p-5 space-y-4">
      <div>
        <div className="font-mono text-xs tracking-widest text-[var(--accent)]">
          LAYER 3 · WINNING MEMORY
        </div>
        <h3 className="mt-1 text-lg font-bold">什麼有效</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          自動累積——當你在 Coast Guard 把回覆標記為「促成成交」，那則回覆會進到這裡。AI 之後生成回覆會參考這些成功範例。
        </p>
      </div>

      {winning.length === 0 ? (
        <p className="text-xs text-[var(--muted)] py-4">
          還沒有累積任何成功範例。在 Coast Guard 發送回覆 → 標記「促成成交」即可累積。
        </p>
      ) : (
        <ul className="space-y-3">
          {winning.map((w) => (
            <li
              key={w.id}
              className="border border-[var(--line)] bg-[var(--surface-2)] p-4 space-y-2"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] tracking-widest text-[var(--accent)]">
                  {w.pattern_type}
                </span>
                {w.outcome_score !== null && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-[var(--accent)]/20 text-[var(--accent)] font-mono">
                    成效 {w.outcome_score}/10
                  </span>
                )}
                <span className="text-[10px] text-[var(--muted)]">
                  · {new Date(w.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="text-sm leading-relaxed whitespace-pre-wrap">{w.example_text}</div>
              {w.context_summary && (
                <div className="text-xs text-[var(--muted)] leading-relaxed">
                  情境：{w.context_summary}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
