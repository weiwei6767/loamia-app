"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createScheduledPost,
  cancelScheduledPost,
  deleteScheduledPost,
  createPostTemplate,
  toggleTemplateActive,
  deletePostTemplate,
  previewTemplateContent,
  saveTemplateNextText,
  clearTemplateNextText,
  updateTemplatePrompt,
  type ScheduleState,
  type PreviewState,
} from "./actions";

type Post = {
  id: string;
  text: string;
  scheduled_at: string;
  status: string;
  sent_at: string | null;
  sent_post_id: string | null;
  error_message: string | null;
  template_id: string | null;
};

type Template = {
  id: string;
  name: string;
  prompt: string;
  recurrence: "daily" | "weekly" | "hourly";
  weekday: number | null;
  time_of_day: string;
  interval_hours: number | null;
  next_run_at: string;
  active: boolean;
  next_post_text: string | null;
};

const WEEKDAYS = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

function localToUtcIso(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

function nowPlusMinLocalInput(minutes: number): string {
  const d = new Date(Date.now() + minutes * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleView({
  brandId,
  threadsUsername,
  posts,
  templates,
}: {
  brandId: string;
  threadsUsername: string | null;
  posts: Post[];
  templates: Template[];
}) {
  const pending = posts.filter((p) => p.status === "pending").sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));
  const history = posts.filter((p) => p.status !== "pending");

  return (
    <div className="space-y-10">
      {!threadsUsername && (
        <div className="border border-red-400/50 bg-red-400/5 p-4 text-sm">
          ⚠️ <strong>尚未連接 Threads 帳號</strong>——排程的貼文將無法發送
          <a href={`/brand/${brandId}/monitor`} className="ml-2 underline text-[var(--accent)]">
            前往 MONITOR 連接 →
          </a>
        </div>
      )}
      {threadsUsername && (
        <DestinationBanner brandId={brandId} username={threadsUsername} pendingCount={pending.length} />
      )}

      <SinglePostScheduler brandId={brandId} threadsUsername={threadsUsername} />
      <TemplateScheduler brandId={brandId} templates={templates} threadsUsername={threadsUsername} />
      <PendingList posts={pending} brandId={brandId} />
      <HistoryList posts={history} brandId={brandId} />
    </div>
  );
}

function DestinationBanner({
  brandId,
  username,
  pendingCount,
}: {
  brandId: string;
  username: string;
  pendingCount: number;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function runNow() {
    setRunning(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/brand/${brandId}/run-scheduler`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMsg({
          kind: "ok",
          text: `處理完成 · 已發送 ${data.sent} · 失敗 ${data.failed} · 模板觸發 ${data.templates_run}`,
        });
        setTimeout(() => router.refresh(), 600);
      } else {
        setMsg({ kind: "err", text: data.error ?? "執行失敗" });
      }
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "網路錯誤" });
    } finally {
      setRunning(false);
      setTimeout(() => setMsg(null), 6000);
    }
  }

  return (
    <div className="border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm">
          🧵 發送目的地：<span className="text-[var(--accent)] font-bold">Threads · @{username}</span>
          <span className="text-[var(--muted)] ml-2 text-xs">（每個品牌目前只能連一個 Threads）</span>
        </div>
        <button
          type="button"
          onClick={runNow}
          disabled={running}
          className="text-xs px-3 py-1.5 border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--background)] transition disabled:opacity-50 inline-flex items-center gap-1.5"
          title="立即處理所有到期的排程（不等 cron）"
        >
          {running ? <><span className="spinner" /> 執行中</> : `🔄 立即執行（${pendingCount} 待發）`}
        </button>
      </div>
      <p className="text-[10px] text-[var(--muted)] leading-relaxed">
        ⏰ 自動排程目前每天執行 1 次（Vercel Hobby 限制）。需要準時請手動「立即執行」，或升級 Pro 解鎖每分鐘執行。
      </p>
      {msg && (
        <p className={`text-xs ${msg.kind === "ok" ? "text-[var(--accent)]" : "text-red-400"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

function SinglePostScheduler({
  brandId,
  threadsUsername,
}: {
  brandId: string;
  threadsUsername: string | null;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ScheduleState, FormData>(
    createScheduledPost,
    undefined
  );

  useEffect(() => {
    if (state && "success" in state && state.success && formRef.current) {
      formRef.current.reset();
      router.refresh();
    }
  }, [state, router]);

  const minDateTime = nowPlusMinLocalInput(1);
  const [localDt, setLocalDt] = useState(minDateTime);

  return (
    <section className="border border-[var(--line)] bg-[var(--surface)] p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-mono text-xs tracking-widest text-[var(--accent)]">
            1. 排程單篇貼文
          </div>
          <h3 className="mt-1 text-lg font-bold">預約發送（手動輸入）</h3>
        </div>
        <a
          href={`/brand/${brandId}/content`}
          className="text-[10px] text-[var(--muted)] hover:text-[var(--accent)] transition border-b border-dashed border-[var(--line)] hover:border-[var(--accent)]"
        >
          💡 想用 AI 生？前往 CONTENT 生成後直接點 📅 排程 →
        </a>
      </div>

      <form ref={formRef} action={action} className="space-y-3">
        <input type="hidden" name="brandId" value={brandId} />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
            貼文內容（最多 500 字）
          </label>
          <textarea
            name="text"
            rows={4}
            maxLength={500}
            required
            placeholder="輸入要發到 Threads 的貼文..."
            className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none leading-relaxed"
          />
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
              發送時間（你的本地時間）
            </label>
            <input
              type="datetime-local"
              required
              min={minDateTime}
              value={localDt}
              onChange={(e) => setLocalDt(e.target.value)}
              className="border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
            />
            {/* Convert local-input to UTC ISO for the server */}
            <input type="hidden" name="scheduledAt" value={localToUtcIso(localDt)} />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="bg-[var(--accent)] px-5 py-2 text-xs font-bold tracking-wide text-[var(--background)] hover:bg-[var(--accent-glow)] transition disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {pending ? <><span className="spinner" /> 排程中</> : "📅 加入排程"}
          </button>
          {threadsUsername && (
            <span className="text-[10px] text-[var(--muted)] font-mono">→ @{threadsUsername}</span>
          )}
        </div>
        {state && "error" in state && (
          <p className="text-xs text-red-400 whitespace-pre-wrap">{state.error}</p>
        )}
      </form>
    </section>
  );
}

function TemplateScheduler({
  brandId,
  templates,
  threadsUsername,
}: {
  brandId: string;
  templates: Template[];
  threadsUsername: string | null;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ScheduleState, FormData>(
    createPostTemplate,
    undefined
  );
  const [recurrence, setRecurrence] = useState<"daily" | "weekly" | "hourly">("daily");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (state && "success" in state && state.success && formRef.current) {
      formRef.current.reset();
      setShowCreate(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <section className="border border-[var(--line)] bg-[var(--surface)] p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-mono text-xs tracking-widest text-[var(--accent)]">
            2. 自動發文模板（AI 依排程產出）
          </div>
          <h3 className="mt-1 text-lg font-bold">定時自動發文</h3>
          <p className="mt-1 text-xs text-[var(--muted)] leading-relaxed">
            設定一個 AI prompt，系統依排程定時呼叫 AI 產出貼文（會考慮 Brand Brain）並自動發送。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="text-xs px-3 py-1.5 border border-[var(--accent)]/50 text-[var(--accent)] hover:bg-[var(--accent)]/10 transition"
        >
          {showCreate ? "✕ 取消" : "+ 新增模板"}
        </button>
      </div>

      {showCreate && (
        <form ref={formRef} action={action} className="space-y-3 bg-[var(--surface-2)] p-4 border border-[var(--line)]">
          <input type="hidden" name="brandId" value={brandId} />
          <input
            type="hidden"
            name="tzOffsetMinutes"
            value={typeof window !== "undefined" ? new Date().getTimezoneOffset() : 0}
          />
          <input
            name="name"
            type="text"
            required
            maxLength={100}
            placeholder="模板名稱（例：每日早安貼文）"
            className="w-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
          />
          <textarea
            name="prompt"
            rows={4}
            required
            maxLength={1500}
            placeholder="AI Prompt（例：寫一則早安貼文，提及今日特餐，語氣親切活潑，不超過 200 字）"
            className="w-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none leading-relaxed"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <select
              name="recurrence"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as "daily" | "weekly" | "hourly")}
              className="border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
            >
              <option value="daily">每天</option>
              <option value="weekly">每週</option>
              <option value="hourly">每 N 小時</option>
            </select>
            {recurrence === "weekly" && (
              <select
                name="weekday"
                defaultValue="1"
                className="border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
              >
                {WEEKDAYS.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            )}
            {recurrence === "hourly" ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--muted)]">每</span>
                <input
                  name="intervalHours"
                  type="number"
                  min={1}
                  max={24}
                  required
                  defaultValue={3}
                  className="w-16 border border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
                />
                <span className="text-xs text-[var(--muted)]">小時</span>
              </div>
            ) : (
              <input
                name="timeOfDay"
                type="time"
                required
                defaultValue="09:00"
                className="border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
              />
            )}
            <button
              type="submit"
              disabled={pending}
              className="bg-[var(--accent)] px-4 py-2 text-xs font-bold tracking-wide text-[var(--background)] hover:bg-[var(--accent-glow)] transition disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {pending ? <><span className="spinner" /> 建立中</> : "✓ 建立模板"}
            </button>
            {threadsUsername && (
              <span className="text-[10px] text-[var(--muted)] font-mono">→ @{threadsUsername}</span>
            )}
          </div>
          {state && "error" in state && (
            <p className="text-xs text-red-400">{state.error}</p>
          )}
        </form>
      )}

      {templates.length === 0 ? (
        <p className="text-xs text-[var(--muted)] py-4">尚未建立任何模板</p>
      ) : (
        <ul className="space-y-2">
          {templates.map((tp) => (
            <TemplateCard key={tp.id} template={tp} brandId={brandId} />
          ))}
        </ul>
      )}
    </section>
  );
}

function TemplateCard({ template, brandId }: { template: Template; brandId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  let recur: string;
  if (template.recurrence === "hourly") {
    recur = `每 ${template.interval_hours ?? 1} 小時`;
  } else if (template.recurrence === "weekly") {
    recur = `每${WEEKDAYS[template.weekday ?? 1]} ${template.time_of_day}`;
  } else {
    recur = `每天 ${template.time_of_day}`;
  }

  return (
    <li
      className={`border p-4 space-y-3 ${
        template.active
          ? "border-[var(--accent)]/40 bg-[var(--surface-2)]"
          : "border-[var(--line)] bg-[var(--surface-2)]/50 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm">{template.name}</div>
          <div className="mt-1 text-[10px] text-[var(--accent)] font-mono tracking-wide">
            {recur} · {template.active ? "✓ 啟用中" : "⏸ 暫停"}
          </div>
          <div className="mt-2 text-[10px] text-[var(--muted)] font-mono">
            下次執行：{new Date(template.next_run_at).toLocaleString()}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(() => toggleTemplateActive(template.id, !template.active, brandId))
            }
            className="text-[10px] px-2 py-1 border border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition disabled:opacity-50"
          >
            {template.active ? "⏸ 暫停" : "▶ 啟用"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`刪除模板「${template.name}」？`)) return;
              startTransition(() => deletePostTemplate(template.id, brandId));
            }}
            className="text-[10px] px-2 py-1 border border-[var(--line)] text-[var(--muted)] hover:border-red-400 hover:text-red-400 transition disabled:opacity-50"
          >
            ✕ 刪除
          </button>
        </div>
      </div>

      <EditablePrompt template={template} brandId={brandId} onSaved={() => router.refresh()} />
      <EditableNextPost template={template} brandId={brandId} onChange={() => router.refresh()} />
    </li>
  );
}

function EditablePrompt({
  template,
  brandId,
  onSaved,
}: {
  template: Template;
  brandId: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(template.prompt);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await updateTemplatePrompt(template.id, brandId, draft);
      if (res.ok) {
        setEditing(false);
        setMsg("✓ 已儲存");
        setTimeout(() => setMsg(null), 2000);
        onSaved();
      } else {
        setMsg(`✕ ${res.error}`);
      }
    });
  }

  return (
    <div className="border border-[var(--line)] bg-[var(--surface)]/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2 flex items-center justify-between text-[10px] font-mono tracking-wide text-[var(--muted)] hover:text-[var(--foreground)] transition"
      >
        <span>📝 你給 AI 的 Prompt</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-[var(--line)] space-y-2">
          {editing ? (
            <>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={5}
                maxLength={1500}
                className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs leading-relaxed focus:border-[var(--accent)] focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={save}
                  className="text-[10px] px-3 py-1 bg-[var(--accent)] text-[var(--background)] font-bold hover:bg-[var(--accent-glow)] transition disabled:opacity-50"
                >
                  {pending ? "儲存中..." : "✓ 儲存"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(template.prompt);
                    setEditing(false);
                  }}
                  className="text-[10px] px-3 py-1 border border-[var(--line)] text-[var(--muted)]"
                >
                  取消
                </button>
                {msg && <span className="text-[10px] text-[var(--accent)]">{msg}</span>}
              </div>
            </>
          ) : (
            <>
              <div className="text-xs text-[var(--foreground)]/85 leading-relaxed whitespace-pre-wrap">
                {template.prompt}
              </div>
              <button
                type="button"
                onClick={() => {
                  setDraft(template.prompt);
                  setEditing(true);
                }}
                className="text-[10px] px-2 py-1 border border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
              >
                ✏️ 修改 Prompt
              </button>
              {msg && <span className="ml-2 text-[10px] text-[var(--accent)]">{msg}</span>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function EditableNextPost({
  template,
  brandId,
  onChange,
}: {
  template: Template;
  brandId: string;
  onChange: () => void;
}) {
  const [previewState, previewAction, previewPending] = useActionState<PreviewState, FormData>(
    previewTemplateContent,
    undefined
  );
  const [draft, setDraft] = useState(template.next_post_text ?? "");
  const [editingMode, setEditingMode] = useState(!!template.next_post_text);
  const [savePending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  // When AI generates a fresh preview, reset draft to the new text and enter editing mode
  useEffect(() => {
    if (previewState && "success" in previewState && previewState.success) {
      setDraft(previewState.preview);
      setEditingMode(true);
      onChange();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewState]);

  // Sync if template.next_post_text changes from outside
  useEffect(() => {
    setDraft(template.next_post_text ?? "");
    setEditingMode(!!template.next_post_text);
  }, [template.next_post_text]);

  function saveEdit() {
    setMsg(null);
    startTransition(async () => {
      const res = await saveTemplateNextText(template.id, brandId, draft);
      if (res.ok) {
        setMsg("✓ 已鎖定，下次到時間會發送這版");
        setTimeout(() => setMsg(null), 3000);
        onChange();
      } else {
        setMsg(`✕ ${res.error}`);
      }
    });
  }

  function clearLocked() {
    if (!confirm("清除鎖定的內容？下次到時間 AI 會重新生成新的版本。")) return;
    startTransition(async () => {
      await clearTemplateNextText(template.id, brandId);
      setDraft("");
      setEditingMode(false);
      setMsg("✓ 已清除，下次重新生成");
      setTimeout(() => setMsg(null), 2000);
      onChange();
    });
  }

  const hasLocked = !!template.next_post_text;

  return (
    <div className="border border-[var(--line)] bg-[var(--surface)]/50">
      <div className="px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[10px] font-mono tracking-wide text-[var(--muted)]">
          🔮 下次要發送的內容
          {hasLocked && (
            <span className="ml-1 text-[var(--accent)]">· 🔒 已鎖定</span>
          )}
        </span>
        <form action={previewAction} className="inline-flex">
          <input type="hidden" name="templateId" value={template.id} />
          <input type="hidden" name="brandId" value={brandId} />
          <button
            type="submit"
            disabled={previewPending}
            className="text-[10px] px-2 py-1 border border-[var(--accent)]/50 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--background)] transition disabled:opacity-50 inline-flex items-center gap-1"
          >
            {previewPending ? (
              <>
                <span className="spinner" /> 生成中
              </>
            ) : hasLocked ? (
              "↻ 重新生成"
            ) : (
              "✨ AI 生成下篇"
            )}
          </button>
        </form>
      </div>

      {editingMode && (
        <div className="px-3 pb-3 pt-1 border-t border-[var(--line)] space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            maxLength={500}
            placeholder="AI 生成的內容會出現在這裡，可手動修改..."
            className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs leading-relaxed focus:border-[var(--accent)] focus:outline-none whitespace-pre-wrap"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={savePending}
              onClick={saveEdit}
              className="text-[10px] px-3 py-1 bg-[var(--accent)] text-[var(--background)] font-bold hover:bg-[var(--accent-glow)] transition disabled:opacity-50"
            >
              {savePending ? "儲存中..." : "🔒 儲存並鎖定"}
            </button>
            {hasLocked && (
              <button
                type="button"
                disabled={savePending}
                onClick={clearLocked}
                className="text-[10px] px-3 py-1 border border-[var(--line)] text-[var(--muted)] hover:border-red-400 hover:text-red-400 transition disabled:opacity-50"
              >
                ✕ 清除（讓 AI 重新生成）
              </button>
            )}
            <span className="text-[10px] text-[var(--muted)]">
              {draft.length}/500
            </span>
            {msg && <span className="text-[10px] text-[var(--accent)]">{msg}</span>}
          </div>
          <p className="text-[10px] text-[var(--muted)] leading-relaxed">
            🔒 儲存後，下次到時間會發送**這個版本**（不重新生成）。<br/>
            清除後，下次 AI 會重新依 Prompt 產生。
          </p>
        </div>
      )}

      {previewState && "error" in previewState && (
        <p className="px-3 pb-3 text-[10px] text-red-400">{previewState.error}</p>
      )}
    </div>
  );
}

function PendingList({ posts, brandId }: { posts: Post[]; brandId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <section className="border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
      <div className="font-mono text-xs tracking-widest text-[var(--accent)]">
        待發送 · {posts.length}
      </div>
      {posts.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">無待發送貼文</p>
      ) : (
        <ul className="space-y-2">
          {posts.map((p) => (
            <li
              key={p.id}
              className="border border-[var(--line)] bg-[var(--surface-2)] p-3 flex items-start gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-[var(--accent)] font-mono">
                  {new Date(p.scheduled_at).toLocaleString()}
                  {p.template_id ? " · 來自模板" : ""}
                </div>
                <div className="mt-1 text-sm leading-relaxed whitespace-pre-wrap line-clamp-3">{p.text}</div>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!confirm("取消這則排程？")) return;
                  startTransition(() => cancelScheduledPost(p.id, brandId));
                }}
                className="shrink-0 text-[10px] px-2 py-1 border border-[var(--line)] text-[var(--muted)] hover:border-red-400 hover:text-red-400 transition disabled:opacity-50"
              >
                ✕ 取消
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function HistoryList({ posts, brandId }: { posts: Post[]; brandId: string }) {
  return (
    <section className="border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
      <div className="font-mono text-xs tracking-widest text-[var(--muted)]">
        歷史 · {posts.length}
      </div>
      {posts.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">尚無歷史</p>
      ) : (
        <ul className="space-y-2">
          {posts.slice(0, 30).map((p) => (
            <HistoryItem key={p.id} post={p} brandId={brandId} />
          ))}
        </ul>
      )}
    </section>
  );
}

function HistoryItem({ post: p, brandId }: { post: Post; brandId: string }) {
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const ok = p.status === "sent";
  const fail = p.status === "failed";
  const isLong = (p.text ?? "").length > 80;

  return (
    <li className="border border-[var(--line)] bg-[var(--surface-2)] p-3 space-y-2">
      <div className="flex items-start gap-3">
        <span className={`shrink-0 text-xs mt-0.5 ${ok ? "text-[var(--accent)]" : fail ? "text-red-400" : "text-[var(--muted)]"}`}>
          {ok ? "✓" : fail ? "✕" : "⊘"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-[var(--muted)] font-mono">
            {p.sent_at ? `已發送 ${new Date(p.sent_at).toLocaleString()}` : `排程 ${new Date(p.scheduled_at).toLocaleString()}`}
            {p.template_id ? " · 來自模板" : ""}
          </div>
          <div className={`mt-1 text-sm leading-relaxed whitespace-pre-wrap ${expanded ? "" : "line-clamp-2"}`}>
            {p.text}
          </div>
          {p.error_message && (
            <div className="mt-1 text-xs text-red-400 whitespace-pre-wrap">{p.error_message}</div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[10px] px-2 py-1 border border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
              title={expanded ? "收起" : "看完整內容"}
            >
              {expanded ? "▲ 收起" : "▼ 展開"}
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm("從歷史刪除？")) return;
              startTransition(() => deleteScheduledPost(p.id, brandId));
            }}
            className="text-[10px] text-[var(--muted)] hover:text-red-400 transition disabled:opacity-50 px-1"
          >
            ✕
          </button>
        </div>
      </div>
    </li>
  );
}
