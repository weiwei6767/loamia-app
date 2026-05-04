"use client";

import { useTransition } from "react";
import { setBrandStatus } from "./actions";
import { useI18n } from "@/lib/i18n/provider";

export function BrandStatusToggle({
  brandId,
  status,
}: {
  brandId: string;
  status: "active" | "archived";
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const isActive = status === "active";

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(() => setBrandStatus(brandId, isActive ? "archived" : "active"))
      }
      disabled={pending}
      className={`text-xs px-3 py-1.5 border transition disabled:opacity-50 ${
        isActive
          ? "border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--background)]"
          : "border-[var(--line)] text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      {pending ? <span className="spinner mr-2" /> : null}
      {isActive ? t("brand.status.active") : t("brand.status.archived")}
    </button>
  );
}
