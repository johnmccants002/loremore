import { syncInbox } from '../src/sharing/sync-inbox';
import type { NativeInbox, SharedPhoto } from '../src/sharing/native-inbox';
import type { MomentRepository } from '../src/moments/repository';
const item: SharedPhoto = { id: 'durable-id', userId: 'alice', capturedAt: '2026-10-04T01:00:00Z', width: 2, height: 3, sizeBytes: 4, uri: 'file:///private/inbox/image.jpg' };
function fixture() {
  const inbox: jest.Mocked<NativeInbox> = { setOwner: jest.fn(), list: jest.fn().mockResolvedValue([item]), acknowledge: jest.fn().mockResolvedValue(undefined) };
  const repository: jest.Mocked<MomentRepository> = { importPhoto: jest.fn().mockResolvedValue(undefined), listDay: jest.fn(), imageUrl: jest.fn(), removeImport: jest.fn() };
  return { inbox, repository, userId: 'alice', readBytes: jest.fn().mockResolvedValue(new ArrayBuffer(4)), stillCurrent: jest.fn(() => true), onProgress: jest.fn() };
}
test('successful save uses the native ID and share source before acknowledging', async () => {
  const args = fixture();
  expect(await syncInbox(args)).toBe(1);
  expect(args.repository.importPhoto).toHaveBeenCalledWith(expect.objectContaining({ id: 'durable-id', userId: 'alice', source: 'share_extension', capturedAt: item.capturedAt }), expect.any(Function));
  expect(args.inbox.acknowledge).toHaveBeenCalledWith('alice', 'durable-id');
  expect(args.repository.importPhoto.mock.invocationCallOrder[0]).toBeLessThan(args.inbox.acknowledge.mock.invocationCallOrder[0]!);
});
test('failed upload retains the native item for retry', async () => {
  const args = fixture();
  args.repository.importPhoto.mockRejectedValueOnce(new Error('offline'));
  await expect(syncInbox(args)).rejects.toThrow('offline');
  expect(args.inbox.acknowledge).not.toHaveBeenCalled();
  await syncInbox(args);
  expect(args.repository.importPhoto.mock.calls[0]![0].id).toBe(args.repository.importPhoto.mock.calls[1]![0].id);
});
test('lost acknowledgement retries the same committed import', async () => {
  const args = fixture();
  args.inbox.acknowledge.mockRejectedValueOnce(new Error('disk unavailable'));
  await expect(syncInbox(args)).rejects.toThrow();
  await syncInbox(args);
  expect(args.repository.importPhoto.mock.calls[0]![0]).toEqual(args.repository.importPhoto.mock.calls[1]![0]);
});
test('account change during file read stops before uploading', async () => {
  const args = fixture();
  args.readBytes.mockImplementation(async () => { args.stillCurrent.mockReturnValue(false); return new ArrayBuffer(4); });
  expect(await syncInbox(args)).toBe(0);
  expect(args.repository.importPhoto).not.toHaveBeenCalled();
  expect(args.inbox.acknowledge).not.toHaveBeenCalled();
});
test('foreign or incomplete items never reach Supabase', async () => {
  const args = fixture();
  args.inbox.list.mockResolvedValueOnce([{ ...item, userId: 'bob' }]);
  await expect(syncInbox(args)).rejects.toThrow('another account');
  args.readBytes.mockResolvedValueOnce(new ArrayBuffer(1));
  await expect(syncInbox(args)).rejects.toThrow('incomplete');
  expect(args.repository.importPhoto).not.toHaveBeenCalled();
});
