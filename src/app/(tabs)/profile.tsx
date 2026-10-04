import { useState } from 'react';
import { Text } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { JournalScreen, Note } from '@/components/JournalScreen';
import { ActionButton } from '@/components/ActionButton';
import { theme } from '@/theme/tokens';

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <JournalScreen eyebrow="Your corner" title="A journal that’s yours." description="Your account and a little room to make yourself at home.">
    <Note title="Signed in as">{session?.user.email ?? 'LoreMore member'}</Note>
    {error && <Text accessibilityRole="alert" style={{ color: theme.colors.clay }}>{error}</Text>}
    <ActionButton title={busy ? 'Signing out…' : 'Sign out'} disabled={busy} onPress={() => {
      setBusy(true); setError(null);
      void signOut().catch(() => setError('We couldn’t sign you out. Check your connection and try again.')).finally(() => setBusy(false));
    }} />
    <Note title="On this device">Signing out removes your saved session here. Your account stays available when you’re ready to return.</Note>
  </JournalScreen>;
}
