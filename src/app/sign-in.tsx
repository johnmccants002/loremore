import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { JournalScreen, Note } from '@/components/JournalScreen';
import { ActionButton } from '@/components/ActionButton';
import { theme } from '@/theme/tokens';

function messageFor(error: { code?: string }) {
  if (error.code === 'invalid_credentials') return 'That email and password didn’t match. Please try again.';
  if (error.code === 'email_not_confirmed') return 'Confirm your email first, then come back here to sign in.';
  if (error.code === 'weak_password') return 'Choose a stronger password and try again.';
  if (error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit') return 'Too many attempts. Please wait a little before trying again.';
  return 'We couldn’t complete that request. Check your connection and details, then try again.';
}

export default function SignInScreen() {
  const { configured } = useAuth();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    if (!supabase || submitting.current) return;
    setError(null); setNotice(null);
    const normalizedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) { setError('Enter a valid email address.'); return; }
    if (!password || (mode === 'sign-up' && password.length < 8)) { setError(mode === 'sign-up' ? 'Use at least 8 characters for your password.' : 'Enter your password.'); return; }
    if (mode === 'sign-up' && password !== confirmation) { setError('Your passwords don’t match.'); return; }
    submitting.current = true; setBusy(true);
    try {
      const result = mode === 'sign-in'
        ? await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
        : await supabase.auth.signUp({ email: normalizedEmail, password });
      if (result.error) { setError(messageFor(result.error)); return; }
      setPassword(''); setConfirmation('');
      if (!result.data.session) {
        setNotice('Check your email for a confirmation link. After confirming, return here and sign in. If you already have an account, try signing in.');
        setMode('sign-in');
      }
    } catch { setError('We couldn’t connect or save your session. Please try again.'); }
    finally { submitting.current = false; setBusy(false); }
  }

  if (!configured) return <JournalScreen eyebrow="Welcome" title="Your journal is almost ready." description="LoreMore needs its connection configured before you can sign in.">
    <Note title="Development setup">Add the public Supabase URL and publishable key to the local environment, then reload the app. See the README for the exact settings.</Note>
  </JournalScreen>;

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <JournalScreen eyebrow="A life worth remembering" title={mode === 'sign-in' ? 'Welcome back.' : 'Begin your story.'}
      description={mode === 'sign-in' ? 'Sign in to make room for the moments that matter.' : 'Create your account. Your journal starts with you.'}>
      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} editable={!busy}
          keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email"
          textContentType="emailAddress" placeholder="you@example.com" placeholderTextColor={theme.colors.muted} style={styles.input} />
        <Text style={styles.label}>Password</Text>
        <TextInput key={mode} accessibilityLabel="Password" value={password} onChangeText={setPassword} editable={!busy}
          secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          textContentType={mode === 'sign-in' ? 'password' : 'newPassword'} style={styles.input} onSubmitEditing={() => { if (mode === 'sign-in') void submit(); }} />
        {mode === 'sign-up' && <>
          <Text style={styles.hint}>At least 8 characters. A unique passphrase works well.</Text>
          <Text style={styles.label}>Confirm password</Text>
          <TextInput accessibilityLabel="Confirm password" value={confirmation} onChangeText={setConfirmation} editable={!busy}
            secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" style={styles.input} onSubmitEditing={() => void submit()} />
        </>}
        {error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
        {notice && <Text accessibilityLiveRegion="polite" style={styles.hint}>{notice}</Text>}
        <ActionButton title={busy ? 'One moment…' : mode === 'sign-in' ? 'Sign in' : 'Create account'} onPress={() => void submit()} disabled={busy} />
        <ActionButton title={mode === 'sign-in' ? 'Create an account' : 'I already have an account'} secondary disabled={busy} onPress={() => {
          setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setPassword(''); setConfirmation(''); setError(null); setNotice(null);
        }} />
      </View>
    </JournalScreen>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  form: { gap: theme.spacing.md },
  label: { fontSize: theme.typography.body, fontWeight: '600', color: theme.colors.ink },
  input: { minHeight: 54, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, padding: theme.spacing.md, backgroundColor: theme.colors.surface, color: theme.colors.ink, fontSize: theme.typography.body },
  hint: { color: theme.colors.muted, fontSize: theme.typography.body, lineHeight: 25 },
  error: { color: theme.colors.clay, fontSize: theme.typography.body, lineHeight: 25 },
});
