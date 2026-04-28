/**
 * types.ts
 * --------
 * Shared TypeScript interfaces used across src/, components/, and app/.
 */

import type { Category } from "./config";

// ---------------------------------------------------------------------------
// Supabase row type
// ---------------------------------------------------------------------------

/**
 * A single row from the Supabase `goals` table (wide format).
 * Column names are derived from task labels by cleanColumnName() in db.ts.
 * The index signature allows dynamic column access when iterating ALL_TASKS.
 */
export interface GoalsRow {
  daily_date:     string;       // "YYYY-MM-DD" — primary key
  week_start:     string | null;
  month_start:    string | null;
  quarter_start:  string | null;

  // Daily
  exercise:             number;
  stretch_yoga:         number;
  social_media:         number;
  eat_in:               number;
  review_budget_goals:  number;
  brush_floss:          number;
  water:                number;
  task_7_hours_sleep:   number;
  clean:                number;
  read:                 number;
  vitamins:             number;
  duolingo:             number;

  // Weekly
  laundry:              number;
  cleaning:             number;
  grocery_shop:         number;
  meal_prep:            number;
  personal_development: number;
  recycling:            number;
  trash:                number;
  shave_trim:           number;
  water_plants:         number;
  weekend_exercise:     number;

  // Monthly
  wash_sheets:          number;
  haircut:              number;
  savings_deposit:      number;
  loan_payment:         number;
  wash_mats:            number;

  // Quarterly
  vacation_savings:     number;
  longterm_project:     number;

  // Allow dynamic column access (e.g. row[cleanColumnName(task)])
  [key: string]: string | number | null;
}

// ---------------------------------------------------------------------------
// State types
// ---------------------------------------------------------------------------

/** category → list of task labels completed within the current period. */
export type CompletedTasks = Record<Category, string[]>;

/**
 * Flat key/value store for checklist session state.
 * Key format: "category|periodKey|task" (mirrors Python _state_key()).
 */
export type ChecklistState = Record<string, boolean>;

// ---------------------------------------------------------------------------
// Save result
// ---------------------------------------------------------------------------

export interface SaveResult {
  success: boolean;
  error?: string;
}
