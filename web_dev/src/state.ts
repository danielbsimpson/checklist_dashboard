/**
 * state.ts
 * --------
 * Global checklist state managed by Zustand.
 * Replaces Streamlit session_state — shared across all tabs without prop drilling.
 *
 * State key format: "category|periodKey|task"  (mirrors Python _state_key())
 *
 * On first load each day `initState()` fetches period rows from Supabase and
 * restores already-saved tasks so they stay hidden across app opens.
 * A date sentinel in AsyncStorage prevents redundant fetches within the same day.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { ALL_TASKS, CATEGORIES } from "./config";
import type { Category } from "./config";
import { getPeriodKey } from "./date_utils";
import {
  fetchPeriodRows,
  getCompletedTasksFromRows,
  SUPABASE_ENABLED,
} from "./db";
import type { ChecklistState } from "./types";

// ---------------------------------------------------------------------------
// Key helpers (mirrors _state_key() in state.py)
// ---------------------------------------------------------------------------

export function stateKey(
  category: Category,
  task: string,
  periodKey: string,
): string {
  return `${category}|${periodKey}|${task}`;
}

// ---------------------------------------------------------------------------
// Zustand store
// ---------------------------------------------------------------------------

interface ChecklistStore {
  /** Flat map of stateKey → checked boolean for the current period. */
  state: ChecklistState;
  /** Whether initState has finished for today. */
  initialised: boolean;
  /** Any error from the last Supabase operation, shown as a banner. */
  lastError: string | null;

  /** Set a single task as checked. */
  markChecked: (category: Category, task: string, periodKey: string) => void;
  /** Read whether a task is checked. */
  isChecked: (category: Category, task: string, periodKey: string) => boolean;
  /** Set the last error message (cleared by passing null). */
  setLastError: (msg: string | null) => void;
  /**
   * Load state for today.  Fetches Supabase period rows on first call of the
   * day (detected via an AsyncStorage sentinel), then populates the store.
   * Subsequent calls within the same day are a no-op.
   */
  initState: (now: Date) => Promise<void>;
}

const SENTINEL_PREFIX = "@goaltracker/loaded_";

export const useChecklistStore = create<ChecklistStore>((set, get) => ({
  state: {},
  initialised: false,
  lastError: null,

  markChecked(category, task, periodKey) {
    const key = stateKey(category, task, periodKey);
    set((s) => ({ state: { ...s.state, [key]: true } }));
  },

  isChecked(category, task, periodKey) {
    return get().state[stateKey(category, task, periodKey)] ?? false;
  },

  setLastError(msg) {
    set({ lastError: msg });
  },

  async initState(now) {
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const sentinelKey = SENTINEL_PREFIX + todayStr;

    // Build the initial flat state with all tasks set to false
    const fresh: ChecklistState = {};
    for (const category of CATEGORIES) {
      const pk = getPeriodKey(category, now);
      for (const task of ALL_TASKS[category]) {
        fresh[stateKey(category, task, pk)] = false;
      }
    }

    // Check if we already restored from DB today
    const alreadyLoaded = await AsyncStorage.getItem(sentinelKey);
    if (alreadyLoaded) {
      // Merge fresh keys that may not exist (e.g. after a task list update)
      set((s) => {
        const merged: ChecklistState = { ...fresh, ...s.state };
        return { state: merged, initialised: true };
      });
      return;
    }

    // First load of this day — restore from Supabase
    const rows = await fetchPeriodRows(now);
    const alreadyDone = getCompletedTasksFromRows(rows, now);

    for (const category of CATEGORIES) {
      const pk = getPeriodKey(category, now);
      for (const task of ALL_TASKS[category]) {
        const done = alreadyDone[category].includes(task);
        fresh[stateKey(category, task, pk)] = done;
      }
    }

    // Persist the sentinel only when DB returned data OR Supabase is disabled.
    // If the fetch returned nothing AND Supabase is enabled, a transient error
    // may have occurred — don't lock in the sentinel so the next open retries.
    if (!SUPABASE_ENABLED || rows.length > 0) {
      await AsyncStorage.setItem(sentinelKey, "1");
    }

    set((s) => {
      // Preserve any in-session checks that happened before initState resolved
      const merged: ChecklistState = { ...fresh, ...s.state };
      return { state: merged, initialised: true };
    });
  },
}));
