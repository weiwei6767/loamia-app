import "server-only";

export type Recurrence = "daily" | "weekly" | "hourly";

/**
 * Compute the next run timestamp.
 * - daily: next occurrence of HH:MM (in user's local TZ) today or tomorrow
 * - weekly: next occurrence of weekday + HH:MM
 * - hourly: now + intervalHours hours (timeOfDay/weekday/tzOffset ignored)
 */
export function computeNextRun(
  now: Date,
  recurrence: Recurrence,
  timeOfDay: string,
  weekday: number | null,
  tzOffsetMinutes: number = 0,
  intervalHours: number | null = null
): Date {
  if (recurrence === "hourly") {
    const hours = intervalHours && intervalHours >= 1 ? Math.min(24, intervalHours) : 1;
    return new Date(now.getTime() + hours * 3600 * 1000);
  }

  const [hh, mm] = timeOfDay.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) {
    throw new Error("invalid time_of_day");
  }

  const userNowMs = now.getTime() - tzOffsetMinutes * 60 * 1000;
  const userNow = new Date(userNowMs);

  const candidate = new Date(userNow);
  candidate.setUTCHours(hh, mm, 0, 0);

  if (recurrence === "daily") {
    if (candidate.getTime() <= userNow.getTime()) {
      candidate.setUTCDate(candidate.getUTCDate() + 1);
    }
  } else {
    const targetWeekday = weekday ?? 1;
    const currentWeekday = candidate.getUTCDay();
    let daysAhead = (targetWeekday - currentWeekday + 7) % 7;
    if (daysAhead === 0 && candidate.getTime() <= userNow.getTime()) daysAhead = 7;
    candidate.setUTCDate(candidate.getUTCDate() + daysAhead);
  }

  return new Date(candidate.getTime() + tzOffsetMinutes * 60 * 1000);
}
