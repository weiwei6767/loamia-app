"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { disconnectThreads } from "./monitor/actions";

type Connection = {
  username: string | null;
  token_expires_at: string | null;
  created_at: string;
};

export function ThreadsConnectionWidget({
  brandId,
  connection,
}: {
  brandId: string;
  connection: Connection | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmStep, setConfirmStep] = useState(false);

  function handleDisconnect() {
    setConfirmStep(false);
    startTransition(async () => {
      await disconnectThreads(brandId);
      router.refresh();
    });
  }

  if (!connection) {
    return (
      <section className="border border-yellow-400/30 bg-yellow-400/5 p-4 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-mono text-xs tracking-widest text-yellow-400">
              🧵 THREADS 連接
            </div>
            <div className="mt-1 text-sm">尚未連接</div>
            <div className="mt-1 text-[10px] text-[var(--muted)] leading-relaxed">
              連接後可使用：海巡關鍵字搜尋（待 Meta App Review）/ 直接發送回覆 / 排程貼文
            </div>
          </div>
          <a
            href={`/api/auth/threads/start?brandId=${brandId}`}
            className="bg-[var(--accent)] px-4 py-2 text-xs font-bold tracking-wide text-[var(--background)] hover:bg-[var(--accent-glow)] transition"
          >
            🧵 連接 Threads
          </a>
        </div>
      </section>
    );
  }

  // Compute token expiry
  let expiryText = "—";
  let isExpiringSoon = false;
  let isExpired = false;
  if (connection.token_expires_at) {
    const exp = new Date(connection.token_expires_at);
    const daysLeft = Math.floor((exp.getTime() - Date.now()) / 86400000);
    if (daysLeft < 0) {
      isExpired = true;
      expiryText = `已於 ${exp.toLocaleDateString()} 過期`;
    } else if (daysLeft <= 7) {
      isExpiringSoon = true;
      expiryText = `${daysLeft} 天後過期`;
    } else {
      expiryText = `${daysLeft} 天後過期（${exp.toLocaleDateString()}）`;
    }
  }

  return (
    <section className="border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="font-mono text-xs tracking-widest text-[var(--accent)]">
            🧵 THREADS 連接
          </div>
          <div className="mt-1 text-sm">
            ✓ 已連接 <span className="font-bold">@{connection.username ?? "unknown"}</span>
          </div>
          <div className="mt-1 text-[10px] text-[var(--muted)] font-mono">
            連接於 {new Date(connection.created_at).toLocaleDateString()} · Token{" "}
            <span
              className={
                isExpired
                  ? "text-red-400"
                  : isExpiringSoon
                    ? "text-yellow-400"
                    : "text-[var(--muted)]"
              }
            >
              {expiryText}
            </span>
          </div>
        </div>

        {!confirmStep ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmStep(true)}
            className="text-xs px-3 py-1.5 border border-[var(--line)] text-[var(--muted)] hover:border-red-400 hover:text-red-400 transition disabled:opacity-50"
          >
            ✕ 斷開連接
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-yellow-400">確定？</span>
            <button
              type="button"
              disabled={pending}
              onClick={handleDisconnect}
              className="text-xs px-3 py-1.5 border border-red-400 bg-red-400 text-[var(--background)] font-bold hover:bg-red-500 transition disabled:opacity-50"
            >
              {pending ? "處理中..." : "✕ 確認斷開"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmStep(false)}
              className="text-xs px-3 py-1.5 text-[var(--muted)]"
            >
              取消
            </button>
          </div>
        )}
      </div>

      <details className="text-[10px] text-[var(--muted)] leading-relaxed">
        <summary className="cursor-pointer hover:text-[var(--foreground)]">
          ℹ 連接安全機制
        </summary>
        <div className="mt-2 space-y-1.5 pl-3 border-l border-[var(--line)]">
          <p>
            • <strong>Loamia 端斷開</strong>：點上方「✕ 斷開連接」會立即刪除我們資料庫中的 access token，所有排程／自動模板將無法繼續發送。
          </p>
          <p>
            • <strong>Threads 端撤銷</strong>：你也可以隨時到 Threads App → 設定 → 帳號 → 網站權限 → 找 Loamia → 撤銷。Threads 會立即作廢 token，即使我們資料庫還有舊值也無法使用。
          </p>
          <p>
            • <strong>Token 有效期 60 天</strong>：到期前我們會嘗試自動更新；不更新則自動失效。建議若不再合作，主動執行上方斷開。
          </p>
          <p>
            • <strong>不會被「一直喚醒」</strong>：我們僅在你下指令時（手動發送 / 排程到期 / 模板觸發）才呼叫 Threads API；token 也不會被分享給其他品牌。
          </p>
        </div>
      </details>
    </section>
  );
}
