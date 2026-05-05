"use client";

import { useActionState, useState } from "react";
import {
  searchThreads,
  disconnectThreads,
  postThreadsReply,
  type ThreadsSearchState,
  type ThreadsReplyState,
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
}: {
  brandId: string;
  connection: Connection | null;
  onUsePost: (post: ThreadsPost) => void;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<ThreadsSearchState, FormData>(
    searchThreads,
    undefined
  );
  const [searchType, setSearchType] = useState<"TOP" | "RECENT">("TOP");

  if (!connection) {
    return (
      <div className="border border-[var(--accent)]/40 bg-[var(--surface)] p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-mono text-xs tracking-widest text-[var(--accent)] mb-1">
              {t("monitor.threads.section")}
            </div>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              連接後可關鍵字搜尋 Threads 公開貼文 + AI 一鍵生成回覆
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
          <div className="font-mono text-xs tracking-widest text-[var(--muted)]">
            {t("monitor.threads.results")} · {results.length} ·「{query}」
          </div>
          {results.length === 0 ? (
            <p className="text-sm text-[var(--muted)] py-4 text-center">
              {t("monitor.threads.no_results")}
            </p>
          ) : (
            <ul className="space-y-2">
              {results.map((post) => (
                <li
                  key={post.id}
                  className="border border-[var(--line)] bg-[var(--surface-2)] p-3"
                >
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
                        {t("monitor.threads.open")} ↗
                      </a>
                    )}
                  </div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap mb-2">
                    {post.text ?? "(no text)"}
                  </div>
                  <button
                    type="button"
                    onClick={() => onUsePost(post)}
                    className="text-xs px-3 py-1.5 border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--background)] transition"
                  >
                    ↓ {t("monitor.threads.use_post")}
                  </button>
                </li>
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
        📤 直接發送回覆 (Beta)
      </div>
      <p className="text-xs text-[var(--muted)] leading-relaxed">
        貼上你自己 Threads 貼文網址，輸入回覆內容，直接以連接帳號發送。
        （非自己的貼文需 keyword_search 權限，待 Meta App Review 通過。）
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
        placeholder="輸入回覆內容..."
        className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none leading-relaxed"
      />
      {state && "error" in state && state.error && (
        <p className="text-xs text-red-400">{state.error}</p>
      )}
      {state && "success" in state && state.success && (
        <p className="text-xs text-[var(--accent)]">✓ 回覆已發送 (id: {state.replyId})</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-[var(--accent)] px-4 py-2 text-xs font-bold tracking-wide text-[var(--background)] hover:bg-[var(--accent-glow)] transition disabled:opacity-50 inline-flex items-center gap-1.5"
      >
        {pending ? (
          <>
            <span className="spinner" /> 發送中
          </>
        ) : (
          "📤 發送回覆"
        )}
      </button>
    </form>
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
