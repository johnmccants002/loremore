import type { SupabaseClient } from '@supabase/supabase-js';

export type MomentMedia = { id: string; object_path: string; mime_type: string; width: number | null; height: number | null };
export type Moment = {
  id: string; captured_at: string; title: string | null; note: string | null;
  kind: 'photo' | 'note' | 'voice';
  source: 'manual_import' | 'share_extension' | 'text_note' | 'voice_memo';
  analysis_status: 'not_requested' | 'pending' | 'complete' | 'failed';
  moment_media: MomentMedia[];
};
export type PhotoImport = {
  id: string; userId: string; capturedAt: string; bytes: ArrayBuffer;
  source?: 'manual_import' | 'share_extension';
  width: number; height: number; sourceTimestamp: string | null;
};
export type ImportStage = 'Preparing photo…' | 'Uploading photo…' | 'Saving moment…';

export function localDayBounds(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // Calendar arithmetic handles daylight-saving days of 23 or 25 hours.
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function createMomentRepository(client: SupabaseClient) {
  return {
    async listDay(userId: string, date: Date): Promise<Moment[]> {
      const { start, end } = localDayBounds(date);
      const moments: Moment[] = [];
      // Page through the API limit without silently truncating busy days.
      for (let offset = 0; ; offset += 100) {
        const { data, error } = await client.from('moments')
          .select('id,captured_at,title,note,kind,source,analysis_status,moment_media(id,object_path,mime_type,width,height)')
          .eq('user_id', userId).is('archived_at', null).gte('captured_at', start).lt('captured_at', end)
          .order('captured_at', { ascending: true }).order('id', { ascending: true })
          .range(offset, offset + 99).returns<Moment[]>();
        if (error) throw error;
        moments.push(...(data ?? []));
        if (!data || data.length < 100) return moments;
      }
    },
    async imageUrl(path: string): Promise<string> {
      const { data, error } = await client.storage.from('moments').createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
    async importPhoto(photo: PhotoImport, onStage: (stage: ImportStage) => void): Promise<void> {
      const { data, error } = await client.auth.getUser();
      if (error || data.user?.id !== photo.userId) throw new Error('Sign in to the same account to finish this import.');
      onStage('Uploading photo…');
      const path = `${photo.userId}/${photo.id}.jpg`;
      // Never overwrite: a retry can safely reuse an already-uploaded object.
      const upload = await client.storage.from('moments').upload(path, photo.bytes, { contentType: 'image/jpeg', upsert: false });
      if (upload.error && !('statusCode' in upload.error && String(upload.error.statusCode) === '409')) throw upload.error;
      onStage('Saving moment…');
      const saved = await client.rpc(photo.source === 'share_extension' ? 'save_shared_photo' : 'save_photo_import', {
        p_id: photo.id, p_captured_at: photo.capturedAt, p_size_bytes: photo.bytes.byteLength,
        p_width: photo.width, p_height: photo.height, p_source_timestamp: photo.sourceTimestamp,
      });
      // Do not delete on an ambiguous failure: the server may have committed.
      // Retry uses this same ID and the transaction is idempotent.
      if (saved.error) throw saved.error;
    },
    async removeImport(photo: PhotoImport): Promise<void> {
      const { data, error } = await client.auth.getUser();
      if (error || data.user?.id !== photo.userId) throw new Error('Sign in to the same account to remove this import.');
      const deleted = await client.from('moments').delete().eq('user_id', photo.userId).eq('id', photo.id);
      if (deleted.error) throw deleted.error;
      const removed = await client.storage.from('moments').remove([`${photo.userId}/${photo.id}.jpg`]);
      if (removed.error) throw removed.error;
    },
  };
}
export type MomentRepository = ReturnType<typeof createMomentRepository>;
