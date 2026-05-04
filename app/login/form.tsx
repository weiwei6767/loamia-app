"use client";

import { useActionState, useState } from "react";
import { login, signup, type AuthState } from "@/app/auth/actions";
import { useI18n } from "@/lib/i18n/provider";

export function LoginForm() {
  const { t } = useI18n();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const action = mode === "login" ? login : signup;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, undefined);

  return (
    <div className="border border-[var(--line)] bg-[var(--surface)] p-8">
      <div className="mb-6 flex gap-2 border-b border-[var(--line)]">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`pb-3 px-3 text-sm font-medium transition ${
            mode === "login" ? "border-b-2 border-[var(--accent)] text-[var(--accent)]" : "text-[var(--muted)]"
          }`}
        >
          {t("auth.tab.login")}
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`pb-3 px-3 text-sm font-medium transition ${
            mode === "signup" ? "border-b-2 border-[var(--accent)] text-[var(--accent)]" : "text-[var(--muted)]"
          }`}
        >
          {t("auth.tab.signup")}
        </button>
      </div>

      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--muted)]">
            {t("auth.email")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-sm focus:border-[var(--accent)] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--muted)]">
            {t("auth.password")}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={mode === "signup" ? 8 : undefined}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-sm focus:border-[var(--accent)] focus:outline-none"
          />
          {mode === "signup" && (
            <p className="mt-1 text-xs text-[var(--muted)]">{t("auth.password.hint")}</p>
          )}
        </div>

        {state?.error && (
          <p className="text-sm text-red-400">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full bg-[var(--accent)] py-3 text-sm font-bold tracking-wide text-[var(--background)] transition hover:bg-[var(--accent-glow)] disabled:opacity-50"
        >
          {pending ? "..." : mode === "login" ? t("auth.submit.login") : t("auth.submit.signup")}
        </button>
      </form>
    </div>
  );
}
