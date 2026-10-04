// Real Auth, Data API, and Storage integration checks against disposable LOCAL Supabase.
// No hosted URL is accepted. Test credentials exist only in memory and are never logged.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createMomentRepository } from '../src/moments/repository.ts';

const local = JSON.parse(execFileSync('npx', ['--no-install', 'supabase', 'status', '--output', 'json'], { encoding: 'utf8' }));
const url = local.API_URL;
assert(url && ['localhost', '127.0.0.1'].includes(new URL(url).hostname), 'Only local Supabase is allowed');
const publicKey = local.PUBLISHABLE_KEY || local.ANON_KEY;
const adminKey = local.SERVICE_ROLE_KEY || local.SECRET_KEY;
assert(publicKey && adminKey, 'Local Supabase status must provide test keys');
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, adminKey, options);
const anon = createClient(url, publicKey, options);
const users = [];
const objects = [];
const clients = [];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=', 'base64');
function success(result, label) { assert.equal(result.error, null, label); return result.data; }

try {
  for (const name of ['alice', 'bob']) {
    const email = `${name}-${randomUUID()}@loremore.test`;
    const password = randomUUID() + 'aA1!';
    const { user } = success(await admin.auth.admin.createUser({ email, password, email_confirm: true }), 'create local test user');
    assert(user); users.push(user.id);
    const client = createClient(url, publicKey, options);
    success(await client.auth.signInWithPassword({ email, password }), 'sign in local test user');
    clients.push(client);
  }
  const [alice, bob] = clients;
  const [aliceId, bobId] = users;
  const moment = success(await alice.from('moments').insert({ kind: 'photo', source: 'manual_import' }).select().single(), 'owner creates moment through API');
  assert.equal(moment.user_id, aliceId);
  assert.equal(success(await bob.from('moments').select().eq('id', moment.id), 'foreign rows hidden').length, 0);
  assert((await bob.from('moments').insert({ user_id: aliceId, kind: 'note', source: 'text_note' })).error, 'cannot insert foreign owner through API');
  assert((await anon.from('moments').select()).error, 'anonymous Data API denied');

  // Run the same import repository used by the app against real Auth/Storage/PostgREST.
  const repository = createMomentRepository(alice);
  const photoId = randomUUID();
  const photoPath = `${aliceId}/${photoId}.jpg`;
  objects.push({ bucket: 'moments', path: photoPath });
  const photo = { id: photoId, userId: aliceId, capturedAt: new Date().toISOString(),
    bytes: Uint8Array.from(png).buffer, width: 1, height: 1, sourceTimestamp: '2020:01:02 03:04:05' };
  await repository.importPhoto(photo, () => {});
  await repository.importPhoto(photo, () => {});
  const imported = (await repository.listDay(aliceId, new Date())).filter(row => row.id === photoId);
  assert.equal(imported.length, 1, 'retry creates one moment');
  assert.equal(imported[0].moment_media.length, 1, 'retry creates one media record');
  assert.equal(success(await alice.from('moment_media').select('source_timestamp').eq('id', photoId).single(), 'source metadata').source_timestamp, photo.sourceTimestamp);
  assert.equal((await fetch(await repository.imageUrl(photoPath))).status, 200, 'signed preview is readable');
  assert.equal((await createMomentRepository(bob).listDay(bobId, new Date())).length, 0, 'other account has no timeline entries');
  const args = { p_id: photoId, p_captured_at: photo.capturedAt, p_size_bytes: png.length, p_width: 1, p_height: 1 };
  assert((await bob.rpc('save_photo_import', args)).error, 'foreign import cannot be reused');
  assert((await anon.rpc('save_photo_import', args)).error, 'anonymous RPC denied');
  const invalidId = randomUUID();
  const invalidPath = `${aliceId}/${invalidId}.jpg`;
  objects.push({ bucket: 'moments', path: invalidPath });
  success(await alice.storage.from('moments').upload(invalidPath, png, { contentType: 'image/jpeg' }), 'upload rollback fixture');
  assert((await alice.rpc('save_photo_import', { ...args, p_id: invalidId, p_width: -1 })).error, 'invalid media rejected');
  assert.equal(success(await alice.from('moments').select('id').eq('id', invalidId), 'atomic rollback').length, 0, 'media failure rolls back moment');
  const shared = { ...photo, id: randomUUID(), source: 'share_extension' };
  objects.push({ bucket: 'moments', path: `${aliceId}/${shared.id}.jpg` });
  await repository.importPhoto(shared, () => {});
  await repository.importPhoto(shared, () => {});
  const sharedRows = (await repository.listDay(aliceId, new Date())).filter(row => row.id === shared.id);
  assert.equal(sharedRows.length, 1, 'durable share retry creates one moment');
  assert.equal(sharedRows[0].source, 'share_extension', 'shared source is preserved');
  assert.equal(sharedRows[0].moment_media.length, 1, 'durable share retry creates one media record');
  assert((await bob.rpc('save_shared_photo', { ...args, p_id: shared.id })).error, 'foreign shared import denied');
  assert((await anon.rpc('save_shared_photo', { ...args, p_id: shared.id })).error, 'anonymous shared import denied');
  assert((await alice.rpc('save_shared_photo', { ...args, p_id: invalidId, p_width: -1 })).error, 'shared invalid media rejected');
  assert.equal(success(await alice.from('moments').select('id').eq('id', invalidId), 'shared atomic rollback').length, 0);
  const claimArgs = { p_moment_id: photoId, p_user_id: aliceId };
  assert((await alice.rpc('claim_moment_analysis', claimArgs)).error, 'client cannot claim worker leases');
  assert.equal(success(await admin.rpc('claim_moment_analysis', { ...claimArgs, p_user_id: bobId }), 'wrong owner claim').status, 'not_found');
  const claims = await Promise.all([admin.rpc('claim_moment_analysis', claimArgs), admin.rpc('claim_moment_analysis', claimArgs)]);
  const states = claims.map(result => success(result, 'concurrent claim'));
  assert.deepEqual(states.map(result => result.status).sort(), ['claimed', 'pending'], 'one concurrent worker wins');
  const lease = states.find(result => result.status === 'claimed');
  const finishArgs = { ...claimArgs, p_token: lease.token, p_context: { title: 'A quiet moment', summary: 'An AI hypothesis' }, p_success: true };
  assert((await alice.rpc('finish_moment_analysis', finishArgs)).error, 'client cannot complete worker leases');
  assert.equal(success(await admin.rpc('finish_moment_analysis', { ...finishArgs, p_token: randomUUID() }), 'stale worker'), false);
  assert.equal(success(await admin.rpc('finish_moment_analysis', finishArgs), 'complete worker'), true);
  const analyzed = await repository.getMoment(aliceId, photoId);
  assert.equal(analyzed.analysis_status, 'complete');
  assert.equal(analyzed.ai_context.summary, 'An AI hypothesis');
  assert.equal(analyzed.title, 'A quiet moment');
  assert.equal(await createMomentRepository(bob).getMoment(bobId, photoId), null, 'foreign analysis detail hidden');
  await repository.removeImport(shared);
  await repository.removeImport(photo);
  assert.equal(success(await alice.from('moments').select('id').eq('id', photoId), 'removed import').length, 0);
  assert((await alice.storage.from('moments').download(photoPath)).error, 'removal also deletes binary');

  for (const bucket of ['moments', 'profile-media']) {
    const path = `${aliceId}/${randomUUID()}.png`;
    objects.push({ bucket, path });
    success(await alice.storage.from(bucket).upload(path, png, { contentType: 'image/png' }), 'owner uploads');
    success(await alice.storage.from(bucket).upload(path, png, { contentType: 'image/png', upsert: true }), 'owner upserts');
    success(await alice.storage.from(bucket).download(path), 'owner downloads');
    const ownSigned = success(await alice.storage.from(bucket).createSignedUrl(path, 30), 'owner creates signed URL');
    assert(ownSigned.signedUrl, 'signed URL returned');
    assert((await bob.storage.from(bucket).download(path)).error, 'foreign download denied');
    assert((await bob.storage.from(bucket).createSignedUrl(path, 30)).error, 'foreign signed URL denied');
    assert((await bob.storage.from(bucket).upload(path, png, { contentType: 'image/png', upsert: true })).error, 'foreign overwrite denied');
    const moved = `${bobId}/stolen-${randomUUID()}.png`;
    objects.push({ bucket, path: moved });
    assert((await alice.storage.from(bucket).move(path, moved)).error, 'moving into another owner prefix denied');
    // Some Storage delete APIs return success with an empty result for invisible objects.
    await bob.storage.from(bucket).remove([path]);
    success(await alice.storage.from(bucket).download(path), 'foreign delete must preserve original');
    const publicUrl = anon.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    assert((await fetch(publicUrl)).status >= 400, 'public object endpoint cannot serve private media');
    assert((await alice.storage.updateBucket(bucket, { public: true })).error, 'client cannot make bucket public');
    const forbidden = `${aliceId}/not-an-image-${randomUUID()}.txt`;
    objects.push({ bucket, path: forbidden });
    assert((await alice.storage.from(bucket).upload(forbidden, 'text', { contentType: 'text/plain' })).error, 'bucket MIME limits enforced');
    success(await alice.storage.from(bucket).remove([path]), 'owner removes object');
    assert((await alice.storage.from(bucket).download(path)).error, 'removed object is unavailable');
  }
  console.log('Local Auth, Data API, private Storage, upsert, MIME limits, and cross-user API checks passed.');
} finally {
  // Use Storage API first: deleting metadata alone would leave physical objects behind.
  let cleanupFailed = false;
  for (const { bucket, path } of objects) {
    if ((await admin.storage.from(bucket).remove([path])).error) cleanupFailed = true;
  }
  for (const id of users) {
    if ((await admin.auth.admin.deleteUser(id)).error) cleanupFailed = true;
  }
  assert(!cleanupFailed, 'Local test cleanup failed; reset the disposable local stack');
}
