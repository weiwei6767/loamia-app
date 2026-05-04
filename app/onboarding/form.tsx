"use client";

import { useActionState } from "react";
import { createAgency, type OnboardState } from "./actions";
import { useI18n } from "@/lib/i18n/provider";

export function OnboardForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<OnboardState, FormData>(createAgency, undefined);

  return (
    <form action={action} className="border border-[var(--line)] bg-[var(--surface)] p-8 space-y-4">
      <div>
        <label htmlFor="name" className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--muted)]">
          {t("onboard.field")}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={80}
          placeholder={t("onboard.placeholder")}
          className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-sm focus:border-[var(--accent)] focus:outline-none"
        />
      </div>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[var(--accent)] py-3 text-sm font-bold tracking-wide text-[var(--background)] transition hover:bg-[var(--accent-glow)] disabled:opacity-50"
      >
        {pending ? t("onboard.creating") : t("onboard.submit")}
      </button>
    </form>
  );
}
