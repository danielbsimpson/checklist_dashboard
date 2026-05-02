/**
 * PerTaskBreakdownTab.tsx
 * -----------------------
 * Tab 2 — per-category completion rate bar chart, sorted ascending.
 * Shows best / worst callout cards below the chart.
 */
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Pressable } from "react-native";

import { CATEGORIES, CATEGORY_COLORS, type Category } from "@/src/config";
import type { GoalsRow } from "@/src/types";
import { taskRates } from "@/src/useDashboardData";
import { SimpleBarChart } from "./ChartPrimitives";

interface Props {
  rows: GoalsRow[];
}

const CHART_H = 220;

export default function PerTaskBreakdownTab({ rows }: Props) {
  const [selectedCat, setSelectedCat] = useState<Category>("daily");

  const rates = useMemo(() => taskRates(rows, selectedCat), [rows, selectedCat]);

  const barData = useMemo(
    () =>
      rates.map((r) => ({
        value: r.rate,
        label: r.task.length > 14 ? r.task.slice(0, 13) + "…" : r.task,
        color: CATEGORY_COLORS[selectedCat],
      })),
    [rates, selectedCat],
  );

  const BAR_W_PER_ITEM = 52;
  const chartW = Math.max(320, barData.length * BAR_W_PER_ITEM + 44);

  const best  = rates.length > 0 ? rates[rates.length - 1] : null;
  const worst = rates.length > 0 ? rates[0] : null;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Category selector */}
      <View style={styles.chips}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            style={[styles.chip, selectedCat === cat && { backgroundColor: CATEGORY_COLORS[cat], borderColor: CATEGORY_COLORS[cat] }]}
            onPress={() => setSelectedCat(cat)}
          >
            <Text style={[styles.chipText, selectedCat === cat && styles.chipTextActive]}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.subheading}>Completion rate by task — {selectedCat}</Text>
      <Text style={styles.caption}>Sorted ascending (worst → best). Dashed line = 80% target.</Text>
      {barData.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <SimpleBarChart
            data={barData}
            width={chartW}
            height={CHART_H}
            maxValue={100}
            refLineValue={80}
            refLineColor="#686e72"
          />
        </ScrollView>
      ) : (
        <Text style={styles.noData}>No data for this category yet.</Text>
      )}

      {/* Best / Worst cards */}
      {(best || worst) && (
        <View style={styles.callouts}>
          {worst && (
            <View style={[styles.calloutCard, { borderLeftColor: "#e74c3c" }]}>
              <Text style={styles.calloutTitle}>Needs work</Text>
              <Text style={styles.calloutTask} numberOfLines={2}>{worst.task}</Text>
              <Text style={[styles.calloutPct, { color: "#e74c3c" }]}>{worst.rate.toFixed(0)}%</Text>
            </View>
          )}
          {best && (
            <View style={[styles.calloutCard, { borderLeftColor: "#2ecc71" }]}>
              <Text style={styles.calloutTitle}>Best habit</Text>
              <Text style={styles.calloutTask} numberOfLines={2}>{best.task}</Text>
              <Text style={[styles.calloutPct, { color: "#2ecc71" }]}>{best.rate.toFixed(0)}%</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1, borderColor: "#2d2f30",
  },
  chipText:       { color: "#9BA1A6", fontSize: 12 },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  subheading: { color: "#ECEDEE", fontSize: 14, fontWeight: "600", marginBottom: 2 },
  caption:    { color: "#9BA1A6", fontSize: 11, marginBottom: 8 },
  noData:     { color: "#686e72", fontSize: 12, paddingVertical: 16 },
  callouts: {
    flexDirection: "row", gap: 12, marginTop: 12, marginBottom: 24,
  },
  calloutCard: {
    flex: 1, backgroundColor: "#1c1e1f", borderRadius: 8, padding: 12,
    borderLeftWidth: 4, gap: 4,
    borderWidth: StyleSheet.hairlineWidth, borderColor: "#2d2f30",
  },
  calloutTitle: { color: "#9BA1A6", fontSize: 11 },
  calloutTask:  { color: "#ECEDEE", fontSize: 13, fontWeight: "600" },
  calloutPct:   { fontSize: 20, fontWeight: "700" },
});
