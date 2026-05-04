"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateReport,
  saveTemplate,
  deleteTemplate,
  saveSectionPreset,
  deleteSectionPreset,
  analyzeReferenceStyle,
  deleteCustomStyle,
  type GenerateState,
  type SaveTemplateState,
  type CustomStyleState,
} from "./actions";
import { useI18n } from "@/lib/i18n/provider";
import { Uploader } from "../uploader";
import { STYLES, STYLE_KEYS, type StyleKey } from "@/lib/ai/styles";

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

export type SavedTemplate = {
  id: string;
  name: string;
  sections: string[];
  tone: string | null;
  length: string | null;
  lang: string | null;
  style: string | null;
};

export type SectionPreset = {
  id: string;
  name: string;
  sections: string[];
};

export type CustomStyleRow = {
  id: string;
  name: string;
  analysis: string;
};

export function GenerateForm({
  brandId,
  templates,
  sectionPresets,
  customStyles,
}: {
  brandId: string;
  templates: SavedTemplate[];
  sectionPresets: SectionPreset[];
  customStyles: CustomStyleRow[];
}) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState<GenerateState, FormData>(generateReport, undefined);

  const isPicker = state && "needsSelection" in state && state.needsSelection;

  const [focus, setFocus] = useState("");
  const [sections, setSections] = useState(SECTION_TEMPLATES.standard[locale]);
  const [tone, setTone] = useState("professional");
  const [length, setLength] = useState("standard");
  const [lang, setLang] = useState<"zh" | "en">(locale);
  const [style, setStyle] = useState<StyleKey | "">("");
  const [customStyleId, setCustomStyleId] = useState("");
  const [period, setPeriod] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetMsg, setPresetMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [presetPending, setPresetPending] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>("system:standard");
  const router = useRouter();

  async function handleSavePreset() {
    setPresetMsg(null);
    if (!presetName.trim()) {
      setPresetMsg({ kind: "err", text: "請輸入模板名稱" });
      return;
    }
    setPresetPending(true);
    try {
      const fd = new FormData();
      fd.set("presetName", presetName);
      fd.set("sections", sections);
      fd.set("brandId", brandId);
      const result = await saveSectionPreset(undefined, fd);
      if (result && "success" in result && result.success) {
        setPresetMsg({ kind: "ok", text: result.success });
        setPresetName("");
        router.refresh();
        setTimeout(() => setPresetMsg(null), 2000);
      } else if (result && "error" in result && result.error) {
        setPresetMsg({ kind: "err", text: result.error });
      }
    } finally {
      setPresetPending(false);
    }
  }

  const errorText = (() => {
    if (!state || !("error" in state) || !state.error) return null;
    if (state.error === "no_documents") return t("reports.error.no_docs");
    return state.error;
  })();

  if (isPicker) {
    return <Picker brandId={brandId} state={state} action={action} pending={pending} />;
  }

  const setQuickTemplate = (key: keyof typeof SECTION_TEMPLATES) => {
    setSections(SECTION_TEMPLATES[key][lang]);
    setActivePreset(`system:${key}`);
  };

  const applyUserPreset = (preset: SectionPreset) => {
    setSections(preset.sections.join("\n"));
    setActivePreset(`user:${preset.id}`);
  };

  const loadTemplate = (id: string) => {
    if (!id) return;
    const tpl = templates.find((x) => x.id === id);
    if (!tpl) return;
    setSections(tpl.sections.join("\n"));
    if (tpl.tone) setTone(tpl.tone);
    if (tpl.length) setLength(tpl.length);
    if (tpl.lang === "zh" || tpl.lang === "en") setLang(tpl.lang);
    if (tpl.style && tpl.style in STYLES) setStyle(tpl.style as StyleKey);
    else setStyle("");
    setActivePreset(null);
  };

  return (
    <div className="space-y-3">
    <form action={action} className="border border-[var(--line)] bg-[var(--surface)] p-5 space-y-5">
      <input type="hidden" name="brandId" value={brandId} />

      {/* Saved templates dropdown */}
      <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-[var(--line)]">
        <span className="text-xs font-medium tracking-wide text-[var(--muted)]">
          {t("reports.template.load")}：
        </span>
        <select
          onChange={(e) => loadTemplate(e.target.value)}
          defaultValue=""
          className="text-xs border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1 focus:border-[var(--accent)] focus:outline-none"
        >
          <option value="">— {t("reports.template.empty")} —</option>
          {templates.map((tp) => (
            <option key={tp.id} value={tp.id}>{tp.name}</option>
          ))}
        </select>
        <ManageTemplates templates={templates} brandId={brandId} />
      </div>

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
        <label htmlFor="sections" className="mb-2 block text-xs font-medium tracking-wide text-[var(--muted)]">
          {t("reports.sections.label")}
        </label>

        <div className="flex flex-wrap gap-1.5 items-center mb-2">
          {(["standard", "campaign", "kol", "brief"] as const).map((k) => {
            const active = activePreset === `system:${k}`;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setQuickTemplate(k)}
                className={`text-xs px-2.5 py-1 border transition ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--background)] font-bold"
                    : "border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                }`}
              >
                {t(`reports.sections.template.${k}` as never)}
              </button>
            );
          })}
          {sectionPresets.map((p) => (
            <UserPresetButton
              key={p.id}
              preset={p}
              brandId={brandId}
              active={activePreset === `user:${p.id}`}
              onApply={() => applyUserPreset(p)}
            />
          ))}

          {/* Inline save: name + button */}
          <span className="inline-flex items-stretch">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSavePreset();
                }
              }}
              maxLength={60}
              placeholder={t("reports.section_preset.name.placeholder")}
              className="text-xs px-2 py-1 w-44 border border-[var(--line)] bg-[var(--surface-2)] focus:border-[var(--accent)] focus:outline-none"
            />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSavePreset();
              }}
              disabled={presetPending}
              className="text-xs px-3 py-1 border border-l-0 border-[var(--accent)] bg-[var(--accent)] text-[var(--background)] font-bold hover:bg-[var(--accent-glow)] disabled:opacity-50"
            >
              {presetPending ? "..." : t("reports.template.save.confirm")}
            </button>
          </span>
        </div>

        {presetMsg && (
          <p className={`text-xs mb-2 ${presetMsg.kind === "ok" ? "text-[var(--accent)]" : "text-red-400"}`}>
            {presetMsg.text}
          </p>
        )}

        <textarea
          id="sections"
          name="sections"
          rows={6}
          value={sections}
          onChange={(e) => {
            setSections(e.target.value);
            setActivePreset(null);
          }}
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

      {/* Period filter */}
      <div>
        <label htmlFor="period" className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--muted)]">
          {t("reports.period.label")}
        </label>
        <input
          id="period"
          name="period"
          type="text"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          maxLength={20}
          placeholder={t("reports.period.placeholder")}
          className="w-full sm:w-48 border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
        />
        <p className="mt-1 text-xs text-[var(--muted)]">{t("reports.period.hint")}</p>
      </div>

      {/* Style picker */}
      <div>
        <label className="mb-2 block text-xs font-medium tracking-wide text-[var(--muted)]">
          {t("reports.style.label")}
        </label>
        <input type="hidden" name="style" value={style} />
        <input type="hidden" name="customStyleId" value={customStyleId} />
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          <button
            type="button"
            onClick={() => {
              setStyle("");
              setCustomStyleId("");
            }}
            className={`relative aspect-[8/5] border text-xs flex items-center justify-center transition ${
              style === "" && !customStyleId
                ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30"
                : "border-[var(--line)] hover:border-[var(--accent)]/50"
            } bg-[var(--surface-2)]`}
          >
            <span className="text-[var(--muted)]">{t("reports.style.none")}</span>
          </button>
          {STYLE_KEYS.map((k) => {
            const s = STYLES[k];
            const active = style === k && !customStyleId;
            return (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setStyle(k);
                  setCustomStyleId("");
                }}
                className={`relative aspect-[8/5] border overflow-hidden transition ${
                  active
                    ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30"
                    : "border-[var(--line)] hover:border-[var(--accent)]/50"
                }`}
                title={s.desc[lang]}
              >
                <span
                  className="block w-full h-full"
                  dangerouslySetInnerHTML={{ __html: s.preview }}
                />
                <span className="absolute bottom-0 left-0 right-0 bg-[var(--surface)]/95 text-[10px] px-1 py-0.5 text-center truncate">
                  {t(`reports.style.${k}` as never)}
                </span>
              </button>
            );
          })}
          {customStyles.map((cs) => {
            const active = customStyleId === cs.id;
            return (
              <CustomStyleButton
                key={cs.id}
                style={cs}
                brandId={brandId}
                active={active}
                onSelect={() => {
                  setCustomStyleId(cs.id);
                  setStyle("");
                }}
              />
            );
          })}
        </div>
      </div>

      {errorText && <p className="text-sm text-red-400">{errorText}</p>}

      <div className="flex flex-wrap gap-3 items-start">
        <button
          type="submit"
          disabled={pending}
          className="bg-[var(--accent)] px-6 py-3 text-sm font-bold tracking-wide text-[var(--background)] transition hover:bg-[var(--accent-glow)] disabled:opacity-50 inline-flex items-center justify-center gap-2"
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

        <button
          type="button"
          onClick={() => setShowSave((v) => !v)}
          className="text-xs px-3 py-2 border border-[var(--line)] hover:border-[var(--accent)] text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          {showSave ? t("reports.template.cancel") : `+ ${t("reports.template.save")}`}
        </button>
      </div>

      {pending && (
        <p className="text-xs text-[var(--muted)]">
          (生成需要 30 秒到 2 分鐘，請耐心等待)
        </p>
      )}
    </form>

    {showSave && (
      <SaveTemplateInline
        brandId={brandId}
        opts={{ focus, sections, tone, length, lang, style }}
        onDone={() => setShowSave(false)}
      />
    )}

    <DocsUploadSection brandId={brandId} />
    <VisionUpload brandId={brandId} />
    </div>
  );
}

function DocsUploadSection({ brandId }: { brandId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[var(--line)] bg-[var(--surface)] p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left text-xs font-mono tracking-widest text-[var(--accent)] flex items-center justify-between hover:text-[var(--accent-glow)]"
      >
        <span>📄 {t("reports.docs.upload")}</span>
        <span className="text-base">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-[var(--muted)]">{t("reports.docs.help")}</p>
          <Uploader brandId={brandId} />
        </div>
      )}
    </div>
  );
}

function CustomStyleButton({
  style,
  brandId,
  active,
  onSelect,
}: {
  style: CustomStyleRow;
  brandId: string;
  active: boolean;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  return (
    <div
      className={`relative aspect-[8/5] border overflow-hidden transition ${
        active
          ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30"
          : "border-[var(--line)] hover:border-[var(--accent)]/50"
      } bg-[var(--surface-2)]`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="block w-full h-full text-xs px-2 flex items-center justify-center"
        title={style.analysis.slice(0, 200)}
      >
        <span className="text-[var(--accent)] font-medium truncate">{style.name}</span>
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.stopPropagation();
          if (!confirm(t("reports.vision.delete.confirm"))) return;
          startTransition(() => deleteCustomStyle(style.id, brandId));
        }}
        className="absolute top-0.5 right-0.5 w-5 h-5 text-[10px] text-[var(--muted)] hover:text-red-400 disabled:opacity-50"
        aria-label="delete"
      >
        ✕
      </button>
    </div>
  );
}

function VisionUpload({ brandId }: { brandId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [state, action, pending] = useActionState<CustomStyleState, FormData>(
    analyzeReferenceStyle,
    undefined
  );
  const [name, setName] = useState("");

  useEffect(() => {
    if (state && "success" in state && state.success) {
      router.refresh();
      setName("");
    }
  }, [state, router]);

  return (
    <div className="border border-dashed border-[var(--accent)]/40 bg-[var(--surface)] p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-[var(--accent)]">
        <span>📷</span>
        <span>{t("reports.vision.section")}</span>
      </div>
      <p className="text-xs text-[var(--muted)]">{t("reports.vision.help")}</p>
      <form action={action} className="space-y-2">
        <input type="hidden" name="brandId" value={brandId} />
        <input
          name="refImage"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          required
          className="block w-full text-xs text-[var(--muted)] file:mr-3 file:border-0 file:bg-[var(--surface-2)] file:px-3 file:py-1.5 file:text-xs file:text-[var(--foreground)] hover:file:bg-[var(--accent)] hover:file:text-[var(--background)]"
        />
        <div className="flex gap-2">
          <input
            name="styleName"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder={t("reports.vision.name.placeholder")}
            className="flex-1 text-xs px-2 py-1.5 border border-[var(--line)] bg-[var(--surface-2)] focus:border-[var(--accent)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending}
            className="text-xs px-3 py-1.5 bg-[var(--accent)] text-[var(--background)] font-bold hover:bg-[var(--accent-glow)] disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {pending ? (
              <>
                <span className="spinner" />
                {t("reports.vision.analyzing")}
              </>
            ) : (
              t("reports.vision.upload")
            )}
          </button>
        </div>
        {state && "error" in state && state.error && (
          <p className="text-xs text-red-400">{state.error}</p>
        )}
        {state && "success" in state && state.success && (
          <p className="text-xs text-[var(--accent)]">
            ✓ {t("reports.vision.success")}：{state.success}
          </p>
        )}
      </form>
    </div>
  );
}

function UserPresetButton({
  preset,
  brandId,
  active,
  onApply,
}: {
  preset: SectionPreset;
  brandId: string;
  active: boolean;
  onApply: () => void;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex items-stretch">
      <button
        type="button"
        onClick={onApply}
        className={`text-xs px-2.5 py-1 border transition ${
          active
            ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--background)] font-bold"
            : "border-[var(--accent)]/40 bg-[var(--surface-2)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        }`}
      >
        {preset.name}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(t("reports.section_preset.delete.confirm"))) return;
          startTransition(() => deleteSectionPreset(preset.id, brandId));
        }}
        className={`px-1.5 py-1 border border-l-0 text-xs disabled:opacity-50 ${
          active
            ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--background)] hover:bg-red-400"
            : "border-[var(--accent)]/40 text-[var(--muted)] hover:text-red-400"
        }`}
        aria-label="delete"
      >
        ✕
      </button>
    </span>
  );
}


function SaveTemplateInline({
  brandId,
  opts,
  onDone,
}: {
  brandId: string;
  opts: {
    focus: string;
    sections: string;
    tone: string;
    length: string;
    lang: string;
    style: string;
  };
  onDone: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [state, action, pending] = useActionState<SaveTemplateState, FormData>(saveTemplate, undefined);

  useEffect(() => {
    if (state && "success" in state && state.success) {
      router.refresh();
      const timer = setTimeout(onDone, 800);
      return () => clearTimeout(timer);
    }
  }, [state, router, onDone]);

  return (
    <form action={action} className="p-3 border border-[var(--accent)]/40 bg-[var(--surface-2)] flex flex-wrap items-center gap-2">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="focus" value={opts.focus} />
      <input type="hidden" name="sections" value={opts.sections} />
      <input type="hidden" name="tone" value={opts.tone} />
      <input type="hidden" name="length" value={opts.length} />
      <input type="hidden" name="lang" value={opts.lang} />
      <input type="hidden" name="style" value={opts.style} />

      <input
        name="templateName"
        type="text"
        required
        maxLength={60}
        placeholder={t("reports.template.name.placeholder")}
        className="flex-1 min-w-[200px] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="bg-[var(--accent)] px-4 py-2 text-xs font-bold tracking-wide text-[var(--background)] hover:bg-[var(--accent-glow)] disabled:opacity-50"
      >
        {pending ? "..." : t("reports.template.save.confirm")}
      </button>
      {state && "error" in state && state.error && (
        <span className="w-full text-xs text-red-400">{state.error}</span>
      )}
      {state && "success" in state && state.success && (
        <span className="w-full text-xs text-[var(--accent)]">{state.success}</span>
      )}
    </form>
  );
}

function ManageTemplates({
  templates,
  brandId,
}: {
  templates: SavedTemplate[];
  brandId: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (templates.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] underline"
      >
        {open ? t("reports.template.cancel") : "管理"}
      </button>
      {open && (
        <ul className="w-full mt-2 space-y-1">
          {templates.map((tp) => (
            <li
              key={tp.id}
              className="flex items-center justify-between gap-2 text-xs border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2"
            >
              <span className="truncate">{tp.name}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!confirm(t("reports.template.delete.confirm"))) return;
                  startTransition(() => deleteTemplate(tp.id, brandId));
                }}
                className="text-[var(--muted)] hover:text-red-400 disabled:opacity-50"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
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
        <input type="hidden" name="style" value={state.style} />
        <input type="hidden" name="customStyleId" value={state.customStyleId ?? ""} />
        <input type="hidden" name="period" value={state.period ?? ""} />

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
