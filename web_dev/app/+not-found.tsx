import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn't exist.</Text>
        <Link href="/(tabs)/checklist" style={styles.link}>
          <Text>Go to checklist →</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#151718',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ECEDEE',
  },
  link: {
    marginTop: 16,
    paddingVertical: 16,
    color: '#3498db',
  },
});
