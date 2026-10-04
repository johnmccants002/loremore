import { isPublicSupabaseConfiguration as valid } from '../src/config/public-supabase';
const url = 'https://example.supabase.co';
const jwt = (role: string) => `header.${btoa(JSON.stringify({ role }))}.signature`;
test('allows a publishable key or legacy anon JWT', () => {
  expect(valid(url, 'sb_publishable_example')).toBe(true);
  expect(valid(url, jwt('anon'))).toBe(true);
});
test('rejects privileged credentials, malformed config, and non-local cleartext', () => {
  expect(valid(url, 'sb_secret_example')).toBe(false);
  expect(valid(url, jwt('service_role'))).toBe(false);
  expect(valid(url, 'invalid')).toBe(false);
  expect(valid('', '')).toBe(false);
  expect(valid('http://example.com', 'sb_publishable_example')).toBe(false);
  expect(valid('http://127.0.0.1:54321', jwt('anon'))).toBe(true);
});
