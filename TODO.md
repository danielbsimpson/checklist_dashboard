# iOS Native App — Migration Scope

Migrate the Streamlit Goal Tracker into a native iOS app while keeping the existing Supabase `goals` table and schema untouched.

---

## Decision Framework

### Framework: React Native + Expo ✅ Recommended over SwiftUI

| Criterion | React Native + Expo | SwiftUI |
|---|---|---|
| Supabase client | `@supabase/supabase-js` — mature, full-featured, works in RN out of the box | `supabase-swift` — less mature, fewer community examples |
| Language | TypeScript — similar enough to Python to be approachable | Swift — new language to learn |
| Dashboard charts | Victory Native / Gifted Charts / Recharts (web) | Swift Charts — limited, no radar/heatmap |
| PWA support | Expo for Web gives you PWA for free from the same codebase | iOS only, no PWA path |
| TestFlight | EAS Build → `.ipa` → TestFlight | Xcode archive → TestFlight |
| Dev environment | Windows or Mac | macOS + Xcode required |
| Shared codebase | Single repo, one language, targets iOS + PWA | iOS only |

**Conclusion:** Expo lets you ship to both TestFlight and PWA without writing code twice, and `@supabase/supabase-js` is a direct carry-over of the existing DB logic.

---

### Deployment: TestFlight + PWA (do both)

| Option | Cost | Native feel | Offline | Install friction |
|---|---|---|---|---|
| **TestFlight** | $99/yr Apple Developer account | Full native | Yes (with AsyncStorage) | Low — tap Install in TestFlight |
| **PWA** | Free | Near-native on iOS (Safari) | Partial (Service Worker) | Low — Add to Home Screen prompt |

**Recommendation:** Build the PWA first (faster feedback loop, zero cost). Wire up EAS Build for TestFlight once the PWA is stable.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Expo App (React Native)                 │
│                                                          │
│  ┌──────────────┐      ┌─────────────────────────────┐  │
│  │ Checklist tab│      │ Dashboard tab               │  │
│  │ (auto-save)  │      │ (5 inner tabs, charts)      │  │
│  └──────┬───────┘      └────────────┬────────────────┘  │
│         │                           │                    │
│  ┌──────▼───────────────────────────▼────────────────┐  │
│  │            src/ (shared logic)                     │  │
│  │  config.ts · date_utils.ts · db.ts · state.ts      │  │
│  └──────────────────────┬─────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────┘
                          │ @supabase/supabase-js
                          ▼
              ┌───────────────────────┐
              │  Supabase (unchanged) │
              │  goals table — same   │
              │  schema, same columns │
              └───────────────────────┘
```

**What stays the same:** Supabase project, `goals` table schema, column names, coalesce-merge save strategy, all task labels in `config`.

**What gets rebuilt:** Everything in `app.py`, `src/checklist.py`, `src/dashboard.py`, and `src/state.py` — ported to TypeScript/React Native equivalents.

---

## Phase 0 — Project Setup

> **Prerequisite — install Node.js LTS** before running any commands below.
> Download from https://nodejs.org (LTS build). Verify with `node --version` and `npm --version` in a new terminal.
> Then from the `web_dev/` folder: `npm install` to pull all declared dependencies.

- [x] Project scaffolded manually in `web_dev/` (no `create-expo-app` needed — all files created directly)
- [x] `package.json` — all dependencies declared: `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `expo-secure-store`, `expo-router`, `victory-native`, `@shopify/react-native-skia`, `react-native-svg`, `date-fns`
- [x] `app.json` — app name, bundle ID (`com.goaltracker.app` — update before TestFlight), iOS config, PWA web config
- [x] `.env.example` — template for Supabase credentials; copy to `.env` and fill in values
- [x] `eas.json` — `development`, `preview` (TestFlight internal), and `production` build profiles
- [x] `tsconfig.json` — strict TypeScript with `@/` path alias
- [x] `babel.config.js` — expo preset + reanimated plugin
- [x] `app/_layout.tsx` — root layout with splash screen and theme provider
- [x] `app/(tabs)/_layout.tsx` — bottom tab bar (Checklist + Dashboard)
- [x] `app/(tabs)/checklist.tsx` — placeholder screen (Phase 2)
- [x] `app/(tabs)/dashboard.tsx` — placeholder screen (Phase 3)
- [x] `constants/Colors.ts` — light/dark colour tokens
- [x] `hooks/useColorScheme.ts` + `.web.ts` — platform-aware colour scheme hook
- [x] `src/config.ts` — `ALL_TASKS`, `CATEGORY_COLORS`, `Category` type (direct port of `config.py`)
- [x] `src/types.ts` — `GoalsRow`, `CompletedTasks`, `ChecklistState`, `SaveResult` interfaces
- [ ] **Run `npm install`** in `web_dev/` after installing Node.js
- [ ] **Run `npx eas init`** to link the project to Expo Application Services (requires free Expo account at expo.dev)
- [ ] Update `eas.json` → `submit.production.ios` with your Apple ID, App Store Connect App ID, and Team ID
- [ ] Update `app.json` → `ios.bundleIdentifier` from `com.goaltracker.app` to your preferred reverse-domain ID

---

## Phase 1 — Port Shared Logic (no UI)

Port the Python `src/` modules to TypeScript. These are pure logic — no Streamlit imports — so they translate almost 1:1.

### `src/config.ts`
- [ ] Export `ALL_TASKS` object (daily/weekly/monthly/quarterly arrays) matching `config.py` exactly
- [ ] Export `CATEGORY_COLORS` record
- [ ] Export `cleanColumnName(name: string): string` — same regex logic as `clean_column_name()` in `db.py`

### `src/date_utils.ts`
- [ ] `getPeriodKey(category, now)` → same stable string per period (e.g. `"2026-04-27"`, `"week-2026-04-27"`)
- [ ] `getResetDates(now)` → next reset datetime per category
- [ ] `formatDate(dt)` → human-readable string
- [ ] `getPeriodStartDates(now)` → ISO start date per category (for DB queries)

### `src/db.ts`
- [ ] Initialise `supabase` client from secure store; export `SUPABASE_ENABLED` flag
- [ ] `fetchPeriodRows(now)` → rows from quarter-start through today
- [ ] `fetchTodayRow(now)` → single row for today
- [ ] `saveTaskToSupabase(now, category, task)` → fetch → coalesce-merge → upsert (1s never overwritten)
- [ ] `getCompletedTasksFromRows(rows, now)` → `{category: task[]}` for session restore
- [ ] `fetchAllRecords()` → full history for dashboard (cache with a TTL, e.g. 5 min via `AsyncStorage` timestamp)
- [ ] `taskColumns(category)` → DB column names for a category

### `src/state.ts`
- [ ] `initState(now)` → load `AsyncStorage`, call `fetchPeriodRows`, populate completed tasks; run once per day via a date sentinel key
- [ ] `isChecked(category, task, periodKey)` → boolean
- [ ] `markChecked(category, task, periodKey)` → update in-memory state
- [ ] Use React Context or Zustand store to share state across tabs without prop drilling

---

## Phase 2 — Checklist Tab

Rebuild `checklist.py` / `render_section()` as React Native components.

- [ ] **`ChecklistScreen.tsx`** — top-level tab screen; shows four `CategorySection` components
- [ ] **`CategorySection.tsx`** — collapsible section (one per category) with:
  - Category title and colour accent
  - Colour-coded progress bar (red → orange → yellow → green, matching current thresholds)
  - Period reset countdown (e.g. "Resets Monday")
  - List of unchecked tasks only (completed tasks are hidden until period resets)
- [ ] **`TaskRow.tsx`** — single task row styled as a checkbox:
  - Tap triggers `saveTaskToSupabase()` immediately (auto-save, no button)
  - Optimistic UI update (mark checked locally before await resolves)
  - Show brief toast/snackbar on save success or error (replaces `st.toast`)
- [ ] **Force Sync button** — re-saves all currently checked tasks; shown at bottom of screen
- [ ] **Offline banner** — shown when `SUPABASE_ENABLED` is false
- [ ] On app foreground (via `AppState` listener), re-check if the period has rolled over and reset state if so (replaces Streamlit's per-render period check)

---

## Phase 3 — Dashboard Tab

Rebuild `dashboard.py` as a scrollable screen with five inner tabs. Charts rendered with `victory-native` or `react-native-gifted-charts`.

### Shared
- [ ] Date-range filter at the top (start/end date pickers) scoping all charts
- [ ] Four KPI summary cards (avg completion % per category, colour-coded)
- [ ] `useDashboardData()` hook — fetches `fetchAllRecords()`, filters by date range, memoises

### Inner Tab 1 — Daily Trends
- [ ] Multi-line chart: completion % over time, one line per category
- [ ] 7-day rolling average bar+line overlay for daily goals

### Inner Tab 2 — Per-Task Breakdown
- [ ] Category selector (segmented control)
- [ ] Horizontal bar chart: tasks ranked by lifetime completion %
- [ ] 80% target line; best/worst habit callout labels

### Inner Tab 3 — Habit Heatmap
- [ ] GitHub-style grid (rows = Mon–Sun, columns = ISO weeks), coloured by daily completion %
- [ ] Current streak, longest streak, total days tracked — displayed as stat chips

### Inner Tab 4 — Weekly / Monthly
- [ ] Weekly aggregated bar chart
- [ ] Monthly radar/spider chart comparing all four categories
- [ ] Day-of-week performance bar chart

### Inner Tab 5 — Year-on-Year
- [ ] Total points per year bar chart with avg completion % right-axis overlay and YoY delta cards
- [ ] Monthly heatmap grid (12 months × N years)
- [ ] Same-month-across-years line chart with year picker
- [ ] Per-habit YoY grouped bar chart
- [ ] 30-day rolling average year overlay

---

## Phase 4 — PWA Deployment

- [ ] Add `expo-router`'s web support: `npx expo install expo-router/web`
- [ ] Add `public/manifest.json` with app name, icons (192px, 512px), `display: standalone`, `theme_color`
- [ ] Add a Service Worker (via `@expo/webpack-config` or a custom `workbox` config) for offline caching of the app shell
- [ ] Run `npx expo export --platform web` to generate static build
- [ ] Deploy to **Vercel** or **Netlify** (free tier) — connect GitHub repo, set build command to `npx expo export --platform web`, output dir to `dist/`
- [ ] Set Supabase URL and anon key as environment variables in the hosting platform (never in source)
- [ ] Test "Add to Home Screen" in Safari on iPhone — confirm standalone mode, icon, and splash screen
- [ ] Configure Supabase Auth → allowed redirect URLs to include the PWA domain

---

## Phase 5 — TestFlight Deployment

- [ ] Enrol in the **Apple Developer Program** ($99/yr) if not already enrolled
- [ ] Create an App ID and bundle identifier in the Apple Developer portal
- [ ] Configure EAS Build in `eas.json`:
  ```json
  {
    "build": {
      "preview": {
        "distribution": "internal",
        "ios": { "simulator": false }
      }
    }
  }
  ```
- [ ] Run `eas build --platform ios --profile preview` to produce a signed `.ipa`
- [ ] Upload to TestFlight via `eas submit --platform ios` or manually via Transporter
- [ ] Add yourself as an internal tester in App Store Connect → TestFlight
- [ ] Install the app on iPhone via the TestFlight app
- [ ] Verify: auto-save, session restore, period resets, all dashboard charts

---

## Phase 6 — Polish & Parity

- [ ] App icon and splash screen matching the dashboard colour scheme
- [ ] Dark mode support (system appearance aware)
- [ ] Haptic feedback on task check (via `expo-haptics`)
- [ ] Push notifications for daily reset reminder (via `expo-notifications`) — optional
- [ ] Deep link / universal link support so a shared URL opens the app — optional
- [ ] Keep Streamlit app live on Community Cloud as a fallback / desktop view

---

## Open Questions

| Question | Options | Recommendation |
|---|---|---|
| Chart library for React Native | `victory-native` (mature, rich), `react-native-gifted-charts` (lighter) | `victory-native` for radar/heatmap support |
| State management | React Context, Zustand, Jotai | Zustand — minimal boilerplate, good RN track record |
| Auth / access control | None (public), Supabase Auth (magic link or OAuth) | Add Supabase Auth magic-link if you want to lock the app to your account |
| Existing Streamlit app | Keep live, retire, or keep as admin/debug view | Keep live — it costs nothing and serves as a desktop fallback |
| iOS-only vs cross-platform | iOS only (Expo can still do it), or also Android | iOS only for now; Expo makes Android trivial to add later |
