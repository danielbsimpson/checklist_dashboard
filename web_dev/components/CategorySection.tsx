/**
 * CategorySection.tsx
 * -------------------
 * Collapsible section for one goal category (daily / weekly / monthly / quarterly).
 *
 * - Colour-coded progress bar (red → orange → yellow → green, matching Python thresholds)
 * - Period reset countdown ("🔄 Resets Monday, May 4th")
 * - Only unchecked tasks are shown; tapping a task:
 *     1. Optimistically marks it in the Zustand store (task disappears immediately)
 *     2. Fires saveTaskToSupabase in the background
 *     3. Reports the result via onToast() so ChecklistScreen can surface it
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import TaskRow from "@/components/TaskRow";
import { ALL_TASKS, CATEGORY_COLORS, cleanColumnName } from "@/src/config";
import type { Category } from "@/src/config";
import { formatDate, getPeriodKey, getResetDates } from "@/src/date_utils";
import { saveTaskToSupabase } from "@/src/db";
import { useChecklistStore } from "@/src/state";

interface Props {
  category: Category;
  now: Date;
  /** Called after each save attempt so the parent can show a toast. */
  onToast: (message: string, isError: boolean) => void;
}

/** Progress bar colour thresholds, matching checklist.py exactly. */
function barColor(pct: number): string {
  if (pct <= 0.25) return "#e74c3c";
  if (pct <= 0.50) return "#e67e22";
  if (pct <= 0.75) return "#f1c40f";
  return "#2ecc71";
}

export default function CategorySection({ category, now, onToast }: Props) {
  const [expanded, setExpanded] = useState(true);
  /** Set of column names currently being saved (for per-task loading state). */
  const [saving, setSaving] = useState<Set<string>>(new Set());

  const { isChecked, markChecked } = useChecklistStore();

  const tasks = ALL_TASKS[category];
  const periodKey = getPeriodKey(category, now);

  const checkedTasks  = tasks.filter((t) => isChecked(category, t, periodKey));
  const pendingTasks  = tasks.filter((t) => !isChecked(category, t, periodKey));
  const completed     = checkedTasks.length;
  const total         = tasks.length;
  const pct           = total > 0 ? completed / total : 0;

  const resetDates    = getResetDates(now);
  const resetLabel    = `🔄 Resets ${formatDate(resetDates[category])}`;
  const accentColor   = CATEGORY_COLORS[category];
  const progressColor = barColor(pct);

  async function handleTaskPress(task: string) {
    const col = cleanColumnName(task);

    // 1. Optimistic update — task disappears immediately
    markChecked(category, task, periodKey);

    // 2. Mark as saving so duplicate taps are blocked
    setSaving((prev) => new Set(prev).add(col));

    // 3. Background save
    const result = await saveTaskToSupabase(now, category, task);

    setSaving((prev) => {
      const next = new Set(prev);
      next.delete(col);
      return next;
    });

    if (!result.success) {
      onToast(`⚠️ Save failed: ${result.error ?? "unknown error"}`, true);
    } else {
      onToast("Saved! ✅", false);
    }
  }

  return (
    <View style={styles.card}>
      {/* ── Header (tap to collapse/expand) ── */}
      <Pressable
        style={styles.header}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${category} section, ${completed} of ${total} complete`}
      >
        <View style={[styles.accent, { backgroundColor: accentColor }]} />
        <Text style={styles.title}>{category.charAt(0).toUpperCase() + category.slice(1)}</Text>
        <Text style={styles.counter}>{completed}/{total}</Text>
        <Text style={styles.chevron}>{expanded ? "▲" : "▼"}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          {/* ── Progress bar ── */}
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${pct * 100}%` as `${number}%`, backgroundColor: progressColor },
              ]}
            />
          </View>

          {/* ── Reset label ── */}
          <Text style={styles.resetLabel}>{resetLabel}</Text>

          {/* ── Task list ── */}
          {pendingTasks.length === 0 ? (
            <Text style={styles.allDone}>All done! 🎉</Text>
          ) : (
            pendingTasks.map((task) => (
              <TaskRow
                key={task}
                task={task}
                saving={saving.has(cleanColumnName(task))}
                onPress={() => handleTaskPress(task)}
              />
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1c1e1f",
    borderRadius: 12,
    marginBottom: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#2d2f30",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  accent: {
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#ECEDEE",
    letterSpacing: 0.3,
  },
  counter: {
    fontSize: 13,
    color: "#9BA1A6",
    fontVariant: ["tabular-nums"],
  },
  chevron: {
    fontSize: 11,
    color: "#9BA1A6",
    marginLeft: 6,
  },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  barTrack: {
    height: 8,
    backgroundColor: "#2d2f30",
    borderRadius: 4,
    marginBottom: 6,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  resetLabel: {
    fontSize: 12,
    color: "#9BA1A6",
    marginBottom: 8,
  },
  allDone: {
    fontSize: 15,
    color: "#2ecc71",
    textAlign: "center",
    paddingVertical: 16,
    fontWeight: "600",
  },
});
