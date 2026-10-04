/** SecureStore has platform size limits. Store ASCII chunks and commit the manifest last. */
type Store = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};
type Manifest = { revision: string; count: number };
let sequence = 0;

function manifest(raw: string | null): Manifest | null {
  if (raw === null) return null;
  const value = JSON.parse(raw) as Manifest;
  if (!value || !/^\d+-\d+$/.test(value.revision) || !Number.isInteger(value.count)
    || value.count < 1 || value.count > 128) throw new Error('Invalid saved session.');
  return value;
}

export function createSecureSessionStorage(store: Store) {
  const chunkKey = (key: string, m: Manifest, index: number) => `${key}.${m.revision}.${index}`;
  const cleanup = async (key: string, m: Manifest | null) => {
    if (m) await Promise.all(Array.from({ length: m.count }, (_, i) =>
      store.deleteItemAsync(chunkKey(key, m, i)).catch(() => undefined)));
  };
  return {
    async getItem(key: string) {
      const m = manifest(await store.getItemAsync(key));
      if (!m) return null;
      const chunks = await Promise.all(Array.from({ length: m.count }, (_, i) => store.getItemAsync(chunkKey(key, m, i))));
      if (chunks.some(chunk => chunk === null)) throw new Error('Saved session is incomplete.');
      return decodeURIComponent(chunks.join(''));
    },
    async setItem(key: string, value: string) {
      const old = manifest(await store.getItemAsync(key));
      const encoded = encodeURIComponent(value);
      const chunks = encoded.match(/.{1,1800}/g) || [''];
      if (chunks.length > 128) throw new Error('Session is too large to save securely.');
      const next = { revision: `${Date.now()}-${sequence++}`, count: chunks.length };
      try {
        for (const [i, chunk] of chunks.entries()) await store.setItemAsync(chunkKey(key, next, i), chunk);
        await store.setItemAsync(key, JSON.stringify(next));
      } catch (error) {
        await cleanup(key, next);
        throw error;
      }
      await cleanup(key, old);
    },
    async removeItem(key: string) {
      let old: Manifest | null = null;
      try { old = manifest(await store.getItemAsync(key)); } catch { /* Allow recovery from corrupt data. */ }
      await store.deleteItemAsync(key);
      await cleanup(key, old);
    },
  };
}
