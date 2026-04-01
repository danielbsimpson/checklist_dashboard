"""
upload_historical.py
--------------------
Pivot data/historical_goals.csv into one row per date (matching the Supabase
'goals' table schema) and upsert every row into Supabase.

Strategy
--------
The CSV is in long format: one record per (date, goal).
The DB is wide format: one row per date, one column per goal.

Steps
1.  Load the CSV and filter to daily goals only (weekly/monthly dates are
    week-start or month-start — not per-day rows the DB schema expects).
2.  Normalise goal names to their current DB column name using a mapping
    that handles all historical label variants (e.g. all five Water variants
    → 'water', old 'Brush Teeth' → 'brush_floss', etc.)
3.  Pivot: group by date, and for each column set value = 1 if the goal
    was completed on that date in any record, else 0.
4.  Add the required date dimension columns (week_start, month_start,
    quarter_start).
5.  Upsert each row into Supabase in batches, skipping dates that would
    overwrite existing real data (use on_conflict=daily_date so today's
    live data is never corrupted).

Run
---
    python data/upload_historical.py

Dry-run (print rows, no upload):
    python data/upload_historical.py --dry-run
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import sys
from collections import defaultdict
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "historical_goals.csv"

# ---------------------------------------------------------------------------
# Goal name → DB column mapping
# Covers every historical label variant found in the CSV.
# Goals that were retired and have no equivalent current column are mapped
# to None and skipped.
# ---------------------------------------------------------------------------
GOAL_TO_COLUMN: dict[str, str | None] = {
    # Daily — current names (pass-through)
    "Exercise":                 "exercise",
    "Stretch/Yoga (>20min)":    "stretch_yoga",
    "Stretch/Yoga (>20 min)":   "stretch_yoga",
    "Social Media (<Limit)":    "social_media",
    "Social Media (<limit)":    "social_media",
    "Eat in":                   "eat_in",
    "Review Budget/Goals":      "review_budget_goals",
    "(2x)Brush+(1x)Floss":      "brush_floss",
    "Water (3L)":               "water",
    "7 hours sleep":            "task_7_hours_sleep",
    "Clean (~20 min)":          "clean",
    "Read (~20 min)":           "read",
    "Vitamins":                 "vitamins",
    "Duolingo":                 "duolingo",

    # Daily — historical label variants
    "Brush Teeth (>=2)":        "brush_floss",   # old name for same habit
    "Water (>2.25)":            "water",
    "Water (>2.25L)":           "water",
    "Water (~2.25L+)":          "water",
    "Water (2.25L+)":           "water",
    "Read(~30 min)":            "read",          # brief label change
    "Sleep (~7 hours+)":        "task_7_hours_sleep",  # old name
    "Gym Bag":                  None,            # retired, no equivalent
    "Pack Gym Bag":             None,            # retired, no equivalent
    "Website work (~2h)":       None,            # retired weekly goal

    # Weekly
    "Laundry":                  "laundry",
    "Cleaning":                 "cleaning",
    "Grocery Shop":             "grocery_shop",
    "Meal Prep":                "meal_prep",
    "Recycling":                "recycling",
    "Trash":                    "trash",
    "Shave/Trim":               "shave_trim",
    "Water Plants":             "water_plants",
    "Weekend Exercise":         "weekend_exercise",
    "Personal Development":     "personal_development",

    # Monthly
    "Wash Sheets":              "wash_sheets",
    "Haircut":                  "haircut",
    "Savings Deposit":          "savings_deposit",
    "Loan Payment":             "loan_payment",
    "Wash mats":                "wash_mats",
    "Wash Mats":                "wash_mats",

    # Quarterly
    "Vacation Savings":         "vacation_savings",
    "Longterm Project":         "longterm_project",
}

# All valid DB columns (must match the actual Supabase table)
ALL_DB_COLUMNS: list[str] = [
    "exercise", "stretch_yoga", "social_media", "eat_in",
    "review_budget_goals", "brush_floss", "water", "task_7_hours_sleep",
    "clean", "read", "vitamins", "duolingo",
    "laundry", "cleaning", "grocery_shop", "meal_prep",
    "personal_development", "recycling", "trash", "shave_trim",
    "water_plants", "weekend_exercise",
    "wash_sheets", "haircut", "savings_deposit", "loan_payment", "wash_mats",
    "vacation_savings", "longterm_project",
]


# ---------------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------------

def week_start(d: dt.date) -> str:
    return (d - dt.timedelta(days=d.weekday())).isoformat()


def month_start(d: dt.date) -> str:
    return d.replace(day=1).isoformat()


def quarter_start(d: dt.date) -> str:
    q = (d.month - 1) // 3 + 1
    return f"{d.year}-Q{q}"


# ---------------------------------------------------------------------------
# Build wide-format rows
# ---------------------------------------------------------------------------

def build_rows(csv_path: Path) -> list[dict]:
    """
    Read the CSV and return a list of wide-format dicts ready for upsert.
    One dict per unique date; columns = ALL_DB_COLUMNS with 0/1 values.
    """
    # date -> column -> 1 (any completion wins)
    completions: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    unknown_goals: set[str] = set()

    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            goal  = row["goal"].strip()
            date  = row["date"].strip()
            done  = row["completed"].strip() == "1"

            if goal not in GOAL_TO_COLUMN:
                unknown_goals.add(goal)
                continue

            col = GOAL_TO_COLUMN[goal]
            if col is None:
                continue  # retired goal, skip

            if done:
                completions[date][col] = 1  # OR logic: 1 wins

    if unknown_goals:
        print(f"[WARN] {len(unknown_goals)} unrecognised goal labels (skipped):")
        for g in sorted(unknown_goals):
            print(f"       {g!r}")

    rows: list[dict] = []
    for date_str in sorted(completions.keys()):
        d = dt.date.fromisoformat(date_str)
        rec: dict = {
            "daily_date":    date_str,
            "week_start":    week_start(d),
            "month_start":   month_start(d),
            "quarter_start": quarter_start(d),
        }
        col_vals = completions[date_str]
        for col in ALL_DB_COLUMNS:
            rec[col] = col_vals.get(col, 0)
        rows.append(rec)

    return rows


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

def upload(rows: list[dict], dry_run: bool = False) -> None:
    if dry_run:
        print(f"[DRY-RUN] Would upsert {len(rows)} rows.")
        print("Sample (first 3 rows):")
        for r in rows[:3]:
            print(f"  {r['daily_date']}  exercise={r['exercise']}  eat_in={r['eat_in']}  "
                  f"task_7_hours_sleep={r['task_7_hours_sleep']}  read={r['read']}")
        return

    # ------------------------------------------------------------------
    # Generate SQL instead of using the Python client so the file can be
    # pasted straight into the Supabase SQL Editor without needing local
    # credentials or network access.
    # ------------------------------------------------------------------
    sql_path = ROOT / "data" / "historical_upload.sql"
    cols = ["daily_date", "week_start", "month_start", "quarter_start"] + ALL_DB_COLUMNS

    lines: list[str] = [
        "-- Historical goals upload",
        "-- Paste this entire file into the Supabase SQL Editor and click Run.",
        "-- Uses INSERT ... ON CONFLICT (daily_date) DO UPDATE so existing rows",
        "-- (e.g. today's live data) are merged: a column is only updated to 1,",
        "-- never set back to 0 if the live row already has 1.",
        "",
        "INSERT INTO goals",
        f"  ({', '.join(cols)})",
        "VALUES",
    ]

    value_rows = []
    for r in rows:
        vals = []
        for c in cols:
            v = r[c]
            if isinstance(v, int):
                vals.append(str(v))
            else:
                vals.append(f"'{v}'")
        value_rows.append(f"  ({', '.join(vals)})")

    lines.append(",\n".join(value_rows))

    # ON CONFLICT: merge by taking the MAX of existing and incoming values
    # so a historical 0 never overwrites a live 1.
    update_clauses = ",\n    ".join(
        f"{c} = GREATEST(goals.{c}, EXCLUDED.{c})"
        for c in ALL_DB_COLUMNS
    )
    other_updates = (
        "week_start    = EXCLUDED.week_start,\n"
        "    month_start   = EXCLUDED.month_start,\n"
        "    quarter_start = EXCLUDED.quarter_start"
    )
    lines += [
        "ON CONFLICT (daily_date) DO UPDATE SET",
        f"    {other_updates},",
        f"    {update_clauses};",
        "",
        f"-- Total rows: {len(rows)}",
        f"-- Date range: {rows[0]['daily_date']} -> {rows[-1]['daily_date']}",
    ]

    sql_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"[OK] SQL file written to: {sql_path}")
    print(f"     {len(rows)} INSERT rows")
    print()
    print("Next steps:")
    print("  1. Open your Supabase project -> SQL Editor -> New query")
    print("  2. Paste the contents of data/historical_upload.sql")
    print("  3. Click Run")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Upload historical goals CSV to Supabase.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse and print rows without uploading.")
    args = parser.parse_args()

    print(f"Reading {CSV_PATH.name} ...")
    rows = build_rows(CSV_PATH)
    print(f"Built {len(rows)} wide-format rows spanning "
          f"{rows[0]['daily_date']} -> {rows[-1]['daily_date']}")

    # Show a quick completion summary
    total_days = len(rows)
    ex_days = sum(1 for r in rows if r["exercise"] == 1)
    print(f"  e.g. Exercise completed on {ex_days}/{total_days} days "
          f"({100*ex_days/total_days:.0f}%)")

    upload(rows, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
