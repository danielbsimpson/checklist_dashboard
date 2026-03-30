"""
state.py
--------
Session-state helpers that persist checkbox values across Streamlit reruns
for the current period only.  When the period key changes (e.g. a new day
starts) all previous keys are simply ignored and tasks reappear naturally.

On first load each day, previously saved tasks are restored from Supabase so
that goals checked in an earlier session stay hidden without the user having
to re-tick them.
"""

import datetime as dt

import streamlit as st

from src.config import ALL_TASKS
from src.date_utils import get_period_key


def _state_key(category: str, task: str, period_key: str) -> str:
    """Build a namespaced session-state key that is unique per category, task and period."""
    return f"checked|{category}|{period_key}|{task}"


def init_state(now: dt.datetime) -> None:
    """
    Ensure every task for the current period has a session-state entry.

    On the very first call of the day (detected via a sentinel key) today's
    row is fetched from Supabase and any already-saved 1s are restored into
    session state so previously checked goals stay hidden across sessions.
    Subsequent reruns within the same session skip the Supabase fetch.
    """
    from src.db import fetch_today_row, get_completed_tasks_from_row  # avoid circular import at module level

    today_sentinel = f"_loaded_{now.strftime('%Y-%m-%d')}"

    if today_sentinel not in st.session_state:
        # First load of this day in this browser session — restore from DB
        row = fetch_today_row(now)
        already_done = get_completed_tasks_from_row(row)

        for category, tasks in ALL_TASKS.items():
            pk = get_period_key(category, now)
            for task in tasks:
                k = _state_key(category, task, pk)
                if k not in st.session_state:
                    st.session_state[k] = task in already_done.get(category, [])

        # Only set the sentinel if the DB fetch actually returned data (or
        # Supabase is disabled).  If the fetch returned an empty dict AND
        # Supabase is enabled, it might be a transient error — don't lock in
        # the "already loaded" sentinel so the next rerun retries.
        from src.db import SUPABASE_ENABLED as _ENABLED
        if not _ENABLED or row:
            st.session_state[today_sentinel] = True
    else:
        # Subsequent reruns – only initialise keys that don't exist yet
        for category, tasks in ALL_TASKS.items():
            pk = get_period_key(category, now)
            for task in tasks:
                k = _state_key(category, task, pk)
                if k not in st.session_state:
                    st.session_state[k] = False


def is_checked(category: str, task: str, period_key: str) -> bool:
    """Return True if the task has been ticked in the current period."""
    return bool(st.session_state.get(_state_key(category, task, period_key), False))


def mark_checked(category: str, task: str, period_key: str) -> None:
    """Programmatically mark a task as checked (used after rerun guard)."""
    st.session_state[_state_key(category, task, period_key)] = True
