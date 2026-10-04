import 'react-native-url-polyfill/auto';
import { createClient, processLock } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { environment, hasSupabaseConfiguration } from '@/config/environment';
import { createSecureSessionStorage } from '@/auth/secure-session-storage';

// There is exactly one client. Missing config leaves the app on a setup screen.
export const supabase = hasSupabaseConfiguration
  ? createClient(environment.supabaseUrl, environment.supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        ...(Platform.OS !== 'web' ? {
          storage: createSecureSessionStorage(SecureStore),
          lock: processLock,
        } : {}),
      },
    })
  : null;
