import "server-only";

export type Recurrence = "daily" | "weekly";

/**
 * Compute the next run timestamp given the current time, recurrence, optional weekday, and time of day (HH:MM).
 *
 * - daily: next occurrence of HH:MM today or tomorrow
 * - weekly: next occurrence of weekday at HH:MM (weekday: 0=Sun..6=Sat)
 */
export function computeNextRun(
  now: Date,
  recurrence: Recurrence,
  timeOfDay: string,
  weekday: number | null
): Date {
  const [hh, mm] = timeOfDay.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) {
    throw new Error("invalid time_of_day");
  }

  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hh, mm, 0, 0);

  if (recurrence === "daily") {
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }

  // weekly
  const targetWeekday = weekday ?? 1; // default Mon
  const currentWeekday = next.getDay();
  let daysAhead = (targetWeekday - currentWeekday + 7) % 7;
  if (daysAhead === 0 && next <= now) daysAhead = 7;
  next.setDate(next.getDate() + daysAhead);
  return next;
}
