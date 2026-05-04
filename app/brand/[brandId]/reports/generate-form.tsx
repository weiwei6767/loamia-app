"use client";

import { useActionState, useState } from "react";
import { generateReport, type GenerateState } from "./actions";
import { useI18n } from "@/lib/i18n/provider";
import { Uploader } from "../uploader";

const SECTION_TEMPLATES: Record<string, { zh: string; en: string }> = {
  standard: {
    zh: "執行摘要\n本期活動\n關鍵成效\n觀察與洞察\n下期建議",
    en: "Executive Summary\nActivities\nKey Performance\nObservations\nRecommendations",
  },
  campaign: {
    zh: "檔期摘要\n活動策略\nKPI 達成\n亮點分析\n學習與優化",
    en: "Campaign Summary\nStrategy\nKPI Achievement\nHighlights\nLessons Learned",
  },
  kol: {
    zh: "合作 KOL 名單\n各 KOL 表現\nROI 分析\n後續合作建議",
    en: "KOL Roster\nIndividual Performance\nROI Analysis\nFuture Recommendations",
  },
  brief: {
    zh: "重點摘要\n關鍵數據\n建議事項",
    en: "Summary\nKey Metrics\nRecommendations",
  },
};

export function GenerateForm({ brandId }: { brandId: string }) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState<GenerateState, FormData>(generateReport, undefined);

  const isPicker = state && "needsSelection" in state && state.needsSelection;

  const [focus, setFocus] = useState("");
  const [sections, setSections] = useState(SECTION_TEMPLATES.standard[locale]);
  const [tone, setTone] = useState("professional");
  const [length, setLength] = useState("standard");
  const [lang, setLang] = useState<"zh" | "en">(locale);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const errorText = (() => {
    if (!state || !("error" in state) || !state.error) return null;
    if (state.error === "no_documents") return t("reports.error.no_docs");
    return state.error;
  })();

  if (isPicker) {
    return <Picker brandId={brandId} state={state} action={action} pending={pending} />;
  }

  const setTemplate = (key: keyof typeof SECTION_TEMPLATES) => {
    setSections(SECTION_TEMPLATES[key][lang]);
  };

  return (
    <form action={action} className="border border-[var(--line)] bg-[var(--surface)] p-5 space-y-5">
      <input type="hidden" name="brandId" value={brandId} />

      <div>
        <label htmlFor="focus" className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--muted)]">
          {t("reports.focus.label")}
        </label>
        <input
          id="focus"
          name="focus"
          type="text"
          maxLength={120}
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder={t("reports.focus.placeholder")}
          className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-sm focus:border-[var(--accent)] focus:outline-none"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="sections" className="text-xs font-medium tracking-wide text-[var(--muted)]">
            {t("reports.sections.label")}
          </label>
          <span className="text-xs text-[var(--muted)]">{t("reports.sections.quick")}：</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {(["standard", "campaign", "kol", "brief"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTemplate(k)}
              className="text-xs px-2.5 py-1 border border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
            >
              {t(`reports.sections.template.${k}` as never)}
            </button>
          ))}
        </div>
        <textarea
          id="sections"
          name="sections"
          rows={6}
          value={sections}
          onChange={(e) => setSections(e.target.value)}
          className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-sm font-mono leading-relaxed focus:border-[var(--accent)] focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="tone" className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--muted)]">
            {t("reports.tone.label")}
          </label>
          <select
            id="tone"
            name="tone"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-sm focus:border-[var(--accent)] focus:outline-none"
          >
            <option value="professional">{t("reports.tone.professional")}</option>
            <option value="business">{t("reports.tone.business")}</option>
            <option value="client">{t("reports.tone.client")}</option>
            <option value="internal">{t("reports.tone.internal")}</option>
            <option value="casual">{t("reports.tone.casual")}</option>
            <option value="data">{t("reports.tone.data")}</option>
          </select>
        </div>

        <div>
          <label htmlFor="length" className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--muted)]">
            {t("reports.length.label")}
          </label>
          <select
            id="length"
            name="length"
            value={length}
            onChange={(e) => setLength(e.target.value)}
            className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-sm focus:border-[var(--accent)] focus:outline-none"
          >
            <option value="short">{t("reports.length.short")}</option>
            <option value="standard">{t("reports.length.standard")}</option>
            <option value="detailed">{t("reports.length.detailed")}</option>
          </select>
        </div>

        <div>
          <label htmlFor="lang" className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--muted)]">
            {t("reports.lang.label")}
          </label>
          <select
            id="lang"
            name="lang"
            value={lang}
            onChange={(e) => setLang(e.target.value as "zh" | "en")}
            className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-sm focus:border-[var(--accent)] focus:outline-none"
          >
            <option value="zh">{t("reports.lang.zh")}</option>
            <option value="en">{t("reports.lang.en")}</option>
          </select>
        </div>
      </div>

      {errorText && <p className="text-sm text-red-400">{errorText}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full sm:w-auto bg-[var(--accent)] px-6 py-3 text-sm font-bold tracking-wide text-[var(--background)] transition hover:bg-[var(--accent-glow)] disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        {pending ? (
          <>
            <span className="spinner" />
            {t("reports.generating")}
          </>
        ) : (
          <>+ {t("reports.generate")}</>
        )}
      </button>
      {pending && (
        <p className="text-xs text-[var(--muted)]">
          (生成需要 30 秒到 2 分鐘，請耐心等待)
        </p>
      )}
    </form>
  );
}

function Picker({
  brandId,
  state,
  action,
  pending,
}: {
  brandId: string;
  state: Extract<GenerateState, { needsSelection: true }>;
  action: (payload: FormData) => void;
  pending: boolean;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showUpload, setShowUpload] = useState(false);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="border border-[var(--accent)]/40 bg-[var(--surface)] p-5 space-y-5">
      <div>
        <div className="font-mono text-xs tracking-widest text-[var(--accent)] mb-2">
          ⚠ {t("reports.select.heading")}
        </div>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          {t("reports.select.body.before")}
          <span className="text-[var(--foreground)] font-medium">{state.focus || "—"}</span>
          {t("reports.select.body.after")}
        </p>
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="brandId" value={brandId} />
        <input type="hidden" name="focus" value={state.focus} />
        <input type="hidden" name="sections" value={state.sections} />
        <input type="hidden" name="tone" value={state.tone} />
        <input type="hidden" name="length" value={state.length} />
        <input type="hidden" name="lang" value={state.lang} />

        <div>
          <div className="text-xs font-medium tracking-wide text-[var(--muted)] mb-2">
            {t("reports.select.docs")}
          </div>
          <ul className="space-y-1 max-h-64 overflow-y-auto border border-[var(--line)] bg-[var(--surface-2)] p-2">
            {state.documents.map((d) => (
              <li key={d.id}>
                <label className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-[var(--surface)] text-sm">
                  <input
                    type="checkbox"
                    name="docId"
                    value={d.id}
                    checked={selected.has(d.id)}
                    onChange={() => toggle(d.id)}
                    className="accent-[var(--accent)]"
                  />
                  <span className="truncate">{d.filename}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending || selected.size === 0}
            className="bg-[var(--accent)] px-5 py-2.5 text-sm font-bold tracking-wide text-[var(--background)] transition hover:bg-[var(--accent-glow)] disabled:opacity-50 inline-flex items-center gap-2"
          >
            {pending ? (
              <>
                <span className="spinner" />
                {t("reports.generating")}
              </>
            ) : (
              <>+ {t("reports.select.generate")}</>
            )}
          </button>
          {selected.size === 0 && (
            <span className="text-xs text-[var(--muted)]">{t("reports.select.empty_pick")}</span>
          )}
        </div>
      </form>

      <div className="pt-4 border-t border-[var(--line)]">
        <button
          type="button"
          onClick={() => setShowUpload((v) => !v)}
          className="text-xs text-[var(--accent)] hover:underline"
        >
          {showUpload ? "× 收起上傳" : `+ ${t("reports.select.upload")}`}
        </button>
        {showUpload && (
          <div className="mt-3 p-3 bg-[var(--surface-2)] border border-[var(--line)]">
            <Uploader brandId={brandId} />
            <p className="mt-2 text-xs text-[var(--muted)]">
              {t("reports.select.upload_hint")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
