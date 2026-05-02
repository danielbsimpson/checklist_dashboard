/**
 * checklist.tsx
 * -------------
 * Top-level Checklist tab screen.
 *
 * - Calls initState(now) once on mount to restore today's saved tasks.
 * - Listens to AppState so a period rollover (new day, week, etc.) while the
 *   app is backgrounded is detected when the user returns to the foreground.
 * - Renders four CategorySection components (daily, weekly, monthly, quarterly).
 * - Shows a dismissable toast after each auto-save attempt.
 * - Offline banner when Supabase is not configured.
 * - Force Sync button re-saves all currently-checked tasks.
 */
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import CategorySection from "@/components/CategorySection";
import { ALL_TASKS, CATEGORIES } from "@/src/config";
import { formatDate, getPeriodKey } from "@/src/date_utils";
import { saveTaskToSupabase, SUPABASE_ENABLED } from "@/src/db";
import { useChecklistStore } from "@/src/state";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return a fresh Date representing "now" (called on each mount / foreground). */
function getNow() {
  return new Date();
}

function todayStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ChecklistScreen() {
  const [now, setNow] = useState<Date>(getNow);
  const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null);
  const [syncing, setSyncing] = useState(false);

  const { initState, initialised, isChecked } = useChecklistStore();
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appState   = useRef(AppState.currentState);

  // ── Init on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    initState(now);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AppState listener — detect period rollover on foreground ───────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        const freshNow = getNow();
        if (todayStr(freshNow) !== todayStr(now)) {
          // Day has rolled over — re-initialise with the new date
          setNow(freshNow);
          initState(freshNow);
        }
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [now, initState]);

  // ── Toast auto-dismiss ─────────────────────────────────────────────────
  function showToast(message: string, isError: boolean) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, isError });
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // ── Force Sync ─────────────────────────────────────────────────────────
  async function handleForceSync() {
    setSyncing(true);
    let saved = 0;
    const errors: string[] = [];

    for (const category of CATEGORIES) {
      const pk = getPeriodKey(category, now);
      for (const task of ALL_TASKS[category]) {
        if (isChecked(category, task, pk)) {
          const result = await saveTaskToSupabase(now, category, task);
          if (result.success) {
            saved++;
          } else {
            errors.push(result.error ?? "unknown error");
          }
        }
      }
    }

    setSyncing(false);

    if (errors.length > 0) {
      showToast(`⚠️ Sync errors: ${errors.slice(0, 2).join("; ")}`, true);
    } else {
      showToast(
        `Sync complete — ${saved} goal${saved !== 1 ? "s" : ""} confirmed ✅`,
        false,
      );
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      {/* Offline banner */}
      {!SUPABASE_ENABLED && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            ℹ️ Offline mode — progress won&apos;t be saved until Supabase is
            configured.
          </Text>
        </View>
      )}

      {/* Toast */}
      {toast && (
        <Pressable style={[styles.toast, toast.isError && styles.toastError]} onPress={() => setToast(null)}>
          <Text style={styles.toastText}>{toast.message}</Text>
        </Pressable>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>📆 Goals — {formatDate(now)}</Text>
        <Text style={styles.subheading}>Tap a goal to mark it done</Text>
      </View>

      {/* Loading state */}
      {!initialised ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Restoring your progress…</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {CATEGORIES.map((category) => (
            <CategorySection
              key={category}
              category={category}
              now={now}
              onToast={showToast}
            />
          ))}

          {/* Force Sync */}
          <View style={styles.syncRow}>
            <Pressable
              style={({ pressed }) => [
                styles.syncButton,
                !SUPABASE_ENABLED && styles.syncButtonDisabled,
                pressed && SUPABASE_ENABLED && styles.syncButtonPressed,
              ]}
              onPress={SUPABASE_ENABLED && !syncing ? handleForceSync : undefined}
              accessibilityLabel="Force sync all checked goals to Supabase"
              accessibilityRole="button"
            >
              {syncing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.syncButtonText}>🔄 Force Sync</Text>
              )}
            </Pressable>
            <Text style={styles.syncCaption}>
              {SUPABASE_ENABLED
                ? "Goals auto-save on tap. Use this to re-confirm all checked goals."
                : "Configure Supabase credentials to enable saving."}
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#151718",
  },
  offlineBanner: {
    backgroundColor: "#1a3a4a",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2d6a8a",
  },
  offlineText: {
    color: "#7ecbee",
    fontSize: 13,
    lineHeight: 18,
  },
  toast: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: "#1a4a2a",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#2ecc71",
  },
  toastError: {
    backgroundColor: "#4a1a1a",
    borderColor: "#e74c3c",
  },
  toastText: {
    color: "#ECEDEE",
    fontSize: 14,
    textAlign: "center",
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ECEDEE",
  },
  subheading: {
    fontSize: 13,
    color: "#9BA1A6",
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
  },
  loadingText: {
    color: "#9BA1A6",
    fontSize: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  syncRow: {
    marginTop: 8,
    gap: 8,
  },
  syncButton: {
    backgroundColor: "#3498db",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  syncButtonDisabled: {
    backgroundColor: "#2d2f30",
  },
  syncButtonPressed: {
    opacity: 0.8,
  },
  syncButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  syncCaption: {
    color: "#9BA1A6",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});
