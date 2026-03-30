"""
checklist.py
------------
UI components for the Checklist tab:
  - render_section()       – one collapsible goal category with progress bar
  - render_checklist_tab() – the full tab layout

Why st.button instead of st.checkbox
-------------------------------------
st.checkbox persists its value in st.session_state by widget key.  When a
task is ticked and st.rerun() fires, Streamlit restores every widget from
session_state — so the checkbox comes back True on the next render and the
"if ticked" branch fires again for the wrong task.

st.button has no persistent state: it returns True ONLY on the single rerun
caused by the click, then automatically resets to False.  This is exactly
the one-shot "did the user just tap this?" semantic we need.  We style the
buttons to look like checkboxes using CSS so the UX is unchanged.
"""

import datetime as dt

import streamlit as st

from src.config import ALL_TASKS
from src.date_utils import format_date, get_period_key, get_reset_dates
from src.db import SUPABASE_ENABLED, save_task_to_supabase
from src.state import init_state, is_checked, mark_checked, _state_key


# Inject CSS once to make buttons look like checkboxes
_CHECKBOX_CSS = """
<style>
/* Make goal buttons look like checkbox rows */
div[data-testid="stButton"] > button {
    background: none;
    border: none;
    padding: 2px 0;
    margin: 0;
    font-size: 1rem;
    color: inherit;
    text-align: left;
    width: 100%;
    cursor: pointer;
}
div[data-testid="stButton"] > button::before {
    content: "☐  ";
    font-size: 1.1rem;
}
div[data-testid="stButton"] > button:hover {
    color: #2ecc71;
    background: none;
}
div[data-testid="stButton"] > button:hover::before {
    content: "☑  ";
}
</style>
"""


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
    Render a labelled expander showing only uncompleted tasks.

    Each task is a st.button (styled as a checkbox).  Clicking it:
      1. Records completion in session_state via mark_checked()
      2. Auto-saves the single task to Supabase
      3. Calls st.rerun() so the task disappears

    Returns the list of task labels currently marked as done this period.
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
                # Unique key per task — button state is never persisted across reruns
                btn_key = f"btn|{category}|{period_key}|{task}"
                if st.button(task, key=btn_key):
                    # Mark done in our own session state
                    mark_checked(category, task, period_key)

                    # Auto-save to Supabase
                    if SUPABASE_ENABLED:
                        ok, msg = save_task_to_supabase(now, category, task)
                        if not ok:
                            st.toast(f"⚠️ Save failed: {msg}", icon="⚠️")
                        else:
                            st.toast("Saved!", icon="✅")
                            st.cache_data.clear()

                    st.rerun()

    return checked_tasks


# ---------------------------------------------------------------------------
# Full checklist tab
# ---------------------------------------------------------------------------

def render_checklist_tab(now: dt.datetime) -> dict[str, list[str]]:
    """
    Render the complete Checklist tab and return a mapping of
    ``category → [checked task labels]`` for use by the Force Sync button.
    """
    st.markdown(_CHECKBOX_CSS, unsafe_allow_html=True)
    st.caption("Tap a goal to mark it done — it disappears until the next reset period.")
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
