import { createSecureSessionStorage } from '../src/auth/secure-session-storage';

function setup() {
  const items = new Map<string, string>();
  const store = {
    getItemAsync: jest.fn(async (key: string) => items.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => { items.set(key, value); }),
    deleteItemAsync: jest.fn(async (key: string) => { items.delete(key); }),
  };
  return { items, store, storage: createSecureSessionStorage(store) };
}

test('round trips a large Unicode session without exceeding secure storage item limits', async () => {
  const { storage, items } = setup();
  const value = JSON.stringify({ token: 'x'.repeat(6000), name: '🌲記憶'.repeat(500) });
  await storage.setItem('session', value);
  expect(await storage.getItem('session')).toBe(value);
  expect([...items.values()].every(item => new TextEncoder().encode(item).length <= 1800)).toBe(true);
  await storage.removeItem('session');
  expect(items.size).toBe(0);
  expect(await storage.getItem('session')).toBeNull();
});

test('failed write preserves the previous complete session', async () => {
  const { storage, store } = setup();
  await storage.setItem('session', 'previous');
  store.setItemAsync.mockImplementationOnce(async () => { throw new Error('Keychain unavailable'); });
  await expect(storage.setItem('session', 'replacement')).rejects.toThrow('Keychain unavailable');
  expect(await storage.getItem('session')).toBe('previous');
});

test('replacement and logout remove old chunks', async () => {
  const { storage, items } = setup();
  await storage.setItem('session', 'x'.repeat(7000));
  await storage.setItem('session', 'new');
  expect(items.size).toBe(2);
  await storage.removeItem('session');
  expect(items.size).toBe(0);
});

test('missing chunk fails closed; corrupt manifest can be removed', async () => {
  const { storage, items } = setup();
  await storage.setItem('session', 'value');
  const chunk = [...items.keys()].find(key => key !== 'session')!;
  items.delete(chunk);
  await expect(storage.getItem('session')).rejects.toThrow('incomplete');
  items.set('session', 'bad json');
  await storage.removeItem('session');
  expect(await storage.getItem('session')).toBeNull();
});

test('failed manifest commit discards replacement chunks and keeps the old session', async () => {
  const { storage, store, items } = setup();
  await storage.setItem('session', 'previous');
  const write = store.setItemAsync.getMockImplementation()!;
  store.setItemAsync.mockImplementation(async (key, value) => {
    if (key === 'session') throw new Error('Commit failed');
    await write(key, value);
  });
  await expect(storage.setItem('session', 'x'.repeat(6000))).rejects.toThrow('Commit failed');
  expect(await storage.getItem('session')).toBe('previous');
  expect(items.size).toBe(2);
});
