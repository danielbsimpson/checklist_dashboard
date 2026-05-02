/**
 * db.ts
 * -----
 * All Supabase interactions: client initialisation, writing progress records,
 * and reading historical data.  Importing this module never throws — if
 * credentials are absent SUPABASE_ENABLED is false and every function
 * degrades gracefully.
 *
 * Save strategy (identical to db.py)
 * -----------------------------------
 * Goals are saved one task at a time, immediately when ticked.  The day's row
 * is upserted with a coalesce merge: existing 1s in Supabase are never
 * overwritten with 0s.  Multiple app opens throughout the day safely
 * accumulate all checked goals.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

import { ALL_TASKS, cleanColumnName, CATEGORIES } from "./config";
import type { Category } from "./config";
import { getPeriodStartDates } from "./date_utils";
import type { CompletedTasks, GoalsRow, SaveResult } from "./types";

// ---------------------------------------------------------------------------
// Client initialisation
// ---------------------------------------------------------------------------

const SUPABASE_URL  = process.env.EXPO_PUBLIC_SUPABASE_URL  ?? "";
const SUPABASE_KEY  = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const SUPABASE_ENABLED: boolean =
  SUPABASE_URL.length > 0 && SUPABASE_KEY.length > 0;

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    // On web, use localStorage directly to avoid AsyncStorage init hanging.
    const isWeb = typeof window !== "undefined" && typeof localStorage !== "undefined";
    _client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        storage: isWeb ? localStorage : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
      },
    });
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Column name helpers (mirrors db.py)
// ---------------------------------------------------------------------------

/** Return the DB column names for every task in a category. */
export function taskColumns(category: Category): string[] {
  return ALL_TASKS[category].map(cleanColumnName);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Fetch the existing row for today from Supabase.
 * Returns null if Supabase is unavailable or no row exists yet.
 */
export async function fetchTodayRow(now: Date): Promise<GoalsRow | null> {
  if (!SUPABASE_ENABLED) return null;
  try {
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const { data, error } = await getClient()
      .from("goals")
      .select("*")
      .eq("daily_date", dateStr)
      .limit(1);
    if (error) return null;
    return (data && data.length > 0) ? (data[0] as GoalsRow) : null;
  } catch {
    return null;
  }
}

/**
 * Fetch all rows from the start of the current quarter through today.
 *
 * This covers every period type — a weekly task ticked on Monday will still
 * appear as done when the app is opened on Thursday of the same week.
 * Mirrors fetch_period_rows() in db.py.
 */
export async function fetchPeriodRows(now: Date): Promise<GoalsRow[]> {
  if (!SUPABASE_ENABLED) return [];
  try {
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const qMonth = Math.floor((m - 1) / 3) * 3 + 1;
    const qStart = `${y}-${String(qMonth).padStart(2, "0")}-01`;
    const today  = `${y}-${String(m).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const timeout = new Promise<GoalsRow[]>((resolve) =>
      setTimeout(() => resolve([]), 10_000)
    );
    const query = getClient()
      .from("goals")
      .select("*")
      .gte("daily_date", qStart)
      .lte("daily_date", today)
      .then(({ data, error }) => {
        if (error || !data) return [];
        return data as GoalsRow[];
      });

    return await Promise.race([query, timeout]);
  } catch {
    return [];
  }
}

/**
 * Fetch the full goals table ordered by date (for dashboard charts).
 * Results are cached in AsyncStorage for 5 minutes to limit API calls.
 * Mirrors fetch_all_records() in db.py.
 */
const ALL_RECORDS_CACHE_KEY = "@goaltracker/all_records_cache";
const ALL_RECORDS_TS_KEY    = "@goaltracker/all_records_ts";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function fetchAllRecords(): Promise<GoalsRow[]> {
  if (!SUPABASE_ENABLED) return [];

  try {
    // Try cache first
    const tsRaw = await AsyncStorage.getItem(ALL_RECORDS_TS_KEY);
    if (tsRaw) {
      const age = Date.now() - Number(tsRaw);
      if (age < CACHE_TTL_MS) {
        const cached = await AsyncStorage.getItem(ALL_RECORDS_CACHE_KEY);
        if (cached) return JSON.parse(cached) as GoalsRow[];
      }
    }

    const { data, error } = await getClient()
      .from("goals")
      .select("*")
      .order("daily_date");

    if (error || !data) return [];

    // Persist to cache
    await AsyncStorage.setItem(ALL_RECORDS_CACHE_KEY, JSON.stringify(data));
    await AsyncStorage.setItem(ALL_RECORDS_TS_KEY, String(Date.now()));

    return data as GoalsRow[];
  } catch {
    return [];
  }
}

/** Invalidate the fetchAllRecords cache (call after a successful save). */
export async function invalidateAllRecordsCache(): Promise<void> {
  await AsyncStorage.removeItem(ALL_RECORDS_TS_KEY);
}

// ---------------------------------------------------------------------------
// Restore completed tasks from fetched rows
// ---------------------------------------------------------------------------

/**
 * Given a list of Supabase rows, return tasks completed within each
 * category's current period.  Mirrors get_completed_tasks_from_rows() in db.py.
 *
 * For each category only rows within that period's start date through today
 * are considered.  A task is done if ANY row in the window has value 1.
 */
export function getCompletedTasksFromRows(
  rows: GoalsRow[],
  now: Date,
): CompletedTasks {
  const result = Object.fromEntries(
    CATEGORIES.map((c) => [c, [] as string[]]),
  ) as CompletedTasks;

  if (rows.length === 0) return result;

  const periodStarts = getPeriodStartDates(now);
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  for (const category of CATEGORIES) {
    const startStr = periodStarts[category];
    const relevant = rows.filter(
      (r) => r.daily_date >= startStr && r.daily_date <= todayStr,
    );
    for (const task of ALL_TASKS[category]) {
      const col = cleanColumnName(task);
      if (relevant.some((r) => r[col] === 1 || r[col] === true)) {
        result[category].push(task);
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Write — single task, auto-save on tick
// ---------------------------------------------------------------------------

/**
 * Mark a single task as complete (value = 1) for today using a coalesce merge.
 *
 * Steps:
 *  1. Fetch today's existing row.
 *  2. Build the full record, preserving all existing 1s.
 *  3. Set the newly ticked task to 1.
 *  4. Upsert.
 *
 * No previously saved 1 is ever overwritten with a 0.
 * Mirrors save_task_to_supabase() in db.py.
 */
export async function saveTaskToSupabase(
  now: Date,
  category: Category,
  task: string,
): Promise<SaveResult> {
  if (!SUPABASE_ENABLED) {
    return { success: false, error: "Supabase is not configured." };
  }

  const y  = now.getFullYear();
  const m  = now.getMonth() + 1;
  const d  = now.getDate();
  const pad = (n: number) => String(n).padStart(2, "0");

  const dayOfWeek = now.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monDate = new Date(now);
  monDate.setDate(d - daysFromMonday);
  const weekStart = `${monDate.getFullYear()}-${pad(monDate.getMonth() + 1)}-${pad(monDate.getDate())}`;

  const qNum = Math.floor((m - 1) / 3) + 1;

  const existing = await fetchTodayRow(now);

  // Start from existing row values; default everything else to 0
  const record: Record<string, string | number> = {
    daily_date:    `${y}-${pad(m)}-${pad(d)}`,
    week_start:    weekStart,
    month_start:   `${y}-${pad(m)}-01`,
    quarter_start: `${y}-Q${qNum}`,
  };

  for (const [cat, tasks] of Object.entries(ALL_TASKS)) {
    for (const t of tasks) {
      const col = cleanColumnName(t);
      const existingVal = existing?.[col];
      record[col] = existingVal === 1 || existingVal === true ? 1 : 0;
    }
  }

  // Mark the newly ticked task
  record[cleanColumnName(task)] = 1;

  try {
    const { data, error } = await getClient()
      .from("goals")
      .upsert(record, { onConflict: "daily_date" });

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Supabase returned no data." };

    await invalidateAllRecordsCache();
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
