/**
 * date_utils.ts
 * -------------
 * Pure helpers for date formatting and period boundary calculations.
 * Port of src/date_utils.py — no UI or Supabase dependencies.
 *
 * All functions accept a `now` Date so they are easy to unit-test with a
 * fixed date.  Call with `new Date()` for real usage.
 *
 * Time zone: US Eastern (America/New_York) in the Python app.  On mobile the
 * device's local time zone is used, which is sufficient for a personal tracker.
 * If you need strict ET behaviour, pass `zonedTimeToUtc` from `date-fns-tz`.
 */

import type { Category } from "./config";

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  const mod = day % 10;
  if (mod === 1) return "st";
  if (mod === 2) return "nd";
  if (mod === 3) return "rd";
  return "th";
}

/**
 * Return a human-readable date string, e.g. "Monday, March 30th".
 * Mirrors format_date() in date_utils.py.
 */
export function formatDate(now: Date): string {
  const day = now.getDate();
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  const month   = now.toLocaleDateString("en-US", { month: "long" });
  return `${weekday}, ${month} ${day}${getDaySuffix(day)}`;
}

// ---------------------------------------------------------------------------
// Period keys
// ---------------------------------------------------------------------------

/**
 * Zero-pad a number to 2 digits.
 */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Return the ISO Monday date string for the week containing `now`.
 * JS Date: 0 = Sunday … 6 = Saturday; Python: 0 = Monday … 6 = Sunday.
 */
function isoMonday(now: Date): Date {
  const d = new Date(now);
  // getDay() → 0=Sun, 1=Mon … convert to Mon-based offset
  const dayOfWeek = d.getDay(); // 0=Sun
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setDate(d.getDate() - daysFromMonday);
  return d;
}

/**
 * Return a stable string key identifying the current period for `category`.
 * When a new period starts the key changes, causing old state to be ignored.
 *
 * Examples:
 *   daily     → "2026-03-30"
 *   weekly    → "week-2026-03-23"  (ISO Monday of the current week)
 *   monthly   → "month-2026-03"
 *   quarterly → "q1-2026"
 *
 * Mirrors get_period_key() in date_utils.py exactly.
 */
export function getPeriodKey(category: Category, now: Date): string {
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-based
  const d = now.getDate();

  if (category === "daily") {
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }

  if (category === "weekly") {
    const mon = isoMonday(now);
    const wy = mon.getFullYear();
    const wm = mon.getMonth() + 1;
    const wd = mon.getDate();
    return `week-${wy}-${pad2(wm)}-${pad2(wd)}`;
  }

  if (category === "monthly") {
    return `month-${y}-${pad2(m)}`;
  }

  // quarterly
  const q = Math.floor((m - 1) / 3) + 1;
  return `q${q}-${y}`;
}

// ---------------------------------------------------------------------------
// Period start dates (for DB range queries)
// ---------------------------------------------------------------------------

/**
 * Return the ISO "YYYY-MM-DD" start date for each category's current period.
 * Mirrors _get_period_start_dates() in db.py.
 */
export function getPeriodStartDates(now: Date): Record<Category, string> {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();

  const mon = isoMonday(now);
  const weekStart = `${mon.getFullYear()}-${pad2(mon.getMonth() + 1)}-${pad2(mon.getDate())}`;

  const qMonth = Math.floor((m - 1) / 3) * 3 + 1; // 1, 4, 7, or 10

  return {
    daily:     `${y}-${pad2(m)}-${pad2(d)}`,
    weekly:    weekStart,
    monthly:   `${y}-${pad2(m)}-01`,
    quarterly: `${y}-${pad2(qMonth)}-01`,
  };
}

// ---------------------------------------------------------------------------
// Reset dates (next boundary for each period)
// ---------------------------------------------------------------------------

/**
 * Return the next reset Date for each goal category.
 *   daily     → start of tomorrow
 *   weekly    → next Monday (or the coming Monday when today is Monday)
 *   monthly   → first day of next month
 *   quarterly → first day of next quarter
 *
 * Mirrors get_reset_dates() in date_utils.py.
 */
export function getResetDates(now: Date): Record<Category, Date> {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  const d = now.getDate();

  // tomorrow (midnight local)
  const tomorrow = new Date(y, m, d + 1);

  // next Monday
  const dayOfWeek = now.getDay(); // 0=Sun
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
  const nextMonday = new Date(y, m, d + daysUntilMonday);

  // first of next month
  const nextMonth = new Date(y, m + 1, 1);

  // first of next quarter
  const currentQuarter = Math.floor(m / 3);          // 0-based quarter index
  const nextQuarterMonth = (currentQuarter + 1) * 3; // 0-based month index (3, 6, 9, 12)
  const nextQuarter = nextQuarterMonth >= 12
    ? new Date(y + 1, 0, 1)
    : new Date(y, nextQuarterMonth, 1);

  return {
    daily:     tomorrow,
    weekly:    nextMonday,
    monthly:   nextMonth,
    quarterly: nextQuarter,
  };
}
