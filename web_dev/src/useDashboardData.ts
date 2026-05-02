/**
 * useDashboardData.ts
 * -------------------
 * Fetches all Supabase records, applies a date-range filter, and derives
 * per-category completion series.  Memoised so chart components re-render
 * only when the source data or filter changes.
 *
 * Mirrors the data-prep logic at the top of render_dashboard() in dashboard.py.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { ALL_TASKS, CATEGORIES, cleanColumnName } from "@/src/config";
import type { Category } from "@/src/config";
import { fetchAllRecords } from "@/src/db";
import type { GoalsRow } from "@/src/types";

// ---------------------------------------------------------------------------
// Types exported to chart components
// ---------------------------------------------------------------------------

export interface DailyPoint {
  date: string;        // "YYYY-MM-DD"
  daily: number;       // 0-100
  weekly: number;
  monthly: number;
  quarterly: number;
}

export interface TaskRate {
  task: string;        // original label
  col: string;         // DB column name
  rate: number;        // 0-100
}

export interface DashboardData {
  /** Raw filtered rows (for charts that need column-level access). */
  rows: GoalsRow[];
  /** Per-day completion % per category, sorted by date. */
  dailyPoints: DailyPoint[];
  /** Overall avg completion % per category across the filtered window. */
  kpiAverages: Record<Category, number>;
  /** Whether fetchAllRecords() is still in-flight. */
  loading: boolean;
  /** ISO date bounds of the full (unfiltered) dataset. */
  minDate: string;
  maxDate: string;
  /** Active filter window. */
  startDate: string;
  endDate: string;
  setStartDate: (d: string) => void;
  setEndDate: (d: string) => void;
  /** Re-fetch (e.g. after a force sync). */
  refresh: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowPct(row: GoalsRow, category: Category): number {
  const cols = ALL_TASKS[category].map(cleanColumnName);
  const existing = cols.filter((c) => c in row);
  if (existing.length === 0) return 0;
  const sum = existing.reduce((acc, c) => acc + (Number(row[c]) || 0), 0);
  return (sum / existing.length) * 100;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDashboardData(): DashboardData {
  const [allRows, setAllRows]     = useState<GoalsRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [minDate, setMinDate]     = useState("");
  const [maxDate, setMaxDate]     = useState(todayISO());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate]     = useState(todayISO());

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchAllRecords();
    setAllRows(data);

    if (data.length > 0) {
      const dates = data.map((r) => r.daily_date).sort();
      const mn = dates[0];
      const mx = dates[dates.length - 1];
      setMinDate(mn);
      setMaxDate(mx);
      setStartDate((prev) => prev || mn);
      setEndDate((prev) => prev || mx);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Apply date filter
  const rows = useMemo(
    () => allRows.filter((r) => r.daily_date >= startDate && r.daily_date <= endDate),
    [allRows, startDate, endDate],
  );

  // Per-day completion % per category
  const dailyPoints = useMemo<DailyPoint[]>(() =>
    [...rows]
      .sort((a, b) => a.daily_date.localeCompare(b.daily_date))
      .map((r) => ({
        date:      r.daily_date,
        daily:     rowPct(r, "daily"),
        weekly:    rowPct(r, "weekly"),
        monthly:   rowPct(r, "monthly"),
        quarterly: rowPct(r, "quarterly"),
      })),
    [rows],
  );

  // Overall averages
  const kpiAverages = useMemo<Record<Category, number>>(() => {
    const result = {} as Record<Category, number>;
    for (const cat of CATEGORIES) {
      if (rows.length === 0) { result[cat] = 0; continue; }
      const total = rows.reduce((acc, r) => acc + rowPct(r, cat), 0);
      result[cat] = total / rows.length;
    }
    return result;
  }, [rows]);

  return {
    rows,
    dailyPoints,
    kpiAverages,
    loading,
    minDate,
    maxDate,
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    refresh: load,
  };
}

// ---------------------------------------------------------------------------
// Derived helpers used by multiple chart components
// ---------------------------------------------------------------------------

/** Per-task completion rates for a category, sorted ascending (for bar chart). */
export function taskRates(rows: GoalsRow[], category: Category): TaskRate[] {
  if (rows.length === 0) return [];
  return ALL_TASKS[category]
    .map((task) => {
      const col = cleanColumnName(task);
      const sum = rows.reduce((acc, r) => acc + (Number(r[col]) || 0), 0);
      return { task, col, rate: (sum / rows.length) * 100 };
    })
    .sort((a, b) => a.rate - b.rate);
}

/** Rolling N-day average of an array of numbers. */
export function rollingAvg(values: number[], window: number): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/** ISO week string "YYYY-Www" for a date string "YYYY-MM-DD". */
export function isoWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000);
  const weekNum = Math.ceil((dayOfYear + jan4.getDay()) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/** 0=Mon … 6=Sun index from an ISO date string. */
export function dayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  return (d.getDay() + 6) % 7; // JS Sun=0 → Mon=0
}

/** "Mon" … "Sun" label from a 0-6 dayOfWeek index. */
export const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Short month names. */
export const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
