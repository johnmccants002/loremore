import { isPublicSupabaseConfiguration } from './public-supabase';

// Static dot notation is required for Expo to inline public values.
// Never read server credentials or spread process.env into client configuration.
export const environment = Object.freeze({
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '',
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
    || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || '',
});

export const hasSupabaseConfiguration = isPublicSupabaseConfiguration(
  environment.supabaseUrl, environment.supabaseKey,
);
