import "server-only";

export type Recurrence = "daily" | "weekly";

/**
 * Compute the next run timestamp given the current UTC moment, recurrence,
 * optional weekday, time-of-day (HH:MM in user's local TZ), and the user's
 * timezone offset in minutes (Date.getTimezoneOffset() — Taipei = -480).
 */
export function computeNextRun(
  now: Date,
  recurrence: Recurrence,
  timeOfDay: string,
  weekday: number | null,
  tzOffsetMinutes: number = 0
): Date {
  const [hh, mm] = timeOfDay.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) {
    throw new Error("invalid time_of_day");
  }

  // Convert "now" into a Date whose UTC components reflect the user's local clock.
  // Trick: subtract offsetMinutes so getUTC* methods return user-local values.
  const userNowMs = now.getTime() - tzOffsetMinutes * 60 * 1000;
  const userNow = new Date(userNowMs);

  // Build candidate at HH:MM "today" in user-local space
  const candidate = new Date(userNow);
  candidate.setUTCHours(hh, mm, 0, 0);

  if (recurrence === "daily") {
    if (candidate.getTime() <= userNow.getTime()) {
      candidate.setUTCDate(candidate.getUTCDate() + 1);
    }
  } else {
    // weekly
    const targetWeekday = weekday ?? 1;
    const currentWeekday = candidate.getUTCDay();
    let daysAhead = (targetWeekday - currentWeekday + 7) % 7;
    if (daysAhead === 0 && candidate.getTime() <= userNow.getTime()) daysAhead = 7;
    candidate.setUTCDate(candidate.getUTCDate() + daysAhead);
  }

  // Convert user-local moment back to UTC
  return new Date(candidate.getTime() + tzOffsetMinutes * 60 * 1000);
}
