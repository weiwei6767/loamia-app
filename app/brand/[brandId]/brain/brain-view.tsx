"use client";

import { useActionState, useState, useTransition } from "react";
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

  return (
    <div className="space-y-10">
      <BrandIdentitySection brandId={brandId} initial={identity} />
      <CompetitorSection brandId={brandId} competitors={competitors} />
      {others.length > 0 && <OtherIntelligenceSection brandId={brandId} items={others} />}
      <WinningMemorySection winning={winning} />
    </div>
  );
}

// ─── Layer 1: Brand Identity ──────────────────────────

function BrandIdentitySection({
  brandId,
  initial,
}: {
  brandId: string;
  initial: Identity;
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

  function applyAutoResult() {
    if (!autoState || !("success" in autoState) || !autoState.success) return;
    setPositioning(autoState.positioning);
    setAudience(autoState.target_audience);
    setTone(autoState.tone_guide);
    setTaboo(autoState.taboo_words.join("、"));
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
          {autoState && "error" in autoState && (
            <p className="text-xs text-red-400">{autoState.error}</p>
          )}
          {autoState && "success" in autoState && autoState.success && (
            <div className="space-y-2 border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-3">
              <p className="text-xs text-[var(--accent)] font-mono">✓ 分析完成，預覽：</p>
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
          <label className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--muted)]">
            禁忌詞 (Taboo Words)
          </label>
          <input
            name="taboo_words"
            type="text"
            value={taboo}
            onChange={(e) => setTaboo(e.target.value)}
            placeholder="用、或逗號分隔，例：便宜、廉價、平價"
            className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
          />
        </div>

        {saveState && "error" in saveState && (
          <p className="text-xs text-red-400">{saveState.error}</p>
        )}
        {saveState && "success" in saveState && (
          <p className="text-xs text-[var(--accent)]" onAnimationEnd={() => router.refresh()}>
            ✓ 已儲存
          </p>
        )}

        <button
          type="submit"
          disabled={savePending}
          className="bg-[var(--accent)] px-5 py-2.5 text-xs font-bold tracking-wide text-[var(--background)] hover:bg-[var(--accent-glow)] transition disabled:opacity-50"
        >
          {savePending ? "儲存中..." : "儲存 Brand Identity"}
        </button>
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
      <label className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--muted)]">
        {label}
      </label>
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
}: {
  brandId: string;
  competitors: IntelligenceItem[];
}) {
  const [state, action, pending] = useActionState<AddCompetitorState, FormData>(
    addCompetitor,
    undefined
  );
  const [url, setUrl] = useState("");

  // Clear input on success
  if (state && "success" in state && state.success && url) {
    setTimeout(() => setUrl(""), 0);
  }

  return (
    <section className="border border-[var(--line)] bg-[var(--surface)] p-5 space-y-4">
      <div>
        <div className="font-mono text-xs tracking-widest text-[var(--accent)]">
          LAYER 2 · MARKET INTELLIGENCE
        </div>
        <h3 className="mt-1 text-lg font-bold">外部世界 · 競品</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          貼上競品官網/IG/Threads，AI 自動摘要其策略 + 找出差異化機會。每次生成內容會自動參考。
        </p>
      </div>

      <form action={action} className="flex gap-2 flex-wrap">
        <input type="hidden" name="brandId" value={brandId} />
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
      </form>
      {state && "error" in state && (
        <p className="text-xs text-red-400">{state.error}</p>
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
