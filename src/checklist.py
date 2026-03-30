"""
checklist.py
------------
UI components for the Checklist tab:
  - render_section()       – one collapsible goal category with progress bar
  - render_checklist_tab() – the full tab layout

Save behaviour
--------------
Every task is saved to Supabase the instant it is ticked, using the
coalesce-merge strategy in db.save_task_to_supabase().  There is no manual
Save button for individual goals — the explicit "Save Progress" button in
app.py is kept as a way to force-sync the full day's state, but it is no
longer the only path to persistence.
"""

import datetime as dt

import streamlit as st

from src.config import ALL_TASKS, CATEGORY_COLORS
from src.date_utils import format_date, get_period_key, get_reset_dates
from src.db import SUPABASE_ENABLED, save_task_to_supabase
from src.state import _state_key, init_state, is_checked


# ---------------------------------------------------------------------------
# Single category section
# ---------------------------------------------------------------------------

def render_section(
    category: str,
    tasks: list[str],
    reset_dt: dt.datetime,
    now: dt.datetime,
    expanded: bool = False,
) -> list[str]:
    """
    Render a labelled expander containing uncompleted tasks as checkboxes.

    When a task is ticked it is immediately saved to Supabase (if connected)
    and the app reruns so the item disappears from the list.

    Returns
    -------
    List of task labels that are currently checked in this period.
    """
    period_key = get_period_key(category, now)
    checked_tasks = [t for t in tasks if is_checked(category, t, period_key)]
    pending_tasks = [t for t in tasks if not is_checked(category, t, period_key)]

    completed = len(checked_tasks)
    total = len(tasks)
    pct = completed / total if total > 0 else 0

    bar_color = (
        "#e74c3c" if pct <= 0.25 else
        "#e67e22" if pct <= 0.5  else
        "#f1c40f" if pct <= 0.75 else
        "#2ecc71"
    )

    label = f"{category.capitalize()}  ({completed}/{total})"

    with st.expander(label, expanded=expanded):
        st.caption(f"🔄 Resets {format_date(reset_dt)}")

        # Inline progress bar
        st.markdown(
            f"""<div style="width:100%;background:#e0e0e0;border-radius:6px;margin-bottom:8px;">
                <div style="width:{pct * 100:.1f}%;background:{bar_color};height:14px;
                            border-radius:6px;transition:width 0.3s;"></div>
            </div>""",
            unsafe_allow_html=True,
        )

        if not pending_tasks:
            st.success("All done! 🎉")
        else:
            for task in pending_tasks:
                k = _state_key(category, task, period_key)
                checked = st.checkbox(task, key=k)

                # Rising-edge guard: only act on the tick, not on every rerun
                if checked and not st.session_state.get(f"_prev_{k}", False):
                    st.session_state[f"_prev_{k}"] = True

                    # Auto-save this single task immediately
                    if SUPABASE_ENABLED:
                        ok, msg = save_task_to_supabase(now, category, task)
                        if not ok:
                            st.toast(f"⚠️ Save failed: {msg}", icon="⚠️")
                        else:
                            st.toast(f"Saved!", icon="✅")
                            st.cache_data.clear()

                    st.rerun()

    return checked_tasks


# ---------------------------------------------------------------------------
# Full checklist tab
# ---------------------------------------------------------------------------

def render_checklist_tab(now: dt.datetime) -> dict[str, list[str]]:
    """
    Render the complete Checklist tab and return a mapping of
    ``category → [checked task labels]`` for use by the save function.
    """
    st.caption("Tick off a goal and it disappears until the next reset period.")
    init_state(now)

    reset_dates = get_reset_dates(now)
    completed_by_category: dict[str, list[str]] = {}

    col1, col2 = st.columns(2)

    with col1:
        completed_by_category["daily"] = render_section(
            "daily", ALL_TASKS["daily"], reset_dates["daily"], now, expanded=True
        )
        completed_by_category["monthly"] = render_section(
            "monthly", ALL_TASKS["monthly"], reset_dates["monthly"], now
        )

    with col2:
        completed_by_category["weekly"] = render_section(
            "weekly", ALL_TASKS["weekly"], reset_dates["weekly"], now, expanded=True
        )
        completed_by_category["quarterly"] = render_section(
            "quarterly", ALL_TASKS["quarterly"], reset_dates["quarterly"], now
        )

    return completed_by_category
