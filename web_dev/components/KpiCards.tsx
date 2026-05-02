/**
 * KpiCards.tsx
 * ------------
 * Four coloured summary cards — one per category — showing average
 * completion % across the filtered date range.
 * Mirrors _render_kpi_cards() in dashboard.py.
 */
import { StyleSheet, Text, View } from "react-native";

import { CATEGORIES, CATEGORY_COLORS } from "@/src/config";
import type { Category } from "@/src/config";

interface Props {
  averages: Record<Category, number>;
}

export default function KpiCards({ averages }: Props) {
  return (
    <View style={styles.row}>
      {CATEGORIES.map((cat) => {
        const color = CATEGORY_COLORS[cat];
        const pct   = averages[cat] ?? 0;
        return (
          <View
            key={cat}
            style={[styles.card, { borderLeftColor: color, backgroundColor: color + "22" }]}
          >
            <Text style={[styles.label, { color }]}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Text>
            <Text style={styles.value}>{pct.toFixed(0)}%</Text>
            <Text style={styles.sub}>avg completion</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  card: {
    flex: 1,
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 10,
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ECEDEE",
    lineHeight: 28,
  },
  sub: {
    fontSize: 10,
    color: "#9BA1A6",
  },
});
