/**
 * DailyTrendsTab.tsx
 * ------------------
 * Tab 1 — multi-category daily completion line chart + 7-day rolling avg.
 */
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { CATEGORY_COLORS } from "@/src/config";
import type { DailyPoint } from "@/src/useDashboardData";
import { rollingAvg } from "@/src/useDashboardData";
import { ChartLegend, SimpleBarChart, SimpleLineChart } from "./ChartPrimitives";

interface Props {
  dailyPoints: DailyPoint[];
}

const CHART_H = 200;
const PX_PER_POINT = 6;
const MIN_W = 320;

export default function DailyTrendsTab({ dailyPoints }: Props) {
  const sorted = useMemo(
    () => [...dailyPoints].sort((a, b) => a.date.localeCompare(b.date)),
    [dailyPoints],
  );

  const n = sorted.length;
  const chartW = Math.max(MIN_W, n * PX_PER_POINT);

  const series = useMemo(
    () => [
      { color: CATEGORY_COLORS.daily,     label: "Daily",     data: sorted.map((p) => ({ value: p.daily * 100 })),     thickness: 2 },
      { color: CATEGORY_COLORS.weekly,    label: "Weekly",    data: sorted.map((p) => ({ value: p.weekly * 100 })),    thickness: 2 },
      { color: CATEGORY_COLORS.monthly,   label: "Monthly",   data: sorted.map((p) => ({ value: p.monthly * 100 })),   thickness: 2 },
      { color: CATEGORY_COLORS.quarterly, label: "Quarterly", data: sorted.map((p) => ({ value: p.quarterly * 100 })), thickness: 2 },
    ],
    [sorted],
  );

  const dailyPcts  = useMemo(() => sorted.map((p) => p.daily * 100), [sorted]);
  const rolled7    = useMemo(() => rollingAvg(dailyPcts, 7), [dailyPcts]);
  const rolledBars = useMemo(
    () => rolled7.map((v, i) => ({
      value: v,
      label: i % Math.max(1, Math.floor(n / 20)) === 0 ? sorted[i].date.slice(5) : undefined,
      color: CATEGORY_COLORS.daily + "bb",
    })),
    [rolled7, sorted, n],
  );
  const xLabels = useMemo(() => sorted.map((p) => p.date.slice(5)), [sorted]);

  if (sorted.length === 0) {
    return (
      <View style={styles.empty}><Text style={styles.emptyText}>No daily data yet.</Text></View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.subheading}>Category completion over time (%)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <SimpleLineChart series={series} width={chartW} height={CHART_H} maxValue={100} sections={5} xLabels={xLabels} xLabelCount={12} />
      </ScrollView>
      <ChartLegend items={series.map((s) => ({ label: s.label, color: s.color }))} />

      <Text style={[styles.subheading, { marginTop: 16 }]}>7-day rolling average — daily tasks</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <SimpleBarChart data={rolledBars} width={chartW} height={CHART_H} maxValue={100} refLineValue={80} />
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  subheading: { color: "#ECEDEE", fontSize: 14, fontWeight: "600", marginBottom: 4 },
  empty:      { alignItems: "center", paddingTop: 40 },
  emptyText:  { color: "#9BA1A6", fontSize: 14 },
});
