/** Reject accidental privileged-key configuration before constructing a client. */
export function isPublicSupabaseConfiguration(url: string, key: string): boolean {
  try {
    const parsed = new URL(url);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) return false;
    if (parsed.username || parsed.password) return false;
    if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
    // Legacy anon JWTs are public; role inspection is a configuration guard,
    // not signature verification or a substitute for server authorization.
    const payload = key.split('.')[1];
    if (!payload || key.split('.').length !== 3) return false;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as { role?: string };
    return claims.role === 'anon';
  } catch { return false; }
}
