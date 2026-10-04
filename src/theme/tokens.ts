import { Platform } from 'react-native';

export const theme = {
  colors: {
    background: '#F7F4ED', surface: '#FFFCF6', ink: '#252E28',
    muted: '#616A60', accent: '#315B47', accentSoft: '#E5EBDE',
    border: '#DDDCD0', clay: '#8B503C',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: { sm: 12, md: 20, lg: 28 },
  typography: {
    title: 40, heading: 25, body: 17, caption: 13,
    serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
  },
} as const;
