import { useState } from 'react';
import { Stack } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';
import { useAuth } from './AuthProvider';
import { JournalScreen } from '@/components/JournalScreen';
import { ActionButton } from '@/components/ActionButton';
import { theme } from '@/theme/tokens';

export function AuthGate() {
  const { session, loading, error, retry, signOut } = useAuth();
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  if (loading) return <JournalScreen eyebrow="LoreMore" title="Welcome back." description="Opening your journal…"><ActivityIndicator accessibilityLabel="Restoring session" color={theme.colors.accent} /></JournalScreen>;
  if (error) return <JournalScreen eyebrow="Connection" title="Let’s try that again." description={error}>
    {clearError && <Text accessibilityRole="alert">{clearError}</Text>}
    <ActionButton title="Retry" disabled={clearing} onPress={retry} />
    <ActionButton title={clearing ? 'Signing out…' : 'Sign out on this device'} secondary disabled={clearing} onPress={() => {
      setClearing(true); setClearError(null);
      void signOut().catch(() => setClearError('Could not sign out. Please retry.')).finally(() => setClearing(false));
    }} />
  </JournalScreen>;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
    <Stack.Protected guard={Boolean(session)}><Stack.Screen name="(tabs)" /><Stack.Screen name="moment/[id]" /></Stack.Protected>
    <Stack.Protected guard={!session}><Stack.Screen name="sign-in" /></Stack.Protected>
  </Stack>;
}
