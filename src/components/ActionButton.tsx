import { Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '@/theme/tokens';

export function ActionButton({ title, onPress, disabled = false, secondary = false }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, (pressed || disabled) && styles.dim]}>
    <Text style={[styles.label, secondary && styles.secondaryLabel]}>{title}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { minHeight: 52, borderRadius: theme.radius.sm, backgroundColor: theme.colors.accent, padding: theme.spacing.md, justifyContent: 'center', alignItems: 'center' },
  secondary: { backgroundColor: theme.colors.accentSoft },
  label: { color: theme.colors.surface, fontSize: theme.typography.body, fontWeight: '600' },
  secondaryLabel: { color: theme.colors.accent },
  dim: { opacity: 0.6 },
});
