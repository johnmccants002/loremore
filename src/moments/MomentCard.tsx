import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { theme } from '@/theme/tokens';
import type { Moment, MomentRepository } from './repository';

const sources = { manual_import: 'Photo import', share_extension: 'Shared to LoreMore', text_note: 'Quick note', voice_memo: 'Voice memo' };
const statuses = { not_requested: 'Saved privately', pending: 'Adding context', complete: 'Context ready', failed: 'Context unavailable' };
export function MomentCard({ moment, repository, revision, showDetailLink = true }: { moment: Moment; repository: MomentRepository; revision: number; showDetailLink?: boolean }) {
  const media = moment.moment_media.find(item => item.mime_type.startsWith('image/'));
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setUrl(null); setFailed(false);
    if (media) void repository.imageUrl(media.object_path).then(value => { if (active) setUrl(value); }, () => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [media?.object_path, repository, revision, attempt]);
  const title = moment.title || (moment.kind === 'photo' ? 'A moment worth keeping' : moment.kind === 'voice' ? 'A thought, out loud' : 'A little note');
  return (
    <View style={styles.card}>
      <View style={styles.time}><Ionicons name={moment.kind === 'photo' ? 'image-outline' : moment.kind === 'voice' ? 'mic-outline' : 'document-text-outline'} size={18} color={theme.colors.accent} accessible={false} />
        <Text style={styles.caption}>{new Date(moment.captured_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {sources[moment.source]}</Text>
      </View>
      {media && <View style={styles.imageFrame}>
        {failed ? <Pressable accessibilityRole="button" accessibilityLabel="Retry photo preview" onPress={() => setAttempt(value => value + 1)} style={styles.placeholder}><Ionicons name="image-outline" size={30} color={theme.colors.muted} /><Text style={styles.caption}>Photo unavailable · Tap to retry</Text></Pressable>
          : url ? <Image source={{ uri: url }} accessibilityLabel={title} style={styles.image} resizeMode="cover" onError={() => setFailed(true)} />
          : <ActivityIndicator accessibilityLabel="Loading photo" color={theme.colors.accent} />}
      </View>}
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {moment.note && <Text style={styles.body}>{moment.note}</Text>}
      {showDetailLink && <Link href={{ pathname: '/moment/[id]', params: { id: moment.id } }} accessibilityLabel={`View moment: ${title}`} style={styles.link}>View moment →</Link>}
      <Text style={styles.status}>{statuses[moment.analysis_status]}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 24, padding: 20, gap: 14 },
  time: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  caption: { color: theme.colors.muted, fontSize: 13, flexShrink: 1 },
  imageFrame: { height: 260, backgroundColor: theme.colors.accentSoft, borderRadius: 16, overflow: 'hidden', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  title: { fontFamily: theme.typography.serif, fontSize: 25, color: theme.colors.ink },
  body: { fontSize: 17, lineHeight: 26, color: theme.colors.muted },
  link: { color: theme.colors.accent, fontSize: 16, paddingVertical: 10 },
  status: { color: theme.colors.accent, fontSize: 12, fontWeight: '600' },
});
