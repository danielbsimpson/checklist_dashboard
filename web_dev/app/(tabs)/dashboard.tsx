/**
 * Dashboard tab — Phase 3 implementation
 *
 * Five inner tabs:
 *   1. Daily Trends        — multi-category line chart + 7-day rolling avg
 *   2. Per-Task Breakdown  — horizontal bar chart ranked by completion %
 *   3. Habit Heatmap       — GitHub-style grid + streak stats
 *   4. Weekly / Monthly    — weekly bars, radar chart, day-of-week bars
 *   5. Year-on-Year        — five multi-year comparative views
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import DateFilter from '@/components/DateFilter';
import KpiCards from '@/components/KpiCards';
import DailyTrendsTab from '@/components/dashboard/DailyTrendsTab';
import HabitHeatmapTab from '@/components/dashboard/HabitHeatmapTab';
import PerTaskBreakdownTab from '@/components/dashboard/PerTaskBreakdownTab';
import WeeklyMonthlyTab from '@/components/dashboard/WeeklyMonthlyTab';
import YearOnYearTab from '@/components/dashboard/YearOnYearTab';
import { useDashboardData } from '@/src/useDashboardData';

const INNER_TABS = [
  { key: 'trends',    label: 'Trends'     },
  { key: 'pertask',   label: 'Per Task'   },
  { key: 'heatmap',   label: 'Heatmap'    },
  { key: 'weekly',    label: 'Wk/Mo'      },
  { key: 'yoy',       label: 'YoY'        },
] as const;

type TabKey = (typeof INNER_TABS)[number]['key'];

export default function DashboardScreen() {
  const {
    rows,
    dailyPoints,
    kpiAverages,
    loading,
    minDate,
    maxDate,
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    refresh,
  } = useDashboardData();

  const [activeTab, setActiveTab] = useState<TabKey>('trends');

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Loading dashboard…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isEmpty = rows.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.heading}>Dashboard</Text>
        <Pressable onPress={refresh} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>↻ Refresh</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Date filter ── */}
        <DateFilter
          minDate={minDate}
          maxDate={maxDate}
          startDate={startDate}
          endDate={endDate}
          onChangeStart={setStartDate}
          onChangeEnd={setEndDate}
        />

        {/* ── KPI cards ── */}
        <KpiCards averages={kpiAverages} />

        {isEmpty ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              No data yet — complete some goals and come back!
            </Text>
          </View>
        ) : (
          <>
            {/* ── Inner tab bar ── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabBarScroll}
            >
              <View style={styles.tabBar}>
                {INNER_TABS.map(({ key, label }) => (
                  <Pressable
                    key={key}
                    style={[styles.tab, activeTab === key && styles.tabActive]}
                    onPress={() => setActiveTab(key)}
                  >
                    <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {/* ── Tab content ── */}
            <View style={styles.tabContent}>
              {activeTab === 'trends'  && <DailyTrendsTab    dailyPoints={dailyPoints} />}
              {activeTab === 'pertask' && <PerTaskBreakdownTab rows={rows} />}
              {activeTab === 'heatmap' && <HabitHeatmapTab   dailyPoints={dailyPoints} />}
              {activeTab === 'weekly'  && <WeeklyMonthlyTab  rows={rows} />}
              {activeTab === 'yoy'     && <YearOnYearTab      rows={rows} />}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#151718',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#9BA1A6',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ECEDEE',
  },
  refreshBtn: {
    padding: 6,
  },
  refreshText: {
    color: '#3498db',
    fontSize: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    color: '#9BA1A6',
    fontSize: 14,
    textAlign: 'center',
  },
  tabBarScroll: {
    marginTop: 4,
  },
  tabBar: {
    flexDirection: 'row',
    gap: 4,
    paddingBottom: 2,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2d2f30',
  },
  tabActive: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  tabText: {
    color: '#9BA1A6',
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  tabContent: {
    marginTop: 12,
    minHeight: 300,
  },
});
