"use client";

import { useActionState } from "react";
import { createBrand, type BrandState } from "./actions";

export function BrandCreate() {
  const [state, action, pending] = useActionState<BrandState, FormData>(createBrand, undefined);

  return (
    <form action={action} className="flex flex-col sm:flex-row gap-3">
      <input
        name="name"
        type="text"
        required
        maxLength={80}
        placeholder="新品牌名稱"
        className="flex-1 border border-[var(--line)] bg-[var(--surface-2)] px-4 py-2.5 text-sm focus:border-[var(--accent)] focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="bg-[var(--accent)] px-6 py-2.5 text-sm font-bold tracking-wide text-[var(--background)] transition hover:bg-[var(--accent-glow)] disabled:opacity-50"
      >
        {pending ? "..." : "+ 新增品牌"}
      </button>
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
    </form>
  );
}
