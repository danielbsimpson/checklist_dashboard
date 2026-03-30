"""
app.py
------
Thin entry point for the Goal Tracker Streamlit app.

All logic lives in src/:
  src/config.py      – goal lists and visual constants
  src/date_utils.py  – date formatting and period boundaries
  src/db.py          – Supabase client, read/write helpers
  src/state.py       – session-state helpers
  src/checklist.py   – Checklist tab UI
  src/dashboard.py   – Dashboard tab UI
"""

import datetime as dt

import streamlit as st

from src.checklist import render_checklist_tab
from src.dashboard import render_dashboard
from src.date_utils import format_date, get_reset_dates
from src.db import SUPABASE_ENABLED, save_task_to_supabase, fetch_today_row, get_completed_tasks_from_row

# ---------------------------------------------------------------------------
# Page config  (must be the first Streamlit call)
# ---------------------------------------------------------------------------

now = dt.datetime.today()
formatted_today = format_date(now)

st.set_page_config(
    page_title="Daniel's Goal Tracker",
    page_icon="📆",
    layout="centered",
    initial_sidebar_state="collapsed",
)

st.markdown("""
    <style>
        .stCheckbox { margin-bottom: -0.4rem; }
        details { border: 1px solid #333; border-radius: 8px; padding: 0 8px; margin-bottom: 10px; }
    </style>
""", unsafe_allow_html=True)

st.title(f"📆 Goals — {formatted_today}")

if not SUPABASE_ENABLED:
    st.info(
        "Running without Supabase — progress won't persist across refreshes. "
        "Add `[supabase]` credentials to `.streamlit/secrets.toml` to enable saving.",
        icon="ℹ️",
    )

# ---------------------------------------------------------------------------
# Top-level tabs
# ---------------------------------------------------------------------------

tab_checklist, tab_dashboard = st.tabs(["✅ Checklist", "📊 Dashboard"])

with tab_checklist:
    completed_by_category = render_checklist_tab(now)

    st.divider()
    save_col, info_col = st.columns([1, 3])

    with save_col:
        save_clicked = st.button(
            "� Force Sync",
            use_container_width=True,
            disabled=not SUPABASE_ENABLED,
            help="Goals auto-save when ticked. Use this to manually re-sync all checked goals.",
        )
    with info_col:
        if not SUPABASE_ENABLED:
            st.caption("Configure Supabase secrets to enable saving.")
        else:
            st.caption("Goals are saved automatically when ticked. Force Sync re-saves all checked goals.")

    if save_clicked:
        errors = []
        saved = 0
        for category, tasks in completed_by_category.items():
            for task in tasks:
                ok, msg = save_task_to_supabase(now, category, task)
                if ok:
                    saved += 1
                else:
                    errors.append(msg)
        if errors:
            st.error(f"Sync completed with errors: {'; '.join(errors)}")
        else:
            st.success(f"Sync complete — {saved} goal{'s' if saved != 1 else ''} confirmed in Supabase. ✅")
        st.cache_data.clear()

with tab_dashboard:
    render_dashboard()

# ---------------------------------------------------------------------------
# Sidebar
# ---------------------------------------------------------------------------

reset_dates = get_reset_dates(now)

with st.sidebar:
    st.header("ℹ️ About")
    st.write(
        "Track and tick off daily, weekly, monthly and quarterly goals. "
        "Completed goals disappear until the next reset period. "
        "Progress is saved to Supabase for long-term trend analysis."
    )
    st.divider()
    st.subheader("Reset schedule")
    for cat, rdt in reset_dates.items():
        st.write(f"**{cat.capitalize()}** → {format_date(rdt)}")
    st.divider()
    st.caption("Supabase: " + ("🟢 Connected" if SUPABASE_ENABLED else "🔴 Not configured"))