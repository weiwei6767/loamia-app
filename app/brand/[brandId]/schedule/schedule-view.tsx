"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createScheduledPost,
  bulkCreateScheduledPosts,
  cancelScheduledPost,
  deleteScheduledPost,
  createPostTemplate,
  toggleTemplateActive,
  deletePostTemplate,
  type ScheduleState,
  type BulkScheduleState,
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
  recurrence: "daily" | "weekly";
  weekday: number | null;
  time_of_day: string;
  next_run_at: string;
  active: boolean;
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
        <div className="border border-yellow-400/40 bg-yellow-400/5 p-4 text-sm">
          ⚠️ 尚未連接 Threads 帳號。
          <a href={`/brand/${brandId}/monitor`} className="ml-2 underline text-[var(--accent)]">
            前往 MONITOR 連接 →
          </a>
          連接後排程貼文才能實際發送。
        </div>
      )}
      {threadsUsername && (
        <div className="text-xs text-[var(--muted)] font-mono">
          🧵 將以 <span className="text-[var(--accent)]">@{threadsUsername}</span> 身份發送
        </div>
      )}

      <SinglePostScheduler brandId={brandId} />
      <BulkScheduler brandId={brandId} />
      <TemplateScheduler brandId={brandId} templates={templates} />
      <PendingList posts={pending} brandId={brandId} />
      <HistoryList posts={history} brandId={brandId} />
    </div>
  );
}

function SinglePostScheduler({ brandId }: { brandId: string }) {
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
        </div>
        {state && "error" in state && (
          <p className="text-xs text-red-400 whitespace-pre-wrap">{state.error}</p>
        )}
      </form>
    </section>
  );
}

function BulkScheduler({ brandId }: { brandId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<BulkScheduleState, FormData>(
    bulkCreateScheduledPosts,
    undefined
  );

  useEffect(() => {
    if (state && "success" in state && state.success && formRef.current) {
      formRef.current.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <section className="border border-[var(--line)] bg-[var(--surface)] p-5 space-y-4">
      <div>
        <div className="font-mono text-xs tracking-widest text-[var(--accent)]">
          2. 批次排程
        </div>
        <h3 className="mt-1 text-lg font-bold">一次部署多篇</h3>
        <p className="mt-1 text-xs text-[var(--muted)] leading-relaxed">
          每筆用 <code className="text-[var(--accent)]">===POST===</code> 分隔，每筆第一行為 ISO 時間（例 2026-05-10T09:00），其後為貼文內文。
        </p>
      </div>

      <form ref={formRef} action={action} className="space-y-3">
        <input type="hidden" name="brandId" value={brandId} />
        <input
          type="hidden"
          name="tzOffsetMinutes"
          value={typeof window !== "undefined" ? new Date().getTimezoneOffset() : 0}
        />
        <textarea
          name="blob"
          rows={10}
          required
          placeholder={`2026-05-10T09:00\n早安！本週咖啡新品上市，買一送一活動到週日 ☕\n===POST===\n2026-05-12T18:00\n感謝大家熱烈支持，第二波預購開放！`}
          className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm font-mono focus:border-[var(--accent)] focus:outline-none leading-relaxed"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-[var(--accent)] px-5 py-2 text-xs font-bold tracking-wide text-[var(--background)] hover:bg-[var(--accent-glow)] transition disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {pending ? <><span className="spinner" /> 處理中</> : "📅📅 批次排程"}
        </button>
        {state && "error" in state && (
          <p className="text-xs text-red-400 whitespace-pre-wrap">{state.error}</p>
        )}
        {state && "success" in state && state.success && (
          <p className="text-xs text-[var(--accent)]">✓ 已建立 {state.count} 筆排程</p>
        )}
      </form>
    </section>
  );
}

function TemplateScheduler({
  brandId,
  templates,
}: {
  brandId: string;
  templates: Template[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ScheduleState, FormData>(
    createPostTemplate,
    undefined
  );
  const [recurrence, setRecurrence] = useState<"daily" | "weekly">("daily");
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
            3. 自動發文模板（每日／每週 AI 產出）
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
              onChange={(e) => setRecurrence(e.target.value as "daily" | "weekly")}
              className="border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
            >
              <option value="daily">每天</option>
              <option value="weekly">每週</option>
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
            <input
              name="timeOfDay"
              type="time"
              required
              defaultValue="09:00"
              className="border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={pending}
              className="bg-[var(--accent)] px-4 py-2 text-xs font-bold tracking-wide text-[var(--background)] hover:bg-[var(--accent-glow)] transition disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {pending ? <><span className="spinner" /> 建立中</> : "✓ 建立模板"}
            </button>
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
  const [pending, startTransition] = useTransition();
  const recur =
    template.recurrence === "daily"
      ? `每天 ${template.time_of_day}`
      : `每${WEEKDAYS[template.weekday ?? 1]} ${template.time_of_day}`;

  return (
    <li
      className={`border p-4 ${
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
          <div className="mt-2 text-xs text-[var(--muted)] leading-relaxed line-clamp-3 whitespace-pre-wrap">
            {template.prompt}
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
    </li>
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
  const [pending, startTransition] = useTransition();

  return (
    <section className="border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
      <div className="font-mono text-xs tracking-widest text-[var(--muted)]">
        歷史 · {posts.length}
      </div>
      {posts.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">尚無歷史</p>
      ) : (
        <ul className="space-y-2">
          {posts.slice(0, 30).map((p) => {
            const ok = p.status === "sent";
            const fail = p.status === "failed";
            return (
              <li
                key={p.id}
                className="border border-[var(--line)] bg-[var(--surface-2)] p-3 flex items-start gap-3"
              >
                <span className={`shrink-0 text-xs ${ok ? "text-[var(--accent)]" : fail ? "text-red-400" : "text-[var(--muted)]"}`}>
                  {ok ? "✓" : fail ? "✕" : "⊘"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-[var(--muted)] font-mono">
                    {p.sent_at ? `已發送 ${new Date(p.sent_at).toLocaleString()}` : `排程 ${new Date(p.scheduled_at).toLocaleString()}`}
                    {p.template_id ? " · 模板" : ""}
                  </div>
                  <div className="mt-1 text-sm leading-relaxed whitespace-pre-wrap line-clamp-2">{p.text}</div>
                  {p.error_message && (
                    <div className="mt-1 text-xs text-red-400">{p.error_message}</div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm("從歷史刪除？")) return;
                    startTransition(() => deleteScheduledPost(p.id, brandId));
                  }}
                  className="shrink-0 text-[10px] text-[var(--muted)] hover:text-red-400 transition disabled:opacity-50"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
