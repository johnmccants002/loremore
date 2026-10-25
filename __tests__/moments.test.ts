import { createMomentRepository, localDayBounds, type PhotoImport } from '../src/moments/repository';
import type { SupabaseClient } from '@supabase/supabase-js';

const photo: PhotoImport = { id: 'photo-id', userId: 'owner', capturedAt: '2026-10-04T01:00:00Z', bytes: new ArrayBuffer(4), width: 100, height: 100, sourceTimestamp: null };
function fixture() {
  const query: Record<string, jest.Mock> = {};
  for (const key of ['select', 'eq', 'is', 'gte', 'lt', 'order', 'range', 'delete']) query[key] = jest.fn(() => query);
  query.returns = jest.fn().mockResolvedValue({ data: [], error: null });
  const bucket = { upload: jest.fn().mockResolvedValue({ error: null }), remove: jest.fn().mockResolvedValue({ error: null }), createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'https://private.test/signed' }, error: null }) };
  const client = { functions: { invoke: jest.fn().mockResolvedValue({ error: null }) }, from: jest.fn(() => query), storage: { from: jest.fn(() => bucket) }, auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'owner' } }, error: null }) }, rpc: jest.fn().mockResolvedValue({ data: 'photo-id', error: null }) };
  return { client, bucket, query, repository: createMomentRepository(client as unknown as SupabaseClient) };
}
test('local day bounds use local calendar midnights, including DST dates', () => {
  for (const date of [new Date(2026, 2, 8, 15), new Date(2026, 10, 1, 15), new Date(2026, 11, 31, 15)]) {
    const { start, end } = localDayBounds(date);
    expect(new Date(start)).toEqual(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
    expect(new Date(end)).toEqual(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1));
  }
});
test('queries only owner’s unarchived local-day moments, ordered and paginated', async () => {
  const { repository, query } = fixture();
  query.returns!.mockResolvedValueOnce({ data: Array.from({ length: 100 }, (_, id) => ({ id })), error: null }).mockResolvedValueOnce({ data: [{ id: 100 }], error: null });
  expect(await repository.listDay('owner', new Date(2026, 9, 4, 12))).toHaveLength(101);
  expect(query.eq).toHaveBeenCalledWith('user_id', 'owner');
  expect(query.is).toHaveBeenCalledWith('archived_at', null);
  expect(query.order).toHaveBeenCalledWith('captured_at', { ascending: true });
  expect(query.order).toHaveBeenCalledWith('id', { ascending: true });
  expect(query.range).toHaveBeenLastCalledWith(100, 199);
  expect(query.gte).toHaveBeenCalledWith('captured_at', new Date(2026, 9, 4).toISOString());
  expect(query.lt).toHaveBeenCalledWith('captured_at', new Date(2026, 9, 5).toISOString());
});
test('failed upload never creates metadata', async () => {
  const { repository, bucket, client } = fixture();
  bucket.upload.mockResolvedValue({ error: new Error('offline') });
  await expect(repository.importPhoto(photo, jest.fn())).rejects.toThrow('offline');
  expect(client.rpc).not.toHaveBeenCalled();
});
test('lost save response can retry the same file and ID without deletion or overwrite', async () => {
  const { repository, bucket, client } = fixture();
  client.rpc.mockResolvedValueOnce({ error: new Error('response lost') });
  await expect(repository.importPhoto(photo, jest.fn())).rejects.toThrow();
  bucket.upload.mockResolvedValueOnce({ error: { statusCode: '409' } });
  await repository.importPhoto(photo, jest.fn());
  expect(client.rpc.mock.calls[0]).toEqual(client.rpc.mock.calls[1]);
  expect(bucket.upload).toHaveBeenLastCalledWith('owner/photo-id.jpg', photo.bytes, { contentType: 'image/jpeg', upsert: false });
  expect(bucket.remove).not.toHaveBeenCalled();
});
test('a switched account cannot resume another user’s photo', async () => {
  const { repository, client, bucket } = fixture();
  client.auth.getUser.mockResolvedValue({ data: { user: { id: 'someone-else' } }, error: null });
  await expect(repository.importPhoto(photo, jest.fn())).rejects.toThrow('same account');
  expect(bucket.upload).not.toHaveBeenCalled();
});

test('analysis is requested after a successful save and failure never loses the photo', async () => {
  const { repository, client, bucket } = fixture();
  client.functions.invoke.mockRejectedValue(new Error('AI unavailable'));
  await expect(repository.importPhoto(photo, jest.fn())).resolves.toBeUndefined();
  expect(client.functions.invoke).toHaveBeenCalledWith('analyze-moment', { body: { momentId: photo.id }, timeout: 8000 });
  expect(bucket.remove).not.toHaveBeenCalled();
});
test('an ambiguous save failure does not request analysis', async () => {
  const { repository, client } = fixture();
  client.rpc.mockResolvedValue({ error: new Error('offline') });
  await expect(repository.importPhoto(photo, jest.fn())).rejects.toThrow();
  expect(client.functions.invoke).not.toHaveBeenCalled();
});
