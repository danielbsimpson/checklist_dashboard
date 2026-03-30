"""
config.py
---------
Central place for all goal definitions and shared UI constants.
To add / remove / rename a goal, only this file needs to change.
"""

# ---------------------------------------------------------------------------
# Goal definitions
# ---------------------------------------------------------------------------

daily_tasks: list[str] = [
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
]

weekly_tasks: list[str] = [
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
]

monthly_tasks: list[str] = [
    "🛏️ Wash Sheets",
    "💈 Haircut",
    "💰 Savings Deposit",
    "💸 Loan Payment",
    "🧼 Wash Mats",
]

quarterly_tasks: list[str] = [
    "✈️ Vacation Savings",
    "🤖 Longterm Project",
]

# Ordered dict – insertion order defines display order throughout the app
ALL_TASKS: dict[str, list[str]] = {
    "daily":     daily_tasks,
    "weekly":    weekly_tasks,
    "monthly":   monthly_tasks,
    "quarterly": quarterly_tasks,
}

# ---------------------------------------------------------------------------
# Visual constants
# ---------------------------------------------------------------------------

CATEGORY_COLORS: dict[str, str] = {
    "daily":     "#3498db",
    "weekly":    "#2ecc71",
    "monthly":   "#e67e22",
    "quarterly": "#9b59b6",
}

PLOTLY_TEMPLATE: str = "plotly_dark"
