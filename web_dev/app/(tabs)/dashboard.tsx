/**
 * Dashboard tab — Phase 3 implementation
 *
 * This screen will render five inner tabs:
 *   1. Daily Trends        — multi-category line chart + 7-day rolling avg
 *   2. Per-Task Breakdown  — horizontal bar chart ranked by completion %
 *   3. Habit Heatmap       — GitHub-style grid + streak stats
 *   4. Weekly / Monthly    — weekly bars, radar chart, day-of-week bars
 *   5. Year-on-Year        — five multi-year comparative views
 *
 * Charts are rendered with victory-native (Skia-powered).
 * Data is fetched from Supabase via fetchAllRecords() in src/db.ts.
 *
 * Current state: navigation shell placeholder.
 */
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function DashboardScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.heading}>📊 Dashboard</Text>
        <Text style={styles.subtitle}>Phase 3 — coming soon</Text>
        <Text style={styles.note}>
          Analytics charts (trends, heatmap, YoY comparisons) will appear here.
          All data is pulled from the same Supabase{' '}
          <Text style={styles.code}>goals</Text> table.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#151718',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ECEDEE',
  },
  subtitle: {
    fontSize: 16,
    color: '#9b59b6',
    fontWeight: '600',
  },
  note: {
    fontSize: 14,
    color: '#9BA1A6',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
  },
  code: {
    fontFamily: 'monospace',
    color: '#3498db',
  },
});
