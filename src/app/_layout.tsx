import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/auth/AuthProvider';
import { AuthGate } from '@/auth/AuthGate';

export default function RootLayout() {
  return <SafeAreaProvider><StatusBar style="dark" /><AuthProvider><AuthGate /></AuthProvider></SafeAreaProvider>;
}
