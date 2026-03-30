"""
db.py
-----
All Supabase interactions: client initialisation, writing progress records,
and reading historical data.  Importing this module never raises – if Supabase
credentials are absent the public flag SUPABASE_ENABLED is False and every
function degrades gracefully.

Save strategy
-------------
Goals are saved one task at a time, immediately when ticked.  The day's row is
upserted with a coalesce merge: existing 1s in Supabase are never overwritten
with 0s.  This means you can open the app 10 times in a day, check a goal each
visit, and every checked goal accumulates correctly regardless of whether other
goals are visible in the current session.

On app load, today's existing row is fetched from Supabase so that tasks
already checked earlier in the day are restored and stay hidden.
"""

import datetime as dt
import re

import pandas as pd
import streamlit as st

from src.config import ALL_TASKS

# ---------------------------------------------------------------------------
# Client initialisation
# ---------------------------------------------------------------------------

SUPABASE_ENABLED: bool = False
SUPABASE_ERROR: str = ""   # exposed so app.py can show a clear error banner
supabase = None

try:
    from supabase import create_client  # type: ignore

    # Support both "api_key" and "key" as the secret name, and also bare
    # SUPABASE_URL / SUPABASE_KEY top-level secrets (common on Community Cloud)
    _secrets = st.secrets.get("supabase", {})
    SUPABASE_URL: str = (
        _secrets.get("url")
        or st.secrets.get("SUPABASE_URL", "")
    )
    SUPABASE_KEY: str = (
        _secrets.get("api_key")
        or _secrets.get("key")
        or st.secrets.get("SUPABASE_KEY", "")
    )

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(
            "Supabase credentials missing. Expected [supabase] url + api_key "
            "in secrets.toml (or SUPABASE_URL / SUPABASE_KEY at top level)."
        )

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    SUPABASE_ENABLED = True

except Exception as _e:
    SUPABASE_ERROR = str(_e)

# ---------------------------------------------------------------------------
# Column name helpers
# ---------------------------------------------------------------------------

def clean_column_name(name: str) -> str:
    """
    Sanitise a task label into a safe Supabase / PostgreSQL column name.

    Steps
    -----
    1. Strip :emoji_code: shortcodes (legacy format).
    2. Strip parenthetical notes, e.g. "(>20 min)".
    3. Drop all non-ASCII characters (real Unicode emoji, etc.).
    4. Replace any run of non-alphanumeric characters with a single "_".
    5. Strip leading/trailing underscores and upper-case.
    """
    name = re.sub(r":.*?:", "", name)
    name = re.sub(r"\(.*?\)", "", name)
    name = name.encode("ascii", "ignore").decode()
    name = re.sub(r"[^a-zA-Z0-9]+", "_", name)
    return name.strip("_").upper()


def task_columns(category: str) -> list[str]:
    """Return the DB column names for every task in *category*."""
    return [clean_column_name(t) for t in ALL_TASKS[category]]


# ---------------------------------------------------------------------------
# Today's row – fetch & restore
# ---------------------------------------------------------------------------

def fetch_today_row(now: dt.datetime) -> dict:
    """
    Fetch the existing row for today from Supabase.
    Returns an empty dict if Supabase is unavailable or no row exists yet.
    """
    if not SUPABASE_ENABLED:
        return {}
    try:
        date_str = now.strftime("%Y-%m-%d")
        resp = (
            supabase.table("goals")
            .select("*")
            .eq("daily_date", date_str)
            .limit(1)
            .execute()
        )
        if resp.data:
            return resp.data[0]
    except Exception:
        pass
    return {}


def get_completed_tasks_from_row(row: dict) -> dict[str, list[str]]:
    """
    Given a raw Supabase row dict, return a mapping of
    category → [task labels that have value 1 in the DB].
    Used on app startup to restore today's already-checked tasks.

    Handles both integer (1/0) and boolean (True/False) column types,
    as Supabase may return either depending on the table schema.
    """
    result: dict[str, list[str]] = {cat: [] for cat in ALL_TASKS}
    if not row:
        return result
    for category, tasks in ALL_TASKS.items():
        for task in tasks:
            col = clean_column_name(task)
            val = row.get(col)
            # Accept both integer 1 and boolean True
            if val == 1 or val is True:
                result[category].append(task)
    return result


# ---------------------------------------------------------------------------
# Write – single task, auto-save on tick
# ---------------------------------------------------------------------------

def save_task_to_supabase(now: dt.datetime, category: str, task: str) -> tuple[bool, str]:
    """
    Mark a single task as complete (value = 1) for today.

    Uses a coalesce merge strategy:
      1. Fetch today's existing row from Supabase (if any).
      2. Build the full record, preserving all existing 1s.
      3. Set the newly checked task to 1.
      4. Upsert the merged record.

    This means calling this function multiple times throughout the day
    (from separate app sessions) safely accumulates all checked goals —
    no previously saved 1 is ever overwritten with a 0.
    """
    if not SUPABASE_ENABLED:
        return False, "Supabase is not configured."

    monday = (now - dt.timedelta(days=now.weekday())).date()
    q = (now.month - 1) // 3 + 1

    # Start from whatever is already stored today
    existing = fetch_today_row(now)

    record: dict = {
        "daily_date":    now.strftime("%Y-%m-%d"),
        "week_start":    str(monday),
        "month_start":   now.strftime("%Y-%m-01"),
        "quarter_start": f"{now.year}-Q{q}",
    }

    # Preserve all existing 1s; default everything else to 0
    for cat, tasks in ALL_TASKS.items():
        for t in tasks:
            col = clean_column_name(t)
            existing_val = existing.get(col)
            # Accept both integer 1 and boolean True from Supabase
            record[col] = 1 if (existing_val == 1 or existing_val is True) else 0

    # Mark the newly ticked task as 1
    record[clean_column_name(task)] = 1

    try:
        resp = supabase.table("goals").upsert(record, on_conflict="daily_date").execute()
        if resp.data:
            return True, f"✅ Saved: {task}"
        return False, "Supabase returned no data."
    except Exception as exc:
        return False, f"Error saving to Supabase: {exc}"


# ---------------------------------------------------------------------------
# Read – full history for dashboard
# ---------------------------------------------------------------------------

@st.cache_data(ttl=300)
def fetch_all_records() -> pd.DataFrame:
    """
    Fetch the entire ``goals`` table from Supabase ordered by date.

    Results are cached for 5 minutes (``ttl=300``) to prevent an API call on
    every Streamlit rerun.  Call ``st.cache_data.clear()`` after a save to
    force an immediate refresh.

    Returns an empty DataFrame when Supabase is unavailable.
    """
    if not SUPABASE_ENABLED:
        return pd.DataFrame()
    try:
        resp = supabase.table("goals").select("*").order("daily_date").execute()
        if not resp.data:
            return pd.DataFrame()
        df = pd.DataFrame(resp.data)
        df["daily_date"] = pd.to_datetime(df["daily_date"])
        return df
    except Exception:
        return pd.DataFrame()
