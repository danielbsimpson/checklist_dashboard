/**
 * YearOnYearTab.tsx
 * -----------------
 * Tab 5 — Annual comparison, monthly heatmap grid, same-month line, 30-day rolling overlay.
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ALL_TASKS, cleanColumnName } from "@/src/config";
import type { GoalsRow } from "@/src/types";
import { MONTH_LABELS, rollingAvg } from "@/src/useDashboardData";
import { ChartLegend, SimpleBarChart, SimpleLineChart } from "./ChartPrimitives";

interface Props {
  rows: GoalsRow[];
}

const YEAR_COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f1c40f",
  "#9b59b6", "#1abc9c", "#e67e22", "#34495e",
];
const CHART_H = 180;

function dailyCols(): string[] {
  return ALL_TASKS.daily.map(cleanColumnName);
}
function rowPct(row: GoalsRow): number {
  const cols = dailyCols().filter((c) => c in row);
  if (!cols.length) return 0;
  return (cols.reduce((a, c) => a + (Number(row[c]) || 0), 0) / cols.length) * 100;
}
function getYear(d: string)  { return parseInt(d.slice(0, 4), 10); }
function getMonth(d: string) { return parseInt(d.slice(5, 7), 10); }

function heatColor(v: number | undefined): string {
  if (v === undefined) return "#1c1e1f";
  if (v <= 0)  return "#1a1a2e";
  if (v <= 25) return "#7b1c1c";
  if (v <= 50) return "#b85c1a";
  if (v <= 75) return "#b8960a";
  return "#1e7a3a";
}

export default function YearOnYearTab({ rows }: Props) {
  const years = useMemo(
    () => [...new Set(rows.map((r) => getYear(r.daily_date)))].sort(),
    [rows],
  );

  const currentYear  = new Date().getFullYear();
  const [selMonth, setSelMonth] = useState(new Date().getMonth() + 1);

  // ── Annual avg bar ───────────────────────────────────────────────────────
  const annualData = useMemo(() =>
    years.map((yr) => {
      const yrRows = rows.filter((r) => getYear(r.daily_date) === yr);
      const avg = yrRows.length > 0
        ? yrRows.reduce((s, r) => s + rowPct(r), 0) / yrRows.length
        : 0;
      return { yr, avg, days: yrRows.length };
    }), [rows, years]);

  const annualBars = useMemo(() =>
    annualData.map((d, i) => ({
      value: d.avg,
      label: String(d.yr),
      color: YEAR_COLORS[i % YEAR_COLORS.length],
    })), [annualData]);

  // ── Monthly heatmap ──────────────────────────────────────────────────────
  const heatmap = useMemo(() => {
    const sums: Record<string, { s: number; n: number }> = {};
    for (const r of rows) {
      const k = `${getYear(r.daily_date)}-${getMonth(r.daily_date)}`;
      if (!sums[k]) sums[k] = { s: 0, n: 0 };
      sums[k].s += rowPct(r);
      sums[k].n += 1;
    }
    const result: Record<number, Record<number, number>> = {};
    for (const [k, { s, n }] of Object.entries(sums)) {
      const [yr, mo] = k.split("-").map(Number);
      if (!result[mo]) result[mo] = {};
      result[mo][yr] = s / n;
    }
    return result;
  }, [rows]);

  // ── Same-month line series ───────────────────────────────────────────────
  const sameMonthSeries = useMemo(() =>
    years.map((yr, i) => {
      const yRows = rows
        .filter((r) => getYear(r.daily_date) === yr && getMonth(r.daily_date) === selMonth)
        .sort((a, b) => a.daily_date.localeCompare(b.daily_date));
      return { color: YEAR_COLORS[i % YEAR_COLORS.length], label: String(yr), data: yRows.map((r) => ({ value: rowPct(r) })) };
    }).filter((s) => s.data.length > 0),
  [rows, years, selMonth]);

  // ── 30-day rolling overlay ───────────────────────────────────────────────
  const rollingSeries = useMemo(() =>
    years.map((yr, i) => {
      const yRows = rows
        .filter((r) => getYear(r.daily_date) === yr)
        .sort((a, b) => a.daily_date.localeCompare(b.daily_date));
      const rolled = rollingAvg(yRows.map(rowPct), 30);
      return { color: YEAR_COLORS[i % YEAR_COLORS.length], label: String(yr), data: rolled.map((v) => ({ value: v })) };
    }).filter((s) => s.data.length > 0),
  [rows, years]);

  const maxRollingLen = Math.max(...rollingSeries.map((s) => s.data.length), 1);
  const maxMonthLen   = Math.max(...sameMonthSeries.map((s) => s.data.length), 1);

  if (rows.length === 0) {
    return <View style={styles.empty}><Text style={styles.emptyText}>No data yet.</Text></View>;
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Annual bars */}
      <Text style={styles.subheading}>Average daily completion % per year</Text>
      <SimpleBarChart data={annualBars} width={Math.max(320, years.length * 70 + 44)} height={CHART_H} maxValue={100} />

      {/* YoY delta cards */}
      <View style={styles.deltaRow}>
        {annualData.map((d, i) => {
          const delta = i > 0 ? d.avg - annualData[i - 1].avg : null;
          return (
            <View key={d.yr} style={styles.deltaCard}>
              <Text style={styles.deltaYear}>{d.yr}</Text>
              <Text style={[styles.deltaAvg, { color: YEAR_COLORS[i % YEAR_COLORS.length] }]}>{d.avg.toFixed(1)}%</Text>
              {delta !== null && (
                <Text style={[delta >= 0 ? styles.deltaPos : styles.deltaNeg]}>
                  {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
                </Text>
              )}
              <Text style={styles.deltaDays}>{d.days}d</Text>
            </View>
          );
        })}
      </View>

      {/* Heatmap grid */}
      <Text style={[styles.subheading, { marginTop: 20 }]}>Monthly completion — all years</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.heatRow}>
            <View style={styles.heatMonthLbl} />
            {years.map((yr) => (
              <View key={yr} style={styles.heatCell}>
                <Text style={styles.heatHeaderTxt}>{yr}</Text>
              </View>
            ))}
          </View>
          {Array.from({ length: 12 }, (_, mo) => (
            <View key={mo} style={styles.heatRow}>
              <View style={styles.heatMonthLbl}><Text style={styles.heatMonthTxt}>{MONTH_LABELS[mo]}</Text></View>
              {years.map((yr) => {
                const v = heatmap[mo + 1]?.[yr];
                return (
                  <View key={yr} style={[styles.heatCell, { backgroundColor: heatColor(v) }]}>
                    {v !== undefined && <Text style={styles.heatCellTxt}>{v.toFixed(0)}%</Text>}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Same-month line */}
      <Text style={[styles.subheading, { marginTop: 20 }]}>Same month across years</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
        <View style={styles.monthChips}>
          {MONTH_LABELS.map((label, i) => (
            <Pressable key={label} style={[styles.chip, selMonth === i + 1 && styles.chipActive]} onPress={() => setSelMonth(i + 1)}>
              <Text style={[styles.chipText, selMonth === i + 1 && styles.chipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      {sameMonthSeries.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <SimpleLineChart series={sameMonthSeries} width={Math.max(320, maxMonthLen * 8 + 44)} height={CHART_H} maxValue={100} />
        </ScrollView>
      ) : (
        <Text style={styles.noData}>No data for this month.</Text>
      )}
      <ChartLegend items={sameMonthSeries.map(({ label, color }) => ({ label, color }))} />

      {/* 30-day rolling */}
      <Text style={[styles.subheading, { marginTop: 20 }]}>30-day rolling average — year overlay</Text>
      {rollingSeries.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <SimpleLineChart series={rollingSeries} width={Math.max(320, maxRollingLen * 3 + 44)} height={CHART_H} maxValue={100} />
        </ScrollView>
      )}
      <ChartLegend items={rollingSeries.map(({ label, color }) => ({ label, color }))} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  subheading: { color: "#ECEDEE", fontSize: 14, fontWeight: "600", marginBottom: 4 },
  noData:     { color: "#686e72", fontSize: 12, marginBottom: 8 },
  empty:      { alignItems: "center", paddingTop: 40 },
  emptyText:  { color: "#9BA1A6", fontSize: 14 },
  deltaRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 8, marginBottom: 4 },
  deltaCard: {
    flex: 1, minWidth: 70, backgroundColor: "#1c1e1f", borderRadius: 8, padding: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: "#2d2f30", alignItems: "center", gap: 2,
  },
  deltaYear:  { color: "#9BA1A6", fontSize: 11 },
  deltaAvg:   { fontSize: 18, fontWeight: "700" },
  deltaPos:   { color: "#2ecc71", fontSize: 11, fontWeight: "600" },
  deltaNeg:   { color: "#e74c3c", fontSize: 11, fontWeight: "600" },
  deltaDays:  { color: "#686e72", fontSize: 10 },
  heatRow:       { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  heatMonthLbl:  { width: 30, alignItems: "flex-end", paddingRight: 6 },
  heatMonthTxt:  { color: "#9BA1A6", fontSize: 11 },
  heatCell:      { width: 46, height: 28, borderRadius: 4, marginHorizontal: 2, alignItems: "center", justifyContent: "center" },
  heatHeaderTxt: { color: "#9BA1A6", fontSize: 11, fontWeight: "600" },
  heatCellTxt:   { color: "#ECEDEEcc", fontSize: 10, fontWeight: "600" },
  monthChips:    { flexDirection: "row", gap: 6, paddingBottom: 2 },
  chip:          { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: "#2d2f30" },
  chipActive:    { backgroundColor: "#3498db", borderColor: "#3498db" },
  chipText:      { color: "#9BA1A6", fontSize: 12 },
  chipTextActive: { color: "#fff", fontWeight: "600" },
});
