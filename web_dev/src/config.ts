/**
 * config.ts
 * ---------
 * Central goal definitions and visual constants.
 * Port of src/config.py — edit here to add, remove, or rename a goal.
 * Column name derivation and all chart logic update automatically.
 */

export const dailyTasks: string[] = [
  "🏋️ Exercise",
  "🤸 Stretch/Yoga (>20 min)",
  "📵 Social Media (<limit)",
  "🥪 Eat in",
  "✅ Review Budget/Goals",
  "🦷 (2x) Brush + (1x) Floss",
  "💧 Water (3L)",
  "😴 7 hours sleep",
  "🧹 Clean (~20 min)",
  "📖 Read (~20 min)",
  "💊 Vitamins",
  "🗣️ Duolingo",
];

export const weeklyTasks: string[] = [
  "👕 Laundry",
  "🪠 Cleaning",
  "🛒 Grocery Shop",
  "👨‍🍳 Meal Prep",
  "👨‍🎓 Personal Development",
  "♻️ Recycling",
  "🗑️ Trash",
  "🪒 Shave/Trim",
  "🪴 Water Plants",
  "🏃 Weekend Exercise",
];

export const monthlyTasks: string[] = [
  "🛏️ Wash Sheets",
  "💈 Haircut",
  "💰 Savings Deposit",
  "💸 Loan Payment",
  "🧼 Wash Mats",
];

export const quarterlyTasks: string[] = [
  "✈️ Vacation Savings",
  "🤖 Longterm Project",
];

export type Category = "daily" | "weekly" | "monthly" | "quarterly";

/** Ordered mapping — insertion order defines display order throughout the app. */
export const ALL_TASKS: Record<Category, string[]> = {
  daily: dailyTasks,
  weekly: weeklyTasks,
  monthly: monthlyTasks,
  quarterly: quarterlyTasks,
};

export const CATEGORIES: Category[] = ["daily", "weekly", "monthly", "quarterly"];

/** Matches CATEGORY_COLORS in config.py exactly. */
export const CATEGORY_COLORS: Record<Category, string> = {
  daily:     "#3498db",
  weekly:    "#2ecc71",
  monthly:   "#e67e22",
  quarterly: "#9b59b6",
};
