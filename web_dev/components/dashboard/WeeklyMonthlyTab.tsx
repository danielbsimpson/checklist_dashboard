/**
 * WeeklyMonthlyTab.tsx
 * --------------------
 * Tab 4 — weekly completion bars, monthly category comparison, day-of-week.
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { CATEGORIES, CATEGORY_COLORS } from "@/src/config";
import type { GoalsRow } from "@/src/types";
import {
  DOW_LABELS,
  MONTH_LABELS,
  dayOfWeek,
  isoWeek,
} from "@/src/useDashboardData";
import { ChartLegend, SimpleBarChart } from "./ChartPrimitives";

interface Props {
  rows: GoalsRow[];
}

const CHART_H = 200;

function dailyPct(row: GoalsRow): number {
  // Simple approximation — count truthy columns that start with a letter (task cols)
  const cols = Object.keys(row).filter((k) => k !== "daily_date" && k !== "id");
  const filled = cols.filter((k) => Number(row[k]) === 1);
  return cols.length > 0 ? (filled.length / cols.length) * 100 : 0;
}

export default function WeeklyMonthlyTab({ rows }: Props) {
  const currentMonth = new Date().getMonth();
  const [selMonth, setSelMonth]   = useState(currentMonth);

  // ── Weekly bars ─────────────────────────────────────────────────────────
  const weeklyBars = useMemo(() => {
    const weeks: Record<string, number[]> = {};
    for (const row of rows) {
      const wk = isoWeek(row.daily_date);
      if (!weeks[wk]) weeks[wk] = [];
      weeks[wk].push(dailyPct(row));
    }
    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([wk, vals]) => ({
        value: vals.reduce((s, v) => s + v, 0) / vals.length,
        label: wk.slice(2),            // "24-W20" → "4-W20" etc
        color: CATEGORY_COLORS.weekly,
      }));
  }, [rows]);

  // ── Monthly category bars ────────────────────────────────────────────────
  const monthRows = useMemo(
    () => rows.filter((r) => parseInt(r.daily_date.slice(5, 7), 10) - 1 === selMonth),
    [rows, selMonth],
  );

  const monthCatBars = useMemo(() =>
    CATEGORIES.map((cat) => {
      const catCols = Object.keys(monthRows[0] ?? {}).filter(
        (k) => k !== "daily_date" && k !== "id",
      );
      // simple: all available task cols (no per-category split in GoalsRow without config import)
      const vals = monthRows.map((r) =>
        catCols.length > 0
          ? (catCols.reduce((s, c) => s + (Number(r[c]) || 0), 0) / catCols.length) * 100
          : 0,
      );
      const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return {
        value: avg,
        label: cat.slice(0, 5),
        color: CATEGORY_COLORS[cat],
      };
    }), [monthRows]);

  // ── Day-of-week bars ─────────────────────────────────────────────────────
  const dowBars = useMemo(() => {
    const buckets: number[][] = Array.from({ length: 7 }, () => []);
    for (const row of rows) {
      const d = dayOfWeek(row.daily_date);
      buckets[d].push(dailyPct(row));
    }
    return buckets.map((vals, i) => ({
      value: vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0,
      label: DOW_LABELS[i],
      color: CATEGORY_COLORS.daily,
    }));
  }, [rows]);

  const weekW = Math.max(320, weeklyBars.length * 22 + 44);

  if (rows.length === 0) {
    return (
      <View style={styles.empty}><Text style={styles.emptyText}>No data yet.</Text></View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Weekly */}
      <Text style={styles.subheading}>Weekly average completion (%)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <SimpleBarChart data={weeklyBars} width={weekW} height={CHART_H} maxValue={100} refLineValue={80} />
      </ScrollView>

      {/* Monthly by category */}
      <Text style={[styles.subheading, { marginTop: 20 }]}>Monthly completion by category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
        <View style={styles.monthChips}>
          {MONTH_LABELS.map((label, i) => (
            <Pressable
              key={label}
              style={[styles.chip, selMonth === i && styles.chipActive]}
              onPress={() => setSelMonth(i)}
            >
              <Text style={[styles.chipText, selMonth === i && styles.chipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <SimpleBarChart data={monthCatBars} width={320} height={CHART_H} maxValue={100} refLineValue={80} />
      <ChartLegend items={CATEGORIES.map((c) => ({ label: c, color: CATEGORY_COLORS[c] }))} />

      {/* Day-of-week */}
      <Text style={[styles.subheading, { marginTop: 20 }]}>Average by day of week</Text>
      <SimpleBarChart data={dowBars} width={320} height={CHART_H} maxValue={100} refLineValue={80} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  subheading: { color: "#ECEDEE", fontSize: 14, fontWeight: "600", marginBottom: 4 },
  monthChips: { flexDirection: "row", gap: 6, paddingBottom: 2 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 16, borderWidth: 1, borderColor: "#2d2f30",
  },
  chipActive:     { backgroundColor: "#3498db", borderColor: "#3498db" },
  chipText:       { color: "#9BA1A6", fontSize: 12 },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  empty:     { alignItems: "center", paddingTop: 40 },
  emptyText: { color: "#9BA1A6", fontSize: 14 },
});
