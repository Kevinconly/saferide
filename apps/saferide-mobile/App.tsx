import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SafeRide Kigali</Text>
      <Text style={styles.subtitle}>
        The passenger mobile app is coming soon.
      </Text>
      <Text style={styles.subtitle}>
        Use the web app at saferide.rw in the meantime.
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B3D2E',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#C7E5D8',
    textAlign: 'center',
    marginBottom: 8,
  },
});
