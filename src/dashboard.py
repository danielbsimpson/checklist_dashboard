"""
dashboard.py
------------
All analytics visualisations for the Dashboard tab.

Structure
---------
render_dashboard()                  ← called from app.py
  ├── _render_kpi_cards()           ← 4 summary metric cards
  ├── _render_daily_trends_tab()    ← line chart + 7-day rolling avg
  ├── _render_per_task_tab()        ← horizontal bar chart per category
  ├── _render_heatmap_tab()         ← GitHub-style heatmap + streaks
  └── _render_weekly_monthly_tab()  ← weekly bars, radar, day-of-week bars
"""

import datetime as dt

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from src.config import ALL_TASKS, CATEGORY_COLORS, PLOTLY_TEMPLATE
from src.db import SUPABASE_ENABLED, fetch_all_records, task_columns


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _existing_cols(df: pd.DataFrame, cols: list[str]) -> list[str]:
    """Filter *cols* to only those that actually exist in *df*."""
    return [c for c in cols if c in df.columns]


# ---------------------------------------------------------------------------
# KPI summary cards
# ---------------------------------------------------------------------------

def _render_kpi_cards(df: pd.DataFrame) -> None:
    st.subheader("📌 Summary")
    kpi_cols = st.columns(4)

    for i, (cat, color) in enumerate(CATEGORY_COLORS.items()):
        existing = _existing_cols(df, task_columns(cat))
        avg = df[existing].values.mean() * 100 if existing else 0.0

        with kpi_cols[i]:
            st.markdown(
                f"""<div style="background:{color}22;border-left:4px solid {color};
                    border-radius:6px;padding:12px 16px;margin-bottom:4px;">
                    <div style="font-size:0.75rem;color:{color};font-weight:600;
                                text-transform:uppercase;letter-spacing:0.05em;">
                        {cat.capitalize()}</div>
                    <div style="font-size:2rem;font-weight:700;line-height:1.1;">{avg:.0f}%</div>
                    <div style="font-size:0.75rem;color:#aaa;">avg completion</div>
                </div>""",
                unsafe_allow_html=True,
            )


# ---------------------------------------------------------------------------
# Tab 1 – Daily trends
# ---------------------------------------------------------------------------

def _render_daily_trends_tab(df: pd.DataFrame) -> None:
    st.subheader("Overall completion % over time")

    # Multi-category line chart
    trend_df = df[["daily_date"]].copy()
    for cat in ALL_TASKS:
        existing = _existing_cols(df, task_columns(cat))
        if existing:
            trend_df[cat.capitalize()] = df[existing].mean(axis=1) * 100

    trend_long = trend_df.melt(
        id_vars="daily_date", var_name="Category", value_name="Completion %"
    )
    fig = px.line(
        trend_long,
        x="daily_date",
        y="Completion %",
        color="Category",
        color_discrete_map={c.capitalize(): v for c, v in CATEGORY_COLORS.items()},
        markers=True,
        template=PLOTLY_TEMPLATE,
        labels={"daily_date": "Date"},
    )
    fig.update_layout(yaxis_range=[0, 105], legend_title_text="", hovermode="x unified")
    fig.update_traces(marker_size=5)
    st.plotly_chart(fig, use_container_width=True)

    # 7-day rolling average (only meaningful with ≥ 3 data points)
    n_days = len(df)
    if n_days >= 3:
        st.subheader("7-day rolling average — Daily goals")
        daily_cols = _existing_cols(df, task_columns("daily"))
        roll_df = df[["daily_date"]].copy()
        roll_df["completion"] = df[daily_cols].mean(axis=1) * 100
        roll_df = roll_df.sort_values("daily_date")
        roll_df["7-day avg"] = roll_df["completion"].rolling(7, min_periods=1).mean()

        fig2 = go.Figure()
        fig2.add_trace(go.Bar(
            x=roll_df["daily_date"], y=roll_df["completion"],
            name="Daily %", marker_color="rgba(52, 152, 219, 0.4)",
        ))
        fig2.add_trace(go.Scatter(
            x=roll_df["daily_date"], y=roll_df["7-day avg"],
            name="7-day avg", line=dict(color=CATEGORY_COLORS["daily"], width=2),
        ))
        fig2.update_layout(
            template=PLOTLY_TEMPLATE, yaxis_range=[0, 105],
            legend_title_text="", hovermode="x unified",
            xaxis_title="Date", yaxis_title="Completion %",
        )
        st.plotly_chart(fig2, use_container_width=True)


# ---------------------------------------------------------------------------
# Tab 2 – Per-task breakdown
# ---------------------------------------------------------------------------

def _render_per_task_tab(df: pd.DataFrame) -> None:
    from src.db import clean_column_name  # local import to avoid circular refs

    selected_cat = st.selectbox(
        "Category",
        options=list(ALL_TASKS.keys()),
        format_func=str.capitalize,
        key="dash_cat_select",
    )

    cols = task_columns(selected_cat)
    existing = _existing_cols(df, cols)
    task_labels = {clean_column_name(t): t for t in ALL_TASKS[selected_cat]}

    if not existing:
        st.warning("No data columns found for this category yet.")
        return

    rates = (df[existing].mean() * 100).reset_index()
    rates.columns = ["col", "rate"]
    rates["Task"] = rates["col"].map(task_labels)
    rates = rates.sort_values("rate", ascending=True)

    color = CATEGORY_COLORS[selected_cat]
    fig = px.bar(
        rates,
        x="rate",
        y="Task",
        orientation="h",
        template=PLOTLY_TEMPLATE,
        labels={"rate": "Completion %", "Task": ""},
        color_discrete_sequence=[color],
    )
    fig.update_layout(xaxis_range=[0, 105], showlegend=False)
    fig.add_vline(
        x=80, line_dash="dot", line_color="#aaa",
        annotation_text="80% target", annotation_position="top right",
    )
    st.plotly_chart(fig, use_container_width=True)

    best = rates.iloc[-1]
    worst = rates.iloc[0]
    bc, wc = st.columns(2)
    with bc:
        st.success(f"🏆 **Best habit:** {best['Task']}  \n{best['rate']:.0f}% completion")
    with wc:
        st.error(f"⚠️ **Needs work:** {worst['Task']}  \n{worst['rate']:.0f}% completion")


# ---------------------------------------------------------------------------
# Tab 3 – Habit heatmap
# ---------------------------------------------------------------------------

def _render_heatmap_tab(df: pd.DataFrame) -> None:
    st.subheader("Daily habit heatmap")
    st.caption("Each cell = one day. Colour = % of daily goals completed.")

    daily_cols = _existing_cols(df, task_columns("daily"))
    heat_df = df[["daily_date"]].copy()
    heat_df["pct"] = df[daily_cols].mean(axis=1) * 100
    heat_df["date"] = heat_df["daily_date"].dt.date
    heat_df["week"] = heat_df["daily_date"].dt.isocalendar().week.astype(int)
    heat_df["year"] = heat_df["daily_date"].dt.isocalendar().year.astype(int)
    heat_df["dow"] = heat_df["daily_date"].dt.weekday
    heat_df["week_year"] = (
        heat_df["year"].astype(str) + "-W" +
        heat_df["week"].astype(str).str.zfill(2)
    )

    pivot = heat_df.pivot_table(
        index="dow", columns="week_year", values="pct", aggfunc="mean"
    ).reindex(range(7))

    dow_labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    fig = go.Figure(go.Heatmap(
        z=pivot.values,
        x=pivot.columns.tolist(),
        y=dow_labels,
        colorscale=[
            [0.00, "#1a1a2e"],
            [0.25, "#e74c3c"],
            [0.50, "#e67e22"],
            [0.75, "#f1c40f"],
            [1.00, "#2ecc71"],
        ],
        zmin=0, zmax=100,
        colorbar=dict(title="% done", ticksuffix="%"),
        hovertemplate="Week %{x}<br>%{y}: %{z:.0f}%<extra></extra>",
    ))
    fig.update_layout(
        template=PLOTLY_TEMPLATE,
        xaxis_title="Week",
        yaxis_title="",
        height=280,
        margin=dict(l=40, r=20, t=20, b=40),
    )
    st.plotly_chart(fig, use_container_width=True)

    # Streak counters
    streak_df = heat_df.sort_values("date").copy()
    streak_df["perfect"] = streak_df["pct"] >= 100

    current_streak = 0
    for perfect in reversed(streak_df["perfect"].tolist()):
        if perfect:
            current_streak += 1
        else:
            break

    longest_streak, run = 0, 0
    for perfect in streak_df["perfect"].tolist():
        run = run + 1 if perfect else 0
        longest_streak = max(longest_streak, run)

    s1, s2, s3 = st.columns(3)
    s1.metric("🔥 Current streak", f"{current_streak} day{'s' if current_streak != 1 else ''}")
    s2.metric("🏅 Longest streak", f"{longest_streak} day{'s' if longest_streak != 1 else ''}")
    s3.metric("📅 Days tracked", len(df))


# ---------------------------------------------------------------------------
# Tab 4 – Weekly & monthly aggregations
# ---------------------------------------------------------------------------

def _render_weekly_monthly_tab(df: pd.DataFrame) -> None:
    daily_cols = _existing_cols(df, task_columns("daily"))

    # Weekly bar chart
    st.subheader("Weekly completion (daily goals)")
    weekly_agg = (
        df.assign(week=df["daily_date"].dt.to_period("W").astype(str))
        .groupby("week")[daily_cols]
        .mean()
        .mean(axis=1)
        .mul(100)
        .reset_index(name="Completion %")
    )
    fig_week = px.bar(
        weekly_agg, x="week", y="Completion %",
        template=PLOTLY_TEMPLATE,
        color_discrete_sequence=[CATEGORY_COLORS["daily"]],
        labels={"week": "Week"},
    )
    fig_week.update_layout(yaxis_range=[0, 105])
    fig_week.add_hline(y=80, line_dash="dot", line_color="#aaa")
    st.plotly_chart(fig_week, use_container_width=True)

    # Monthly radar chart
    st.subheader("Monthly completion by category")
    monthly_agg = df.assign(month=df["daily_date"].dt.to_period("M").astype(str))
    months = sorted(monthly_agg["month"].unique())
    selected_month = st.selectbox(
        "Select month", months, index=len(months) - 1, key="month_sel"
    )
    month_df = monthly_agg[monthly_agg["month"] == selected_month]

    radar_cats = list(ALL_TASKS.keys())
    radar_vals = [
        month_df[_existing_cols(month_df, task_columns(cat))].values.mean() * 100
        if _existing_cols(month_df, task_columns(cat)) else 0.0
        for cat in radar_cats
    ]

    fig_radar = go.Figure(go.Scatterpolar(
        r=radar_vals + [radar_vals[0]],
        theta=[c.capitalize() for c in radar_cats] + [radar_cats[0].capitalize()],
        fill="toself",
        fillcolor="rgba(52, 152, 219, 0.27)",
        line=dict(color=CATEGORY_COLORS["daily"]),
    ))
    fig_radar.update_layout(
        polar=dict(radialaxis=dict(visible=True, range=[0, 100])),
        template=PLOTLY_TEMPLATE,
        showlegend=False,
        height=400,
    )
    st.plotly_chart(fig_radar, use_container_width=True)

    # Day-of-week performance
    st.subheader("Performance by day of week")
    dow_order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    dow_agg = (
        df.assign(
            dow=df["daily_date"].dt.strftime("%a"),
            pct=df[daily_cols].mean(axis=1) * 100,
        )
        .groupby("dow")["pct"]
        .mean()
        .reindex(dow_order)
        .reset_index()
    )
    dow_agg.columns = ["Day", "Completion %"]
    fig_dow = px.bar(
        dow_agg, x="Day", y="Completion %",
        template=PLOTLY_TEMPLATE,
        color="Completion %",
        color_continuous_scale=["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71"],
        range_color=[0, 100],
        labels={"Day": ""},
    )
    fig_dow.update_layout(yaxis_range=[0, 105], coloraxis_showscale=False)
    st.plotly_chart(fig_dow, use_container_width=True)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def render_dashboard() -> None:
    """Render the full Dashboard tab, including date filter, KPIs and all chart tabs."""
    st.header("📊 Progress Dashboard")

    df = fetch_all_records()

    if df.empty:
        st.info(
            "No data yet — save your first day's progress on the **Checklist** tab, "
            "then come back here."
            if SUPABASE_ENABLED
            else "Connect Supabase to start tracking history.",
            icon="📭",
        )
        return

    # ── Date range filter ────────────────────────────────────────────────
    min_date = df["daily_date"].min().date()
    max_date = df["daily_date"].max().date()

    with st.expander("🗓️ Filter date range", expanded=False):
        col_a, col_b = st.columns(2)
        with col_a:
            start_date = st.date_input(
                "From", value=min_date, min_value=min_date, max_value=max_date
            )
        with col_b:
            end_date = st.date_input(
                "To", value=max_date, min_value=min_date, max_value=max_date
            )

    mask = (
        (df["daily_date"].dt.date >= start_date) &
        (df["daily_date"].dt.date <= end_date)
    )
    df = df[mask].copy()

    if df.empty:
        st.warning("No records in the selected date range.")
        return

    _render_kpi_cards(df)
    st.divider()

    dash_tab1, dash_tab2, dash_tab3, dash_tab4 = st.tabs([
        "📅 Daily Trends",
        "📋 Per-Task Breakdown",
        "🔥 Habit Heatmap",
        "📆 Weekly / Monthly",
    ])

    with dash_tab1:
        _render_daily_trends_tab(df)

    with dash_tab2:
        _render_per_task_tab(df)

    with dash_tab3:
        _render_heatmap_tab(df)

    with dash_tab4:
        _render_weekly_monthly_tab(df)
