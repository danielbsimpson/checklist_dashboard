# 📆 Goal Tracker Dashboard

A personal habit-tracking app built with [Streamlit](https://streamlit.io). Tick off daily, weekly, monthly, and quarterly goals — completed items disappear until their period resets. Every tick is saved to [Supabase](https://supabase.com) instantly, so you can open the app as many times as you like throughout the day and each completed goal accumulates correctly. Three years of historical data (Nov 2022 – present) backs a rich analytics dashboard with year-on-year comparisons.

---

## Features

### ✅ Checklist tab
- Four goal categories: **Daily**, **Weekly**, **Monthly**, **Quarterly**
- **Auto-saves to Supabase the instant a goal is ticked** — no Save button required
- A brief toast notification confirms each save (or reports an error)
- On app load, today's already-saved goals are restored automatically — goals you checked earlier in the day stay hidden even after closing and reopening the app
- Completed tasks vanish immediately; they reappear automatically when the period resets (midnight for daily, Monday for weekly, 1st for monthly/quarterly)
- Colour-coded progress bar per category (red → orange → yellow → green)
- **🔄 Force Sync** button re-saves all currently checked goals — useful as a manual fallback if a toast reported a save error

### 📊 Dashboard tab

A date-range filter at the top scopes all charts simultaneously. Four KPI cards show overall average completion per category at a glance. The dashboard contains five inner tabs:

| Tab | What it shows |
|---|---|
| **📅 Daily Trends** | Multi-category line chart of completion % over time; 7-day rolling average bar/line overlay for daily goals |
| **📋 Per-Task Breakdown** | Horizontal bar chart ranking every task in a chosen category by lifetime completion %, with an 80% target line and best/worst habit callouts |
| **🔥 Habit Heatmap** | GitHub-style grid (rows = Mon–Sun, columns = ISO weeks) coloured by daily completion %; current streak, longest streak, and total days tracked |
| **📆 Weekly / Monthly** | Weekly aggregated bar chart; monthly radar/spider chart comparing all four categories; day-of-week performance bar chart |
| **📈 Year-on-Year** | Five multi-year comparative views — see below |

#### 📈 Year-on-Year tab

| Section | What it shows |
|---|---|
| **Total points per year** | Bar chart of raw points accumulated each year (one point = one completed daily goal). Right-axis overlay shows avg completion % per year. KPI metric cards show year-over-year delta (e.g. `+4.2%`). |
| **Monthly heatmap — all years** | 12 × N grid (rows = Jan–Dec, columns = each year), coloured red → green. Reveals which months you've historically struggled in and whether they've improved over time. |
| **Same month across years** | Pick any calendar month; one line per year shows daily completion % through that month. Current year = bold/solid, past years = dotted. Summary table shows avg % and days tracked per year. |
| **Per-habit YoY grouped bars** | One bar group per daily habit, one colour per year — shows which habits have improved, regressed, or stayed flat across years. 80% target line included. |
| **30-day rolling average — year overlay** | All years plotted on the same Jan–Dec axis so you can spot seasonal patterns and whether this year's rolling consistency tracks above or below previous years. |

---

## How saving works

1. **Auto-save on tick** — the moment you check off a goal, `save_task_to_supabase()` fires. It fetches today's existing row from Supabase, merges the new tick in, and upserts the result.
2. **Coalesce merge — 1s are never overwritten** — the upsert only ever sets a column to `1`. If Exercise was saved at 7 am and you reopen the app at 2 pm, checking Read will write `exercise=1, read=1` — the earlier save is preserved.
3. **Session restore on load** — on the first load of each day the app fetches today's saved row and pre-populates session state. Goals checked in an earlier session stay hidden immediately.
4. **Force Sync** — the button in the Checklist tab re-saves all tasks currently checked in this session. It is a safety net, not the primary save path.

---

## Project structure

```
checklist_dashboard/
├── app.py                  # Entry point — page config, top-level tabs, Force Sync button
├── requirements.txt        # streamlit, supabase, pandas, plotly, openpyxl
├── .gitignore
├── .streamlit/
│   └── secrets.toml        # Supabase credentials (never committed)
├── data/                   # Historical data pipeline (one-time migration, see below)
│   ├── Daily Goal tracker.xlsx   # Original exported Google Sheets workbook
│   ├── example_data.csv          # Single-month layout sample used during development
│   ├── extract_xlsx.py           # Parses all sheets → historical_goals.csv
│   ├── historical_goals.csv      # 12,484-row long-format extract (date, goal, completed…)
│   ├── upload_historical.py      # Pivots CSV → wide format, generates SQL file
│   └── historical_upload.sql     # Ready-to-run Supabase INSERT (802 rows, Nov 2022 – Jul 2025)
└── src/
    ├── __init__.py
    ├── config.py            # ALL_TASKS goal lists and visual constants (edit here to add/remove goals)
    ├── date_utils.py        # Date formatting, period reset boundaries, period key helpers
    ├── db.py                # Supabase client init, per-task save, session restore, history fetch
    ├── state.py             # Session-state helpers and once-per-day DB restore on first load
    ├── checklist.py         # render_section() and render_checklist_tab() with auto-save logic
    └── dashboard.py         # render_dashboard() and five private chart-tab helpers
```

**Dependency flow** (one-directional — no circular imports):

```
app.py  →  checklist / dashboard  →  db / state / date_utils  →  config
```

### Key functions

#### `src/db.py`

| Function | Purpose |
|---|---|
| `save_task_to_supabase(now, category, task)` | Auto-save one task on tick — fetches existing row, coalesce-merges, upserts |
| `fetch_today_row(now)` | Fetches today's single DB row; used by `init_state()` on first daily load |
| `get_completed_tasks_from_row(row)` | Converts a raw DB row to `{category: [task, …]}` for session restore |
| `fetch_all_records()` | Fetches full history for dashboard charts (cached 5 min via `@st.cache_data`) |
| `clean_column_name(name)` | Strips emoji/punctuation from a task label to derive its DB column name |

#### `src/state.py`

| Function | Purpose |
|---|---|
| `init_state(now)` | Ensures every task has a session-state entry; on first load of the day, restores saved completions from Supabase |
| `is_checked(category, task, period_key)` | Returns `True` if the task is marked done in the current period |
| `mark_checked(category, task, period_key)` | Sets the task as done in session state |

#### `src/date_utils.py`

| Function | Purpose |
|---|---|
| `get_reset_dates(now)` | Returns the next reset datetime for each category |
| `get_period_key(category, now)` | Returns a stable string identifying the current period (e.g. `"2026-04-01"`, `"week-2026-03-30"`) |
| `format_date(dt)` | Human-readable date string used in the UI |

> **To add, remove, or rename a goal** — edit only `src/config.py`. Column mapping, dashboard charts, and session state all update automatically.

---

## Historical data pipeline

Before this app existed, goal tracking was done manually in **Google Sheets** — one sheet per month, with rows as habits, columns as days, and `TRUE`/`FALSE` values filled in daily. Each sheet had weekly bands (weeks 1–2 and weeks 3–4), a weekly goals sidebar, and a monthly goals column.

When this Streamlit app was built, the full Google Sheets history (November 2022 → September 2025, 35+ months) was exported to a single `.xlsx` file and migrated into Supabase using the three-step pipeline below.

### Step 1 — Extract (`data/extract_xlsx.py`)

Parses every sheet in `Daily Goal tracker.xlsx`. Handles two layout variants (early sheets start in column A; later sheets are shifted right by one column) and five-week months with a Bonus Week block. Extracts daily, weekly, and monthly `TRUE`/`FALSE` values into a flat long-format CSV.

**Output:** `historical_goals.csv` — 12,484 rows with columns `date, goal, category, completed, week_label, sheet`.

```bash
python data/extract_xlsx.py
```

### Step 2 — Normalise & pivot (`data/upload_historical.py`)

Goal labels changed over the years (e.g. `"Brush Teeth (>=2)"` → `"(2x)Brush+(1x)Floss"`, five Water variants → `water`). The script maps every historical label to the current DB column name, then pivots to one wide row per date matching the `goals` table schema. Generates a SQL file using `INSERT … ON CONFLICT (daily_date) DO UPDATE SET col = GREATEST(existing, incoming)` so no live `1` is ever overwritten by a historical `0`.

**Output:** `historical_upload.sql` — 802 rows spanning Nov 2022 → Jul 2025.

```bash
python data/upload_historical.py          # generates the SQL file
python data/upload_historical.py --dry-run  # preview without writing
```

### Step 3 — Upload (`data/historical_upload.sql`)

Open **Supabase → SQL Editor → New query**, paste the file contents, and click **Run**.

> These scripts are one-time migration tools and do not need to be re-run unless new sheets are added to the `.xlsx` file.

---

## Running locally

```bash
pip install -r requirements.txt
streamlit run app.py
```

**Without Supabase credentials:** the app runs fully in offline mode — an info banner is shown, the Force Sync button is disabled, and saves are skipped. The checklist works via in-memory session state only; progress is lost on page refresh.

**With Supabase credentials:** goals auto-save on every tick and are restored on each fresh load.

---

## Supabase setup

### 1. Create a project
Sign up for a free project at [supabase.com](https://supabase.com).

### 2. Create the `goals` table

Run this in the Supabase **SQL Editor**. Column names are derived from task labels by stripping emoji/punctuation and lower-casing (e.g. `"🏋️ Exercise"` → `exercise`, `"😴 7 hours sleep"` → `task_7_hours_sleep`).

```sql
create table goals (
  daily_date    date primary key,
  week_start    date,
  month_start   date,
  quarter_start text,

  -- Daily
  exercise             int default 0,
  stretch_yoga         int default 0,
  social_media         int default 0,
  eat_in               int default 0,
  review_budget_goals  int default 0,
  brush_floss          int default 0,
  water                int default 0,
  task_7_hours_sleep   int default 0,
  clean                int default 0,
  read                 int default 0,
  vitamins             int default 0,
  duolingo             int default 0,

  -- Weekly
  laundry              int default 0,
  cleaning             int default 0,
  grocery_shop         int default 0,
  meal_prep            int default 0,
  personal_development int default 0,
  recycling            int default 0,
  trash                int default 0,
  shave_trim           int default 0,
  water_plants         int default 0,
  weekend_exercise     int default 0,

  -- Monthly
  wash_sheets          int default 0,
  haircut              int default 0,
  savings_deposit      int default 0,
  loan_payment         int default 0,
  wash_mats            int default 0,

  -- Quarterly
  vacation_savings     int default 0,
  longterm_project     int default 0
);
```

> **Tip:** To add a task, add it to `src/config.py` and add the corresponding column here. Existing rows default to `0` for new columns.

### 3. Get your credentials
In your Supabase project go to **Settings → API** and copy:
- **Project URL** — `https://xxxxxxxxxxxx.supabase.co`
- **anon public key** — the long `eyJ…` JWT

### 4. Add credentials locally

Create `.streamlit/secrets.toml` (already in `.gitignore` — never commit this file):

```toml
[supabase]
url     = "https://YOUR_PROJECT_ID.supabase.co"
api_key = "YOUR_ANON_PUBLIC_KEY"
```

---

## Deploying to Streamlit Community Cloud

1. Push this repo to GitHub — confirm `.streamlit/secrets.toml` is **not** included.
2. Go to [share.streamlit.io](https://share.streamlit.io) → **New app** → select this repo, branch `main`, file `app.py`.
3. Open **Advanced settings → Secrets** and paste the full contents of your `secrets.toml`.
4. Click **Deploy**.

The app will be publicly accessible at a `*.streamlit.app` URL. Access can be restricted under **Settings → Sharing**.

---

## Tech stack

| Package | Purpose |
|---|---|
| `streamlit` | UI framework and deployment platform |
| `supabase` | PostgreSQL-backed cloud database client |
| `pandas` | Data wrangling for dashboard charts |
| `plotly` | Interactive charts (line, bar, heatmap, radar, polar) |
| `openpyxl` | Reading the legacy `.xlsx` workbook during the one-time data migration |
