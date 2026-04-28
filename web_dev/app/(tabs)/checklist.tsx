/**
 * Checklist tab — Phase 2 implementation
 *
 * This screen will render four CategorySection components (daily, weekly,
 * monthly, quarterly), each with a collapsible goal list, colour-coded
 * progress bar, and per-task auto-save on tap via saveTaskToSupabase().
 *
 * Current state: navigation shell placeholder.
 */
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function ChecklistScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.heading}>✅ Checklist</Text>
        <Text style={styles.subtitle}>Phase 2 — coming soon</Text>
        <Text style={styles.note}>
          Goal categories (daily / weekly / monthly / quarterly) will appear
          here. Each task auto-saves to Supabase the moment it is tapped.
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
    color: '#3498db',
    fontWeight: '600',
  },
  note: {
    fontSize: 14,
    color: '#9BA1A6',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
  },
});
