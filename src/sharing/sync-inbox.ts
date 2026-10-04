import type { NativeInbox, SharedPhoto } from './native-inbox';
import type { MomentRepository } from '@/moments/repository';

// One sync at a time is enforced by the provider. Check identity after every
// asynchronous boundary so a sign-out never resumes into a different account.
export async function syncInbox({ inbox, repository, userId, readBytes, stillCurrent, onProgress }: {
  inbox: NativeInbox; repository: MomentRepository; userId: string;
  readBytes: (item: SharedPhoto) => Promise<ArrayBuffer>; stillCurrent: () => boolean;
  onProgress: (remaining: number) => void;
}): Promise<number> {
  let saved = 0;
  const items = await inbox.list(userId);
  if (!stillCurrent()) return saved;
  onProgress(items.length);
  for (const item of items) {
    if (!stillCurrent()) return saved;
    if (item.userId !== userId) throw new Error('Shared photo belongs to another account.');
    const bytes = await readBytes(item);
    if (!stillCurrent()) return saved;
    if (bytes.byteLength !== item.sizeBytes) throw new Error('Shared photo is incomplete.');
    await repository.importPhoto({ ...item, bytes, sourceTimestamp: item.sourceTimestamp ?? null, source: 'share_extension' }, () => {});
    if (!stillCurrent()) return saved;
    // Only acknowledge a confirmed DB save; a crash/lost response retries the
    // same native UUID, including after relaunching the app.
    await inbox.acknowledge(userId, item.id);
    saved++;
    if (!stillCurrent()) return saved;
    onProgress(items.length - saved);
  }
  return saved;
}
