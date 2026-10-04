// Real Auth, Data API, and Storage integration checks against disposable LOCAL Supabase.
// No hosted URL is accepted. Test credentials exist only in memory and are never logged.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

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
