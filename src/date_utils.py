"""
date_utils.py
-------------
Pure-Python helpers for date formatting and period boundary calculations.
No Streamlit or Supabase dependencies – fully unit-testable.
"""

import datetime as dt


# ---------------------------------------------------------------------------
# Formatting
# ---------------------------------------------------------------------------

def get_day_suffix(day: int) -> str:
    """Return the ordinal suffix for a day number (1st, 2nd, 3rd, 4th …)."""
    if 11 <= day <= 13:
        return "th"
    return {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")


def format_date(dt_obj: dt.datetime) -> str:
    """Return a human-readable date string, e.g. 'Monday, March 30th'."""
    day = dt_obj.day
    return dt_obj.strftime(f"%A, %B {day}") + get_day_suffix(day)


# ---------------------------------------------------------------------------
# Period boundaries
# ---------------------------------------------------------------------------

def get_reset_dates(now: dt.datetime) -> dict[str, dt.datetime]:
    """
    Return the next reset boundary (exclusive) for each goal category.

    - daily     → start of tomorrow
    - weekly    → next Monday (or the coming Monday if today is Monday)
    - monthly   → first day of next month
    - quarterly → first day of next quarter
    """
    tomorrow = now + dt.timedelta(days=1)

    days_until_monday = (7 - now.weekday()) % 7 or 7
    next_monday = now + dt.timedelta(days=days_until_monday)

    if now.month == 12:
        next_month = dt.datetime(now.year + 1, 1, 1)
    else:
        next_month = dt.datetime(now.year, now.month + 1, 1)

    current_quarter = (now.month - 1) // 3
    next_quarter_month = (current_quarter + 1) * 3 + 1
    if next_quarter_month > 12:
        next_quarter = dt.datetime(now.year + 1, 1, 1)
    else:
        next_quarter = dt.datetime(now.year, next_quarter_month, 1)

    return {
        "daily":     tomorrow,
        "weekly":    next_monday,
        "monthly":   next_month,
        "quarterly": next_quarter,
    }


def get_period_key(category: str, now: dt.datetime) -> str:
    """
    Return a stable string key that identifies the *current* period for a
    category.  When a new period starts the key changes, causing session-state
    entries for the old period to be ignored and all tasks to reappear.

    Examples
    --------
    daily     → "2026-03-30"
    weekly    → "week-2026-03-23"   (ISO Monday of the current week)
    monthly   → "month-2026-03"
    quarterly → "q1-2026"
    """
    if category == "daily":
        return now.strftime("%Y-%m-%d")
    if category == "weekly":
        monday = now - dt.timedelta(days=now.weekday())
        return monday.strftime("week-%Y-%m-%d")
    if category == "monthly":
        return now.strftime("month-%Y-%m")
    if category == "quarterly":
        q = (now.month - 1) // 3 + 1
        return f"q{q}-{now.year}"
    return ""
