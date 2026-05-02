/**
 * HabitHeatmapTab.tsx
 * -------------------
 * Tab 3 — GitHub-style grid (rows = Mon–Sun, cols = ISO weeks) coloured by
 * daily completion %.  Current streak, longest streak, total days tracked.
 * Mirrors _render_heatmap_tab() in dashboard.py.
 *
 * Rendered as a plain View grid (no chart library needed).
 */
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import type { DailyPoint } from "@/src/useDashboardData";
import { dayOfWeek, DOW_LABELS, isoWeek } from "@/src/useDashboardData";

interface Props {
  dailyPoints: DailyPoint[];
}

/** Map a 0-100 completion % to a heatmap cell colour — matching dashboard.py scale. */
function heatColor(pct: number | null): string {
  if (pct === null) return "#1c1e1f";
  if (pct <= 0)   return "#1a1a2e";
  if (pct <= 25)  return "#7b1c1c";
  if (pct <= 50)  return "#b85c1a";
  if (pct <= 75)  return "#b8960a";
  return "#1e7a3a";
}

export default function HabitHeatmapTab({ dailyPoints }: Props) {
  const { grid, weeks, currentStreak, longestStreak } = useMemo(() => {
    if (dailyPoints.length === 0) {
      return { grid: {}, weeks: [], currentStreak: 0, longestStreak: 0 };
    }

    // Build map: weekStr → dow → pct
    const map: Record<string, Record<number, number>> = {};
    const sortedWeeks = new Set<string>();

    for (const p of dailyPoints) {
      const wk  = isoWeek(p.date);
      const dow = dayOfWeek(p.date);
      if (!map[wk]) map[wk] = {};
      map[wk][dow] = p.daily;
      sortedWeeks.add(wk);
    }

    const weeks = [...sortedWeeks].sort();

    // Streaks (perfect = 100% daily completion)
    const sorted = [...dailyPoints].sort((a, b) => a.date.localeCompare(b.date));
    let currentStreak = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].daily >= 100) currentStreak++;
      else break;
    }

    let longestStreak = 0, run = 0;
    for (const p of sorted) {
      run = p.daily >= 100 ? run + 1 : 0;
      longestStreak = Math.max(longestStreak, run);
    }

    return { grid: map, weeks, currentStreak, longestStreak };
  }, [dailyPoints]);

  if (dailyPoints.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No data yet.</Text>
      </View>
    );
  }

  const CELL = 14;
  const GAP  = 2;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.subheading}>Daily habit heatmap</Text>
      <Text style={styles.caption}>Each cell = one day · Colour = % of daily goals completed</Text>

      {/* Grid — horizontal scroll for many weeks */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gridScroll}>
        <View style={styles.gridOuter}>
          {/* DOW labels on left */}
          <View style={[styles.dowCol, { gap: GAP }]}>
            <View style={{ height: CELL + GAP }} />{/* spacer for top */}
            {DOW_LABELS.map((d) => (
              <View key={d} style={[styles.dowLabelWrap, { height: CELL }]}>
                <Text style={styles.dowLabel}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Week columns */}
          <View style={[styles.weeksRow, { gap: GAP }]}>
            {weeks.map((wk) => (
              <View key={wk} style={[styles.weekCol, { gap: GAP }]}>
                <Text style={styles.weekLabel}>{wk.slice(5)}</Text>
                {Array.from({ length: 7 }, (_, dow) => {
                  const pct = grid[wk]?.[dow] ?? null;
                  return (
                    <View
                      key={dow}
                      style={[
                        styles.cell,
                        { width: CELL, height: CELL, backgroundColor: heatColor(pct) },
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Colour legend */}
      <View style={styles.legendRow}>
        {[
          { label: "0%",   color: "#1a1a2e" },
          { label: "25%",  color: "#7b1c1c" },
          { label: "50%",  color: "#b85c1a" },
          { label: "75%",  color: "#b8960a" },
          { label: "100%", color: "#1e7a3a" },
        ].map(({ label, color }) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.cell, { backgroundColor: color }]} />
            <Text style={styles.legendLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Streak stat chips */}
      <View style={styles.statsRow}>
        <StatChip label="🔥 Current streak" value={`${currentStreak} day${currentStreak !== 1 ? "s" : ""}`} />
        <StatChip label="🏅 Longest streak" value={`${longestStreak} day${longestStreak !== 1 ? "s" : ""}`} />
        <StatChip label="📅 Days tracked"   value={String(dailyPoints.length)} />
      </View>
    </ScrollView>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  subheading: {
    color: "#ECEDEE",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  caption: {
    color: "#9BA1A6",
    fontSize: 11,
    marginBottom: 10,
  },
  gridScroll: {
    marginBottom: 8,
  },
  gridOuter: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  dowCol: {
    marginRight: 4,
    alignItems: "flex-end",
  },
  dowLabelWrap: {
    justifyContent: "center",
  },
  dowLabel: {
    color: "#686e72",
    fontSize: 9,
  },
  weeksRow: {
    flexDirection: "row",
  },
  weekCol: {
    alignItems: "center",
  },
  weekLabel: {
    color: "#686e72",
    fontSize: 8,
    marginBottom: 2,
    transform: [{ rotate: "-45deg" }],
  },
  cell: {
    width: 14,
    height: 14,
    borderRadius: 2,
  },
  legendRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendLabel: {
    color: "#9BA1A6",
    fontSize: 10,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  chip: {
    flex: 1,
    minWidth: 100,
    backgroundColor: "#1c1e1f",
    borderRadius: 8,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#2d2f30",
    gap: 2,
  },
  chipLabel: {
    color: "#9BA1A6",
    fontSize: 11,
  },
  chipValue: {
    color: "#ECEDEE",
    fontSize: 16,
    fontWeight: "700",
  },
  empty: {
    alignItems: "center",
    paddingTop: 40,
  },
  emptyText: {
    color: "#9BA1A6",
    fontSize: 14,
  },
});
