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
from src.date_utils import now_eastern
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
# Tab 5 – Year-on-Year & Month-on-Month comparisons
# ---------------------------------------------------------------------------

def _render_yoy_tab(df: pd.DataFrame) -> None:
    daily_cols = _existing_cols(df, task_columns("daily"))

    # Add helper columns once
    df = df.copy()
    df["year"]       = df["daily_date"].dt.year
    df["month_num"]  = df["daily_date"].dt.month
    df["month_name"] = df["daily_date"].dt.strftime("%b")
    df["pct"]        = df[daily_cols].mean(axis=1) * 100 if daily_cols else 0.0

    years      = sorted(df["year"].unique())
    year_strs  = [str(y) for y in years]
    color_seq  = px.colors.qualitative.Bold   # up to 10 distinct colours

    # ── 1. Annual points accumulated (bar + line overlay) ────────────────
    st.subheader("Total points per year")
    st.caption("One 'point' = one completed daily goal on one day.")

    if daily_cols:
        annual = (
            df.groupby("year")[daily_cols]
            .sum()
            .sum(axis=1)
            .reset_index(name="Points")
        )
        annual["Year"] = annual["year"].astype(str)
        annual["days_tracked"] = df.groupby("year").size().values
        annual["avg_pct"] = (annual["Points"] / (annual["days_tracked"] * len(daily_cols)) * 100).round(1)

        fig_pts = go.Figure()
        fig_pts.add_trace(go.Bar(
            x=annual["Year"], y=annual["Points"],
            marker_color=[color_seq[i % len(color_seq)] for i in range(len(annual))],
            text=annual["Points"], textposition="outside",
            name="Points",
        ))
        fig_pts.add_trace(go.Scatter(
            x=annual["Year"], y=annual["avg_pct"],
            mode="lines+markers+text",
            yaxis="y2",
            name="Avg %",
            line=dict(color="#f1c40f", width=2),
            text=[f"{v:.0f}%" for v in annual["avg_pct"]],
            textposition="top center",
        ))
        fig_pts.update_layout(
            template=PLOTLY_TEMPLATE,
            yaxis=dict(title="Total points"),
            yaxis2=dict(title="Avg daily %", overlaying="y", side="right",
                        range=[0, 110], showgrid=False),
            legend=dict(orientation="h", y=1.08),
            hovermode="x unified",
            margin=dict(t=60),
        )
        st.plotly_chart(fig_pts, use_container_width=True)

        # KPI row: year-over-year Δ
        if len(annual) >= 2:
            kpi_cols = st.columns(len(annual))
            for i, row in annual.iterrows():
                with kpi_cols[list(annual.index).index(i)]:
                    delta = None
                    if i > annual.index[0]:
                        prev = annual.loc[annual.index[list(annual.index).index(i) - 1], "avg_pct"]
                        delta = f"{row['avg_pct'] - prev:+.1f}%"
                    st.metric(
                        label=str(row["Year"]),
                        value=f"{row['avg_pct']:.1f}%",
                        delta=delta,
                    )

    st.divider()

    # ── 2. Month-by-month heatmap across years ───────────────────────────
    st.subheader("Monthly completion — all years side by side")
    st.caption("Rows = calendar month · Columns = year · Colour = avg daily completion %")

    month_year = (
        df.groupby(["year", "month_num", "month_name"])["pct"]
        .mean()
        .reset_index()
    )
    pivot_my = month_year.pivot_table(
        index="month_num", columns="year", values="pct"
    )
    month_labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    # Reindex so all 12 rows exist (NaN for months with no data)
    pivot_my = pivot_my.reindex(range(1, 13))

    fig_my = go.Figure(go.Heatmap(
        z=pivot_my.values,
        x=[str(y) for y in pivot_my.columns],
        y=[month_labels[i - 1] for i in pivot_my.index],
        colorscale=[
            [0.00, "#1a1a2e"],
            [0.25, "#e74c3c"],
            [0.50, "#e67e22"],
            [0.75, "#f1c40f"],
            [1.00, "#2ecc71"],
        ],
        zmin=0, zmax=100,
        colorbar=dict(title="%", ticksuffix="%"),
        hovertemplate="%{y} %{x}: %{z:.0f}%<extra></extra>",
        text=[[f"{v:.0f}%" if not pd.isna(v) else "" for v in row]
              for row in pivot_my.values],
        texttemplate="%{text}",
    ))
    fig_my.update_layout(
        template=PLOTLY_TEMPLATE,
        height=420,
        margin=dict(l=50, r=20, t=20, b=20),
        xaxis_title="Year",
        yaxis_title="",
        yaxis=dict(autorange="reversed"),
    )
    st.plotly_chart(fig_my, use_container_width=True)

    st.divider()

    # ── 3. Same month across years (line chart) ──────────────────────────
    st.subheader("How does this month compare to previous years?")

    _today = now_eastern()
    current_month_num  = _today.month
    current_month_name = _today.strftime("%B")
    month_options = {m: i + 1 for i, m in enumerate(
        ["January","February","March","April","May","June",
         "July","August","September","October","November","December"]
    )}
    selected_month_name = st.selectbox(
        "Select month to compare",
        options=list(month_options.keys()),
        index=current_month_num - 1,
        key="yoy_month_sel",
    )
    selected_month_num = month_options[selected_month_name]

    month_slice = df[df["month_num"] == selected_month_num].copy()
    month_slice["day_of_month"] = month_slice["daily_date"].dt.day

    if month_slice.empty:
        st.info(f"No data for {selected_month_name} yet.")
    else:
        fig_mom = go.Figure()
        for i, yr in enumerate(sorted(month_slice["year"].unique())):
            yr_data = (
                month_slice[month_slice["year"] == yr]
                .groupby("day_of_month")["pct"]
                .mean()
                .reset_index()
                .sort_values("day_of_month")
            )
            is_current = (yr == _today.year)
            fig_mom.add_trace(go.Scatter(
                x=yr_data["day_of_month"],
                y=yr_data["pct"],
                mode="lines+markers",
                name=str(yr),
                line=dict(
                    color=color_seq[i % len(color_seq)],
                    width=3 if is_current else 1.5,
                    dash="solid" if is_current else "dot",
                ),
                marker=dict(size=6 if is_current else 4),
            ))
        fig_mom.update_layout(
            template=PLOTLY_TEMPLATE,
            xaxis_title=f"Day of {selected_month_name}",
            yaxis_title="Daily completion %",
            yaxis_range=[0, 105],
            legend_title="Year",
            hovermode="x unified",
        )
        st.plotly_chart(fig_mom, use_container_width=True)

        # Table: avg for each year in selected month
        summary = (
            month_slice.groupby("year")["pct"]
            .agg(avg_pct="mean", days="count")
            .reset_index()
        )
        summary.columns = ["Year", "Avg %", "Days tracked"]
        summary["Avg %"] = summary["Avg %"].round(1)
        st.dataframe(
            summary.set_index("Year"),
            use_container_width=True,
        )

    st.divider()

    # ── 4. Year-on-Year per-habit comparison ─────────────────────────────
    st.subheader("Per-habit completion — year over year")
    st.caption("Each bar group = one habit · Each colour = one year")

    if daily_cols:
        from src.db import clean_column_name
        task_label_map = {clean_column_name(t): t.split(" ", 1)[-1]
                          for t in ALL_TASKS["daily"]}

        habit_year = (
            df.groupby("year")[daily_cols]
            .mean()
            .mul(100)
            .reset_index()
            .melt(id_vars="year", var_name="col", value_name="pct")
        )
        habit_year["Habit"] = habit_year["col"].map(task_label_map).fillna(habit_year["col"])
        habit_year["Year"]  = habit_year["year"].astype(str)

        fig_hby = px.bar(
            habit_year,
            x="Habit",
            y="pct",
            color="Year",
            barmode="group",
            template=PLOTLY_TEMPLATE,
            labels={"pct": "Completion %", "Habit": ""},
            color_discrete_sequence=color_seq,
        )
        fig_hby.update_layout(
            yaxis_range=[0, 110],
            xaxis_tickangle=-35,
            legend_title="Year",
            hovermode="x unified",
        )
        fig_hby.add_hline(y=80, line_dash="dot", line_color="#aaa",
                          annotation_text="80% target")
        st.plotly_chart(fig_hby, use_container_width=True)

    st.divider()

    # ── 5. Monthly rolling 30-day trend — year overlay ───────────────────
    st.subheader("30-day rolling average — overlaid by year")
    st.caption("Compares your rolling consistency across years on the same day-of-year axis.")

    if daily_cols and len(df) >= 7:
        roll_all = (
            df.sort_values("daily_date")
            .assign(roll30=lambda d: d["pct"].rolling(30, min_periods=5).mean())
        )
        roll_all["doy"] = roll_all["daily_date"].dt.dayofyear

        fig_roll = go.Figure()
        for i, yr in enumerate(sorted(roll_all["year"].unique())):
            yr_data = roll_all[roll_all["year"] == yr].dropna(subset=["roll30"])
            is_current = (yr == _today.year)
            fig_roll.add_trace(go.Scatter(
                x=yr_data["doy"],
                y=yr_data["roll30"],
                mode="lines",
                name=str(yr),
                line=dict(
                    color=color_seq[i % len(color_seq)],
                    width=3 if is_current else 1.5,
                    dash="solid" if is_current else "dot",
                ),
            ))
        # Light day-of-year x-axis labels (Jan, Feb…)
        month_starts = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]
        fig_roll.update_layout(
            template=PLOTLY_TEMPLATE,
            xaxis=dict(
                tickvals=month_starts,
                ticktext=["Jan","Feb","Mar","Apr","May","Jun",
                           "Jul","Aug","Sep","Oct","Nov","Dec"],
                title="Month",
            ),
            yaxis=dict(title="30-day rolling avg %", range=[0, 105]),
            legend_title="Year",
            hovermode="x unified",
        )
        st.plotly_chart(fig_roll, use_container_width=True)


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

    dash_tab1, dash_tab2, dash_tab3, dash_tab4, dash_tab5 = st.tabs([
        "📅 Daily Trends",
        "📋 Per-Task Breakdown",
        "🔥 Habit Heatmap",
        "📆 Weekly / Monthly",
        "📈 Year-on-Year",
    ])

    with dash_tab1:
        _render_daily_trends_tab(df)

    with dash_tab2:
        _render_per_task_tab(df)

    with dash_tab3:
        _render_heatmap_tab(df)

    with dash_tab4:
        _render_weekly_monthly_tab(df)

    with dash_tab5:
        _render_yoy_tab(df)
