import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '@/components/ActionButton';
import { JournalScreen } from '@/components/JournalScreen';
import { theme } from '@/theme/tokens';
import { MomentCard } from './MomentCard';
import { readableContext } from './context';
import type { Moment, MomentRepository } from './repository';

export function MomentDetail({ id, userId, repository, goBack }: { id: string; userId: string; repository: MomentRepository; goBack: () => void }) {
  const [moment, setMoment] = useState<Moment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [revision, setRevision] = useState(0);
  const active = useRef(true);
  const refresh = useCallback(async () => {
    try {
      const value = await repository.getMoment(userId, id);
      if (active.current) { setMoment(value); setError(value ? null : 'This moment is unavailable.'); setRevision(old => old + 1); }
    } catch { if (active.current) setError('We couldn’t load this moment. Check your connection and retry.'); }
    finally { if (active.current) setLoading(false); }
  }, [repository, userId, id]);
  useEffect(() => { active.current = true; void refresh(); return () => { active.current = false; }; }, [refresh]);
  useEffect(() => {
    if (moment?.analysis_status !== 'pending') return;
    const timer = setInterval(() => {
      if (Date.now() - Date.parse(moment.ai_context?.started_at ?? '') < 120_000) void refresh();
      else clearInterval(timer);
    }, 5000);
    return () => clearInterval(timer);
  }, [moment?.analysis_status, moment?.ai_context?.started_at, refresh]);
  async function analyze() {
    if (requesting) return;
    setRequesting(true); setError(null);
    try { await repository.requestAnalysis(id); if (active.current) await refresh(); }
    catch { if (active.current) setError('AI context is unavailable right now. Your photo is safe. Try again later.'); }
    finally { if (active.current) setRequesting(false); }
  }
  const context = readableContext(moment?.ai_context);
  const attemptLimit = moment?.ai_context?.error_code === 'attempt_limit';
  const dailyLimit = moment?.ai_context?.error_code === 'daily_limit';
  return <JournalScreen eyebrow="A moment in your story" title="Look a little closer." description="What happened is only the beginning. What did it mean to you?">
    <ActionButton title="Back to Today" secondary onPress={goBack} />
    {loading && <ActivityIndicator accessibilityLabel="Loading moment" color={theme.colors.accent} />}
    {error && <Text accessibilityRole="alert" style={styles.body}>{error}</Text>}
    {!moment && !loading && <ActionButton title="Retry loading moment" onPress={() => void refresh()} />}
    {moment && <>
      <MomentCard moment={moment} repository={repository} revision={revision} showDetailLink={false} />
      {moment.kind === 'photo' && <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.heading}>AI-suggested context</Text>
        <Text style={styles.body}>A starting point for reflection, not a factual record. AI can misread a photo.</Text>
        {moment.analysis_status === 'complete' ? <>
          <Text style={styles.body}>{context.summary || 'No summary is available.'}</Text>
          {Boolean(context.activity) && <Text style={styles.body}>Possible activity: {context.activity}</Text>}
          <Text style={styles.label}>Confidence: {context.confidence}</Text>
          {Boolean(context.uncertainty) && <Text style={styles.body}>{context.uncertainty}</Text>}
          {Boolean(context.projectReason) && <Text style={styles.body}>Possible project connection: {context.projectReason} No project has been attached automatically.</Text>}
          {context.questions.map((question, index) => <Text key={index} style={styles.question}>{index + 1}. {question}</Text>)}
        </> : <>
          <Text accessibilityLiveRegion="polite" style={styles.body}>{moment.analysis_status === 'pending' ? 'Looking for context… If this takes more than two minutes, you can retry safely.' : attemptLimit ? 'This photo has reached its retry limit. Your photo is safe; contact support if you still need help.' : dailyLimit ? 'You’ve reached today’s analysis limit. Try again tomorrow; your photo is safe.' : moment.analysis_status === 'failed' ? 'We couldn’t add context this time. You can retry; your photo is unchanged.' : 'Context hasn’t been generated yet. OpenAI uses this photo to suggest a scene summary and reflection questions.'}</Text>
          <ActionButton title={requesting ? 'Requesting context…' : moment.analysis_status === 'not_requested' ? 'Generate AI context' : 'Retry AI context'} disabled={requesting || attemptLimit} onPress={() => void analyze()} />
        </>}
      </View>}
    </>}
  </JournalScreen>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: theme.colors.surface, borderRadius: 24, padding: 24, gap: 16, borderWidth: 1, borderColor: theme.colors.border },
  heading: { fontFamily: theme.typography.serif, fontSize: 25, color: theme.colors.ink },
  body: { color: theme.colors.muted, fontSize: 16, lineHeight: 25 },
  label: { color: theme.colors.accent, fontSize: 13, fontWeight: '700' },
  question: { color: theme.colors.ink, fontSize: 17, lineHeight: 26 },
});
