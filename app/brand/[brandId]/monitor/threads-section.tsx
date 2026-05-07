"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  searchThreads,
  disconnectThreads,
  postThreadsReply,
  generateOutreachReplyAction,
  sendOutreachReply,
  type ThreadsSearchState,
  type ThreadsReplyState,
  type OutreachStatus,
} from "./actions";
import { useI18n } from "@/lib/i18n/provider";

type Connection = {
  username: string | null;
  platform_user_id: string;
};

type ThreadsPost = {
  id: string;
  text?: string;
  permalink?: string;
  timestamp?: string;
  username?: string;
};

export function ThreadsSection({
  brandId,
  connection,
  onUsePost,
  outreachStatus,
}: {
  brandId: string;
  connection: Connection | null;
  onUsePost: (post: ThreadsPost) => void;
  outreachStatus: OutreachStatus;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<ThreadsSearchState, FormData>(
    searchThreads,
    undefined
  );
  const [searchType, setSearchType] = useState<"TOP" | "RECENT">("TOP");
  const [todaySent, setTodaySent] = useState(outreachStatus.todaySent);
  const recentUsernamesSet = new Set(outreachStatus.recentUsernames);

  if (!connection) {
    return (
      <div className="border border-[var(--accent)]/40 bg-[var(--surface)] p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-mono text-xs tracking-widest text-[var(--accent)] mb-1">
              {t("monitor.threads.section")}
            </div>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              {t("monitor.threads.section_subtitle")}
            </p>
          </div>
          <a
            href={`/api/auth/threads/start?brandId=${brandId}`}
            className="bg-[var(--accent)] px-4 py-2 text-sm font-bold tracking-wide text-[var(--background)] hover:bg-[var(--accent-glow)] transition inline-flex items-center gap-2"
          >
            🧵 {t("monitor.threads.connect")}
          </a>
        </div>
      </div>
    );
  }

  const results = state && "success" in state && state.success ? state.results : [];
  const query = state && "success" in state ? state.query : "";

  return (
    <div className="border border-[var(--line)] bg-[var(--surface)] p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">🧵</span>
          <div className="min-w-0">
            <div className="font-mono text-xs tracking-widest text-[var(--accent)]">
              {t("monitor.threads.connected")}
            </div>
            <div className="text-sm font-medium truncate">@{connection.username}</div>
          </div>
        </div>
        <DisconnectButton brandId={brandId} />
      </div>

      <form action={action} className="space-y-3">
        <input type="hidden" name="brandId" value={brandId} />
        <input type="hidden" name="searchType" value={searchType} />
        <div className="flex gap-2 flex-wrap">
          <input
            name="query"
            type="text"
            required
            maxLength={120}
            placeholder={t("monitor.threads.search.placeholder")}
            className="flex-1 min-w-[200px] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
          />
          <div className="flex border border-[var(--line)]">
            {(["TOP", "RECENT"] as const).map((tp) => (
              <button
                key={tp}
                type="button"
                onClick={() => setSearchType(tp)}
                className={`px-3 text-xs font-mono transition ${
                  searchType === tp
                    ? "bg-[var(--accent)] text-[var(--background)] font-bold"
                    : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {tp === "TOP"
                  ? t("monitor.threads.search.type.top")
                  : t("monitor.threads.search.type.recent")}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={pending}
            className="bg-[var(--accent)] px-4 py-2 text-xs font-bold tracking-wide text-[var(--background)] hover:bg-[var(--accent-glow)] transition disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {pending ? (
              <>
                <span className="spinner" />
                {t("monitor.threads.searching")}
              </>
            ) : (
              `🔍 ${t("monitor.threads.search.button")}`
            )}
          </button>
        </div>
      </form>

      {state && "error" in state && state.error && (
        <p className="text-xs text-red-400">{state.error}</p>
      )}

      {state && "success" in state && state.success && (
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="font-mono text-xs tracking-widest text-[var(--muted)]">
              {t("monitor.threads.results")} · {results.length} ·「{query}」
            </div>
            <OutreachCounter today={todaySent} limit={outreachStatus.dailyLimit} />
          </div>
          {results.length === 0 ? (
            <p className="text-sm text-[var(--muted)] py-4 text-center">
              {t("monitor.threads.no_results")}
            </p>
          ) : (
            <ul className="space-y-2">
              {results.map((post) => (
                <OutreachRow
                  key={post.id}
                  brandId={brandId}
                  post={post}
                  keyword={query}
                  cooldown={!!post.username && recentUsernamesSet.has(post.username)}
                  atLimit={todaySent >= outreachStatus.dailyLimit}
                  onSent={() => setTodaySent((n) => n + 1)}
                  onUsePost={onUsePost}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <DirectReplyForm brandId={brandId} />
    </div>
  );
}

function DirectReplyForm({ brandId }: { brandId: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<ThreadsReplyState, FormData>(
    postThreadsReply,
    undefined
  );

  return (
    <form
      action={action}
      className="border-t border-[var(--line)] pt-4 space-y-3"
    >
      <div className="font-mono text-xs tracking-widest text-[var(--accent)]">
        {t("monitor.threads.direct_reply.title")}
      </div>
      <p className="text-xs text-[var(--muted)] leading-relaxed">
        {t("monitor.threads.direct_reply.note")}
      </p>
      <input type="hidden" name="brandId" value={brandId} />
      <input
        name="url"
        type="url"
        required
        placeholder="https://www.threads.com/@xxx/post/..."
        className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
      />
      <textarea
        name="text"
        required
        rows={3}
        maxLength={500}
        placeholder={t("monitor.threads.direct_reply.text_placeholder")}
        className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none leading-relaxed"
      />
      {state && "error" in state && state.error && (
        <p className="text-xs text-red-400">{state.error}</p>
      )}
      {state && "success" in state && state.success && (
        <p className="text-xs text-[var(--accent)]">
          {t("monitor.threads.direct_reply.success").replace("{id}", state.replyId)}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-[var(--accent)] px-4 py-2 text-xs font-bold tracking-wide text-[var(--background)] hover:bg-[var(--accent-glow)] transition disabled:opacity-50 inline-flex items-center gap-1.5"
      >
        {pending ? (
          <>
            <span className="spinner" /> {t("monitor.threads.direct_reply.sending")}
          </>
        ) : (
          t("monitor.threads.direct_reply.button")
        )}
      </button>
    </form>
  );
}

function OutreachCounter({ today, limit }: { today: number; limit: number }) {
  const remaining = Math.max(0, limit - today);
  const danger = remaining === 0;
  const warn = remaining > 0 && remaining <= 5;
  return (
    <span
      className={`text-[10px] font-mono tracking-wide px-2 py-1 border ${
        danger
          ? "border-red-400/60 text-red-400 bg-red-400/5"
          : warn
            ? "border-yellow-400/60 text-yellow-400 bg-yellow-400/5"
            : "border-[var(--accent)]/40 text-[var(--accent)] bg-[var(--accent)]/5"
      }`}
      title="海巡每日總量上限"
    >
      🌊 今日已送 {today} / {limit}
    </span>
  );
}

type OutreachState =
  | { kind: "idle" }
  | { kind: "generating" }
  | { kind: "ready"; text: string }
  | { kind: "sending" }
  | { kind: "sent"; permalink?: string }
  | { kind: "error"; error: string };

function OutreachRow({
  brandId,
  post,
  keyword,
  cooldown,
  atLimit,
  onSent,
  onUsePost,
}: {
  brandId: string;
  post: ThreadsPost;
  keyword: string;
  cooldown: boolean;
  atLimit: boolean;
  onSent: () => void;
  onUsePost: (post: ThreadsPost) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<OutreachState>({ kind: "idle" });
  const [, startTransition] = useTransition();

  async function generate() {
    setState({ kind: "generating" });
    const res = await generateOutreachReplyAction(
      brandId,
      { id: post.id, text: post.text, username: post.username },
      keyword
    );
    if (res.ok) setState({ kind: "ready", text: res.reply });
    else setState({ kind: "error", error: res.error });
  }

  async function send() {
    if (state.kind !== "ready") return;
    const text = state.text.trim();
    if (!text) return;
    setState({ kind: "sending" });
    const res = await sendOutreachReply(
      brandId,
      { id: post.id, permalink: post.permalink, username: post.username },
      text,
      keyword
    );
    if (res.ok) {
      setState({ kind: "sent", permalink: post.permalink });
      onSent();
      startTransition(() => router.refresh());
    } else {
      setState({ kind: "error", error: res.error });
    }
  }

  const blocked = cooldown || atLimit;

  return (
    <li className="border border-[var(--line)] bg-[var(--surface-2)] p-3">
      <div className="flex items-center justify-between gap-2 mb-2 text-xs text-[var(--muted)]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-[var(--foreground)]">
            @{post.username ?? "unknown"}
          </span>
          {post.timestamp && (
            <span>· {new Date(post.timestamp).toLocaleDateString()}</span>
          )}
        </div>
        {post.permalink && (
          <a
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--muted)] hover:text-[var(--accent)] text-[10px]"
          >
            原貼文 ↗
          </a>
        )}
      </div>
      <div className="text-sm leading-relaxed whitespace-pre-wrap mb-2">
        {post.text ?? "(no text)"}
      </div>

      {/* Outreach panel */}
      <div className="border-t border-[var(--line)] pt-2 mt-2 space-y-2">
        {state.kind === "idle" && (
          <div className="flex items-center gap-2 flex-wrap">
            {cooldown ? (
              <span className="text-[11px] text-yellow-400">
                ⊘ 7 天內已對 @{post.username} 回過，跳過避免被視為 spam
              </span>
            ) : atLimit ? (
              <span className="text-[11px] text-red-400">
                ⊘ 今日上限已滿，明天再試
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={generate}
                  className="text-xs px-3 py-1.5 border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--background)] transition"
                >
                  ✨ AI 寫留言
                </button>
                <button
                  type="button"
                  onClick={() => onUsePost(post)}
                  className="text-xs px-3 py-1.5 border border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
                  title="改用下方手動三建議模式"
                >
                  ↓ 改手動模式
                </button>
              </>
            )}
          </div>
        )}

        {state.kind === "generating" && (
          <div className="text-xs text-[var(--muted)] inline-flex items-center gap-2">
            <span className="spinner" /> AI 正在寫留言…
          </div>
        )}

        {state.kind === "ready" && (
          <>
            <textarea
              value={state.text}
              onChange={(e) => setState({ kind: "ready", text: e.target.value })}
              rows={3}
              maxLength={200}
              className="w-full text-sm leading-relaxed border border-[var(--accent)]/40 bg-[var(--background)] px-2 py-1.5 focus:border-[var(--accent)] focus:outline-none"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={send}
                disabled={blocked || !state.text.trim()}
                className="text-xs px-3 py-1.5 bg-[var(--accent)] text-[var(--background)] font-bold hover:bg-[var(--accent-glow)] transition disabled:opacity-50"
              >
                📤 送出此留言
              </button>
              <button
                type="button"
                onClick={generate}
                className="text-xs px-3 py-1.5 border border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
              >
                ↻ 重生
              </button>
              <button
                type="button"
                onClick={() => setState({ kind: "idle" })}
                className="text-xs px-3 py-1.5 border border-[var(--line)] text-[var(--muted)] hover:text-[var(--foreground)] transition"
              >
                ✕ 取消
              </button>
              <span className="text-[10px] text-[var(--muted)]">
                {state.text.length}/200
              </span>
            </div>
          </>
        )}

        {state.kind === "sending" && (
          <div className="text-xs text-[var(--muted)] inline-flex items-center gap-2">
            <span className="spinner" /> 送出中（Threads 容器需 2-15 秒）…
          </div>
        )}

        {state.kind === "sent" && (
          <div className="text-xs text-[var(--accent)] inline-flex items-center gap-2">
            ✓ 已送出！
            {state.permalink && (
              <a
                href={state.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                查看原貼文 ↗
              </a>
            )}
          </div>
        )}

        {state.kind === "error" && (
          <div className="space-y-1">
            <p className="text-xs text-red-400">✕ {state.error}</p>
            <button
              type="button"
              onClick={() => setState({ kind: "idle" })}
              className="text-[10px] text-[var(--muted)] hover:text-[var(--foreground)] underline"
            >
              重試
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function DisconnectButton({ brandId }: { brandId: string }) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (!confirm(t("monitor.threads.disconnect_confirm"))) return;
        setPending(true);
        await disconnectThreads(brandId);
        setPending(false);
      }}
      className="text-xs px-3 py-1.5 border border-[var(--line)] text-[var(--muted)] hover:border-red-400 hover:text-red-400 transition disabled:opacity-50"
    >
      {pending ? <span className="spinner" /> : t("monitor.threads.disconnect")}
    </button>
  );
}
