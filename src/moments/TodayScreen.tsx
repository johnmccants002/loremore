import { useSharedImports } from '@/sharing/SharedImportProvider';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '@/components/ActionButton';
import { EmptyState, JournalScreen } from '@/components/JournalScreen';
import { theme } from '@/theme/tokens';
import { MomentCard } from './MomentCard';
import { pickPhoto, preparePhoto } from './photo-picker';
import type { ImportStage, MomentRepository, PhotoImport } from './repository';
import { useTodayMoments } from './use-today-moments';

export function TodayScreen({ userId, repository }: { userId: string; repository: MomentRepository }) {
  const feed = useTodayMoments(repository, userId);
  const shared = useSharedImports();
  useEffect(() => { if (shared.revision > 0) void feed.refresh(); }, [shared.revision, feed.refresh]);
  const [stage, setStage] = useState<ImportStage | 'Choosing photo…' | 'Removing import…' | null>(null);
  const [pending, setPending] = useState<PhotoImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const updateStage = (value: ImportStage) => { if (mounted.current) setStage(value); };
  async function addPhoto() {
    if (busy.current) return;
    busy.current = true; setError(null); setNotice(null);
    try {
      let photo = pending;
      if (!photo) {
        setStage('Choosing photo…');
        const asset = await pickPhoto();
        if (!asset || !mounted.current) return;
        updateStage('Preparing photo…');
        photo = await preparePhoto(asset, userId);
        if (!mounted.current) return;
        setPending(photo);
      }
      await repository.importPhoto(photo, updateStage);
      if (mounted.current) {
        setPending(null); setNotice('Your photo is saved in your journal.');
        await feed.refresh();
      }
    } catch {
      if (mounted.current) setError('We couldn’t finish this photo. Check your connection and retry. If this image can’t be read, try a different photo.');
    } finally {
      busy.current = false;
      if (mounted.current) setStage(null);
    }
  }
  async function removeImport() {
    if (!pending || busy.current) return;
    busy.current = true; setStage('Removing import…'); setError(null);
    try {
      await repository.removeImport(pending);
      if (mounted.current) { setPending(null); setNotice('The unfinished import was removed.'); await feed.refresh(); }
    } catch {
      if (mounted.current) setError('We couldn’t remove the import. Reconnect and try removing it again.');
    } finally { busy.current = false; if (mounted.current) setStage(null); }
  }
  return (
    <JournalScreen eyebrow={new Date(feed.day).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
      title="A little more of today." description="The small moments. The passing thoughts. The things you’ll want to remember."
      refreshControl={<RefreshControl refreshing={feed.loading} onRefresh={() => void feed.refresh()} tintColor={theme.colors.accent} />}>
      {shared.syncing && shared.remaining > 0 && <Text accessibilityLiveRegion="polite" style={styles.body}>Syncing {shared.remaining} shared photo(s)…</Text>}
      {shared.error && <><Text accessibilityRole="alert" style={styles.error}>{shared.error}</Text><ActionButton title="Retry shared photos" secondary disabled={shared.syncing} onPress={shared.retry} /></>}
      <ActionButton title={pending ? 'Retry photo import' : 'Add a photo'} onPress={() => void addPhoto()} disabled={Boolean(stage)} />
      <Text style={styles.caption}>Add a photo to today’s journal. Only you can see it.</Text>
      {stage && <View accessibilityLiveRegion="polite" style={styles.progress}><ActivityIndicator color={theme.colors.accent} /><Text style={styles.body}>{stage}</Text></View>}
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {pending && !stage && <ActionButton title="Remove this import" secondary onPress={() => void removeImport()} />}
      {notice && <Text accessibilityLiveRegion="polite" style={styles.body}>{notice}</Text>}
      <View style={styles.heading}><Text accessibilityRole="header" style={styles.headingText}>Your day, in moments</Text><ActionButton title="Refresh" secondary disabled={feed.loading} onPress={() => void feed.refresh()} /></View>
      {feed.error && <Text accessibilityRole="alert" style={styles.error}>{feed.error}</Text>}
      {feed.loading && feed.moments.length === 0 && <ActivityIndicator accessibilityLabel="Loading today’s moments" color={theme.colors.accent} />}
      {!feed.loading && !feed.error && feed.moments.length === 0 && <EmptyState icon="sunny-outline" title="Your day starts here">Keep a photo from today, or bring an older memory into this page of your story.</EmptyState>}
      {feed.moments.map(moment => <MomentCard key={moment.id} moment={moment} repository={repository} revision={feed.revision} />)}
    </JournalScreen>
  );
}
const styles = StyleSheet.create({
  caption: { color: theme.colors.muted, fontSize: 13, lineHeight: 20 },
  body: { color: theme.colors.accent, fontSize: 15, lineHeight: 22 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  error: { color: theme.colors.clay, fontSize: 15, lineHeight: 22 },
  heading: { gap: 12, marginTop: 24 },
  headingText: { fontFamily: theme.typography.serif, fontSize: 25, color: theme.colors.ink },
});
