import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { theme } from '@/theme/tokens';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: theme.colors.accent,
      tabBarInactiveTintColor: theme.colors.muted,
      tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
      tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: ({ color, size }) => <Ionicons name="sunny-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="story" options={{ title: 'Story', tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="projects" options={{ title: 'Projects', tabBarIcon: ({ color, size }) => <Ionicons name="layers-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} /> }} />
    </Tabs>
  );
}
