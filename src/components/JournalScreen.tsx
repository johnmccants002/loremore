import type { ComponentProps, PropsWithChildren } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/theme/tokens';

type Props = PropsWithChildren<{ eyebrow: string; title: string; description: string; refreshControl?: ComponentProps<typeof ScrollView>['refreshControl'] }>;
export function JournalScreen({ eyebrow, title, description, children, refreshControl }: Props) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView refreshControl={refreshControl} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <Text style={styles.brand}>LOREMORE <Text style={styles.brandNote}> / A life worth remembering</Text></Text>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function EmptyState({ icon, title, children }: PropsWithChildren<{
  icon: ComponentProps<typeof Ionicons>['name']; title: string;
}>) {
  return (
    <View style={styles.card}>
      <View style={styles.icon}><Ionicons name={icon} size={30} color={theme.colors.accent} accessible={false} /></View>
      <Text accessibilityRole="header" style={styles.heading}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

export function Note({ title, children }: PropsWithChildren<{ title: string }>) {
  return <View style={styles.note}><Text style={styles.noteTitle}>{title}</Text><Text style={styles.body}>{children}</Text></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flexGrow: 1, padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', gap: theme.spacing.md },
  brand: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: theme.colors.accent, marginBottom: theme.spacing.xl },
  brandNote: { fontWeight: '400', letterSpacing: 0, color: theme.colors.muted },
  eyebrow: { fontSize: theme.typography.caption, color: theme.colors.clay, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5 },
  title: { fontFamily: theme.typography.serif, fontSize: theme.typography.title, color: theme.colors.ink },
  description: { fontSize: theme.typography.body, lineHeight: 26, color: theme.colors.muted, marginBottom: theme.spacing.lg },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.xl, borderWidth: 1, borderColor: theme.colors.border, gap: theme.spacing.md },
  icon: { backgroundColor: theme.colors.accentSoft, width: 64, height: 64, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.sm },
  heading: { fontFamily: theme.typography.serif, fontSize: theme.typography.heading, color: theme.colors.ink },
  body: { fontSize: theme.typography.body, lineHeight: 26, color: theme.colors.muted },
  note: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  noteTitle: { fontSize: theme.typography.caption, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: theme.colors.accent },
});
