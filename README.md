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
- **🔄 Force Sync** button re-saves all currently visible checked goals — useful as a manual fallback if a toast reported a save error

### 📊 Dashboard tab

A date-range filter at the top scopes all charts simultaneously. Four KPI cards show overall average completion per category at a glance. The dashboard contains five inner tabs:

| Tab | What it shows |
|---|---|
| **📅 Daily Trends** | Multi-category line chart of completion % over time; 7-day rolling average bar/line overlay for daily goals |
| **📋 Per-Task Breakdown** | Horizontal bar chart ranking every task in a chosen category by lifetime completion %, with an 80% target line and best/worst habit callouts |
| **🔥 Habit Heatmap** | GitHub-style grid (rows = Mon–Sun, columns = ISO weeks) coloured by daily completion %; current streak, longest streak, and total days tracked |
| **📆 Weekly / Monthly** | Weekly aggregated bar chart; monthly radar/spider chart comparing all four categories; day-of-week performance bar chart |
| **📈 Year-on-Year** | Five multi-year views — see below |

#### 📈 Year-on-Year tab

| Section | What it shows |
|---|---|
| **Total points per year** | Bar chart of raw points accumulated each year (one point = one completed daily goal). Right-axis overlay shows avg completion % per year. KPI metric cards show year-over-year delta (e.g. `+4.2%`). |
| **Monthly heatmap — all years** | 12 × N grid (rows = Jan–Dec, columns = each year), coloured red→green. Reveals which months you've historically struggled in and whether they've improved over time. |
| **Same month across years** | Pick any calendar month; one line per year shows daily completion % through that month. Current year = bold/solid, past years = dotted. Summary table shows avg % and days tracked per year. |
| **Per-habit YoY grouped bars** | One bar group per daily habit, one colour per year — shows which habits have improved, regressed, or stayed flat across years. 80% target line included. |
| **30-day rolling average — year overlay** | All years plotted on the same Jan–Dec axis so you can see seasonal patterns and whether this year's rolling consistency tracks above or below previous years. |

---

## How saving works

Understanding the save strategy helps avoid confusion:

1. **Auto-save on tick** — the moment you check off a goal, `save_task_to_supabase()` fires. It fetches today's existing row from Supabase, merges the new tick in, and upserts the result.
2. **Coalesce merge — 1s are never overwritten** — the upsert only ever sets a column to `1`. If Exercise was saved as `1` at 7am and you reopen the app at 2pm (with a blank session), checking Read will save `exercise=1, read=1` — the earlier save is preserved.
3. **Session restore on load** — when the app first loads each day, it fetches today's saved row and pre-populates session state. Goals checked in an earlier session are immediately shown as done and hidden from the checklist.
4. **Force Sync** — the button in the Checklist tab re-runs the save for all tasks currently checked in this session. It's a safety net, not the primary save path.

---

## Project structure

```
checklist_dashboard/
├── app.py                  # Thin entry point — page config, tabs, Force Sync button
├── requirements.txt
├── .gitignore
├── .streamlit/
│   └── secrets.toml        # Supabase credentials (never committed)
├── data/                   # Historical data pipeline (see section below)
│   ├── Daily Goal tracker.xlsx
│   ├── example_data.csv
│   ├── extract_xlsx.py
│   ├── historical_goals.csv
│   ├── historical_upload.sql
│   └── upload_historical.py
└── src/
    ├── __init__.py
    ├── config.py            # Goal lists (ALL_TASKS) and visual constants
    ├── date_utils.py        # Date formatting, reset boundaries, period keys
    ├── db.py                # Supabase client, per-task save, session restore, fetch
    ├── state.py             # Session-state helpers + DB restore on first daily load
    ├── checklist.py         # render_section() with auto-save, render_checklist_tab()
    └── dashboard.py         # render_dashboard() and five private chart helpers
```

**Dependency flow** (strictly one-directional, no circular imports):

```
app.py  →  checklist / dashboard  →  db / state / date_utils  →  config
```

### Key functions in `src/db.py`

| Function | Purpose |
|---|---|
| `save_task_to_supabase(now, category, task)` | Auto-save one task. Fetches existing row, merges, upserts. Called on every tick. |
| `fetch_today_row(now)` | Fetch the single row for today's date. Used by `init_state()` on load. |
| `get_completed_tasks_from_row(row)` | Convert a raw DB row back to `{category: [task, …]}` for session restore. |
| `fetch_all_records()` | Fetch full history for the dashboard (cached 5 min). |

> **To add, remove, or rename a goal** — edit only `src/config.py`. Everything else (DB column mapping, dashboard charts, session state) updates automatically.

---

## Historical data pipeline

Before this app existed, goal tracking was done manually in **Google Sheets** — a spreadsheet where each row was a habit and each column was a day, with `TRUE`/`FALSE` values filled in daily. The spreadsheet was structured with weekly bands: each month had two blocks (weeks 1–2 and weeks 3–4), a weekly goals sidebar, and a monthly goals column — all on a single sheet per month.

When this app was built, that full history (November 2022 → September 2025, ~35 months) was exported as an `.xlsx` file and migrated into Supabase using the pipeline in the `data/` folder:

### `data/` folder contents

| File | Purpose |
|---|---|
| `Daily Goal tracker.xlsx` | The original exported Google Sheets workbook — one sheet per month, 35+ sheets total |
| `example_data.csv` | A CSV sample of one month's sheet layout, used to understand the format during development |
| `extract_xlsx.py` | Parses every sheet in the `.xlsx` file and extracts all `TRUE`/`FALSE` values into a single flat table |
| `historical_goals.csv` | The output of `extract_xlsx.py` — 12,484 rows in long format: one row per `(date, goal)` |
| `upload_historical.py` | Pivots `historical_goals.csv` from long to wide format (one row per date, one column per goal) and generates the SQL upload file |
| `historical_upload.sql` | Ready-to-run SQL for the Supabase SQL Editor — 802 rows spanning Nov 2022 → Jul 2025 |

### How the migration worked

**Step 1 — Extract (`extract_xlsx.py`)**

The spreadsheet layout varied across years: early sheets (Nov–Dec 2022) had data starting in column A, later sheets shifted one column right; some months had a fifth "Bonus Week" block. The script auto-detects both layouts and parses:
- Daily goals (TRUE/FALSE per day, per task, per week)
- Weekly goals (one TRUE/FALSE per week per task)
- Monthly goals (one TRUE/FALSE per month per task)

Output: `historical_goals.csv` — long format with columns `date, goal, category, completed, week_label, sheet`.

**Step 2 — Normalise & pivot (`upload_historical.py`)**

Goal names changed over the years (e.g. `"Brush Teeth (>=2)"` → `"(2x)Brush+(1x)Floss"`, five different Water label variants → `water`). The script maps every historical label to the current DB column name, then pivots the long-format CSV into one wide row per date matching the `goals` table schema.

It generates `historical_upload.sql` using `INSERT ... ON CONFLICT (daily_date) DO UPDATE SET col = GREATEST(existing, incoming)` — so running it against a live database never overwrites a `1` with a `0`.

**Step 3 — Upload (`historical_upload.sql`)**

Paste the file into **Supabase → SQL Editor → New query** and click Run. Inserts 802 historical date rows covering November 2022 through July 2025.

> The `data/` scripts are one-time migration tools. They do not need to be re-run unless the source `.xlsx` is updated with new sheets.

---

## Running locally

```bash
pip install -r requirements.txt
streamlit run app.py
```

**Without Supabase credentials:** the app runs fully — an info banner is shown, the Force Sync button is disabled, and auto-save is silently skipped. The checklist works using in-memory session state only; progress is lost on page refresh.

**With Supabase credentials:** goals auto-save on every tick and are restored on each fresh load. See the setup section below.

---

## Supabase setup

### 1. Create a project
Sign up for a free project at [supabase.com](https://supabase.com).

### 2. Create the `goals` table
Run this in the Supabase **SQL Editor**. Column names are derived from task labels by stripping emoji and punctuation, then lower-casing (e.g. `"🏋️ Exercise"` → `exercise`, `"😴 7 hours sleep"` → `task_7_hours_sleep`).

```sql
create table goals (
  daily_date    date primary key,
  week_start    date,
  month_start   date,
  quarter_start text,

  -- Daily tasks
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

  -- Weekly tasks
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

  -- Monthly tasks
  wash_sheets          int default 0,
  haircut              int default 0,
  savings_deposit      int default 0,
  loan_payment         int default 0,
  wash_mats            int default 0,

  -- Quarterly tasks
  vacation_savings     int default 0,
  longterm_project     int default 0
);
```

> **Tip:** If you add or rename a task in `src/config.py`, add the corresponding column to this table. Old rows default to `0` for new columns, which is correct.

### 3. Get your credentials
In your Supabase project go to **Settings → API** and copy:
- **Project URL** — looks like `https://xxxxxxxxxxxx.supabase.co`
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

1. Push this repo to GitHub — confirm `.streamlit/secrets.toml` is **not** included (check `.gitignore`).
2. Go to [share.streamlit.io](https://share.streamlit.io) → **New app** → select this repo, branch `main`, file `app.py`.
3. Open **Advanced settings → Secrets** and paste the full contents of your `secrets.toml`.
4. Click **Deploy**.

The app will be publicly accessible at a `*.streamlit.app` URL. You can restrict access under **Settings → Sharing** if needed.

---

## Tech stack

| Package | Purpose |
|---|---|
| `streamlit` | UI framework and deployment platform |
| `supabase` | PostgreSQL-backed cloud database client |
| `pandas` | Data wrangling for dashboard charts |
| `plotly` | Interactive charts (line, bar, heatmap, radar, polar) |
| `openpyxl` | Reading the legacy `.xlsx` workbook during the one-time data migration |


---

## Features

### ✅ Checklist tab
- Four goal categories: **Daily**, **Weekly**, **Monthly**, **Quarterly**
- **Auto-saves to Supabase the instant a goal is ticked** — no Save button required
- A brief toast notification confirms each save (or reports an error)
- On app load, today's already-saved goals are restored automatically — goals you checked earlier in the day stay hidden even after closing and reopening the app
- Completed tasks vanish immediately; they reappear automatically when the period resets (midnight for daily, Monday for weekly, 1st for monthly/quarterly)
- Colour-coded progress bar per category (red → orange → yellow → green)
- **🔄 Force Sync** button re-saves all currently visible checked goals — useful as a manual fallback if a toast reported a save error

### 📊 Dashboard tab
Pulls the full history from Supabase and presents four inner tabs:

| Tab | What it shows |
|---|---|
| **📅 Daily Trends** | Multi-category line chart of completion % over time; 7-day rolling average bar/line overlay for daily goals |
| **📋 Per-Task Breakdown** | Horizontal bar chart ranking every task in a chosen category by lifetime completion %, with an 80% target line and best/worst habit callouts |
| **🔥 Habit Heatmap** | GitHub-style grid (rows = Mon–Sun, columns = ISO weeks) coloured by daily completion %; current streak, longest streak, and total days tracked |
| **📆 Weekly / Monthly** | Weekly aggregated bar chart; monthly radar/spider chart comparing all four categories; day-of-week performance bar chart |

A date-range filter at the top of the dashboard scopes all charts simultaneously. Four KPI cards show overall average completion per category at a glance.

---

## How saving works

Understanding the save strategy helps avoid confusion:

1. **Auto-save on tick** — the moment you check off a goal, `save_task_to_supabase()` fires. It fetches today's existing row from Supabase, merges the new tick in, and upserts the result.
2. **Coalesce merge — 1s are never overwritten** — the upsert only ever sets a column to `1`. If Exercise was saved as `1` at 7am and you reopen the app at 2pm (with a blank session), checking Read will save `EXERCISE=1, READ=1` — the earlier save is preserved.
3. **Session restore on load** — when the app first loads each day, it fetches today's saved row and pre-populates session state. Goals checked in an earlier session are immediately shown as done and hidden from the checklist.
4. **Force Sync** — the button in the Checklist tab re-runs the save for all tasks currently checked in this session. It's a safety net, not the primary save path.

---

## Project structure

```
checklist_dashboard/
├── app.py                  # Thin entry point — page config, tabs, Force Sync button
├── requirements.txt
├── .gitignore
├── .streamlit/
│   └── secrets.toml        # Supabase credentials (never committed)
└── src/
    ├── __init__.py
    ├── config.py            # Goal lists (ALL_TASKS) and visual constants
    ├── date_utils.py        # Date formatting, reset boundaries, period keys
    ├── db.py                # Supabase client, per-task save, session restore, fetch
    ├── state.py             # Session-state helpers + DB restore on first daily load
    ├── checklist.py         # render_section() with auto-save, render_checklist_tab()
    └── dashboard.py         # render_dashboard() and four private chart helpers
```

**Dependency flow** (strictly one-directional, no circular imports):

```
app.py  →  checklist / dashboard  →  db / state / date_utils  →  config
```

### Key functions in `src/db.py`

| Function | Purpose |
|---|---|
| `save_task_to_supabase(now, category, task)` | Auto-save one task. Fetches existing row, merges, upserts. Called on every tick. |
| `fetch_today_row(now)` | Fetch the single row for today's date. Used by `init_state()` on load. |
| `get_completed_tasks_from_row(row)` | Convert a raw DB row back to `{category: [task, …]}` for session restore. |
| `fetch_all_records()` | Fetch full history for the dashboard (cached 5 min). |

> **To add, remove, or rename a goal** — edit only `src/config.py`. Everything else (DB column mapping, dashboard charts, session state) updates automatically.

---

## Running locally

```bash
pip install -r requirements.txt
streamlit run app.py
```

**Without Supabase credentials:** the app runs fully — an info banner is shown, the Force Sync button is disabled, and auto-save is silently skipped. The checklist works using in-memory session state only; progress is lost on page refresh.

**With Supabase credentials:** goals auto-save on every tick and are restored on each fresh load. See the setup section below.

---

## Supabase setup

### 1. Create a project
Sign up for a free project at [supabase.com](https://supabase.com).

### 2. Create the `goals` table
Run this in the Supabase **SQL Editor**. Column names are derived from task labels by stripping emoji and punctuation, then upper-casing (e.g. `"🏋️ Exercise"` → `EXERCISE`).

```sql
create table goals (
  daily_date    date primary key,
  week_start    date,
  month_start   date,
  quarter_start text,

  -- Daily tasks
  EXERCISE             int default 0,
  STRETCH_YOGA         int default 0,
  SOCIAL_MEDIA         int default 0,
  EAT_IN               int default 0,
  REVIEW_BUDGET_GOALS  int default 0,
  X_BRUSH_X_FLOSS      int default 0,
  WATER                int default 0,
  SEVEN_HOURS_SLEEP    int default 0,
  CLEAN                int default 0,
  READ                 int default 0,
  VITAMINS             int default 0,
  DUOLINGO             int default 0,

  -- Weekly tasks
  LAUNDRY              int default 0,
  CLEANING             int default 0,
  GROCERY_SHOP         int default 0,
  MEAL_PREP            int default 0,
  PERSONAL_DEVELOPMENT int default 0,
  RECYCLING            int default 0,
  TRASH                int default 0,
  SHAVE_TRIM           int default 0,
  WATER_PLANTS         int default 0,
  WEEKEND_EXERCISE     int default 0,

  -- Monthly tasks
  WASH_SHEETS          int default 0,
  HAIRCUT              int default 0,
  SAVINGS_DEPOSIT      int default 0,
  LOAN_PAYMENT         int default 0,
  WASH_MATS            int default 0,

  -- Quarterly tasks
  VACATION_SAVINGS     int default 0,
  LONGTERM_PROJECT     int default 0
);
```

> **Tip:** If you add or rename a task in `src/config.py`, add the corresponding column to this table. Old rows default to `0` for new columns, which is correct.

### 3. Get your credentials
In your Supabase project go to **Settings → API** and copy:
- **Project URL** — looks like `https://xxxxxxxxxxxx.supabase.co`
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

1. Push this repo to GitHub — confirm `.streamlit/secrets.toml` is **not** included (check `.gitignore`).
2. Go to [share.streamlit.io](https://share.streamlit.io) → **New app** → select this repo, branch `main`, file `app.py`.
3. Open **Advanced settings → Secrets** and paste the full contents of your `secrets.toml`.
4. Click **Deploy**.

The app will be publicly accessible at a `*.streamlit.app` URL. You can restrict access under **Settings → Sharing** if needed.

---

## Tech stack

| Package | Purpose |
|---|---|
| `streamlit` | UI framework and deployment platform |
| `supabase` | PostgreSQL-backed cloud database client |
| `pandas` | Data wrangling for dashboard charts |
| `plotly` | Interactive charts (line, bar, heatmap, radar) |
