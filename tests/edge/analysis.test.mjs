import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeImage, validateAnalysis } from '../../supabase/functions/analyze-moment/analysis.ts';
import { createHandler } from '../../supabase/functions/analyze-moment/handler.ts';
const id = '11111111-1111-4111-8111-111111111111';
const analysis = { title: 'A quiet desk', summary: 'A notebook rests beside a cup.', likely_activity: 'Possibly writing', project_id: null, project_reason: null, confidence: 'low', uncertainty: 'The purpose and setting are unclear.', reflection_questions: ['What were you working on?'] };
const image = new Blob(['fixture'], { type: 'image/jpeg' });
function fixture(overrides = {}) {
  const calls = { finish: [], claim: 0, analyze: 0 }; const work = [];
  const backend = { authenticate: async () => 'owner', claim: async () => { calls.claim++; return { status: 'claimed', token: 'lease', path: 'owner/image.jpg' }; }, image: async () => image, projects: async () => [], finish: async (...args) => { calls.finish.push(args); }, ...overrides };
  const handler = createHandler({ configured: true, model: 'test-model', backend: () => backend, analyze: async () => { calls.analyze++; return analysis; }, waitUntil: promise => work.push(promise) });
  const request = body => new Request('https://local.test', { method: 'POST', headers: { Authorization: 'Bearer test-session' }, body: JSON.stringify(body ?? { momentId: id }) });
  return { handler, request, calls, work, backend };
}
test('no auth and invalid auth cannot claim or analyze a moment', async () => {
  const f = fixture({ authenticate: async () => null });
  assert.equal((await f.handler(new Request('https://local.test', { method: 'POST' }))).status, 401);
  assert.equal((await f.handler(f.request())).status, 401);
  assert.equal(f.calls.claim, 0);
});
test('owner/URL/model injection and malformed JSON never reach claims', async () => {
  const f = fixture();
  for (const body of [{ momentId: id, userId: 'victim' }, { url: 'http://private/' }, { momentId: 'bad' }]) assert.equal((await f.handler(f.request(body))).status, 400);
  assert.equal((await f.handler(new Request('https://local.test', { method: 'POST', headers: { Authorization: 'Bearer test-session' }, body: '{' }))).status, 400);
  assert.equal(f.calls.claim, 0);
});
test('foreign/unavailable moments, quotas, and duplicate claims do not call AI', async () => {
  for (const [status, expected] of [['not_found',404],['daily_limit',429],['attempt_limit',429],['pending',200],['complete',200]]) {
    const f = fixture({ claim: async () => ({ status }) });
    assert.equal((await f.handler(f.request())).status, expected);
    assert.equal(f.calls.analyze, 0);
  }
});
test('accepted work is scheduled and writes a bounded structured result for its lease', async () => {
  const f = fixture();
  assert.equal((await f.handler(f.request())).status, 202);
  await Promise.all(f.work);
  assert.equal(f.calls.finish.length, 1);
  const [momentId, user, token, context, success] = f.calls.finish[0];
  assert.deepEqual([momentId,user,token,success], [id,'owner','lease',true]);
  assert.equal(context.schema_version, 1);
  assert.equal(context.title, analysis.title);
});
test('background failures produce a sanitized retry state', async () => {
  const f = fixture({ image: async () => { throw new Error('secret fixture must never persist'); } });
  await f.handler(f.request()); await Promise.all(f.work);
  assert.deepEqual(f.calls.finish[0][3], { error_code: 'analysis_failed' });
  assert.equal(f.calls.finish[0][4], false);
});
test('CORS preflight does not need auth and unsupported methods are rejected', async () => {
  const f = fixture();
  assert.equal((await f.handler(new Request('https://local.test', { method: 'OPTIONS' }))).status, 204);
  assert.equal((await f.handler(new Request('https://local.test'))).status, 405);
});
test('Responses request contains image and strict schema, stores no response, and validates results', async () => {
  let sent;
  const result = await analyzeImage(image, [], { apiKey: 'test-only', model: 'configured-model', fetcher: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses'); sent = JSON.parse(options.body);
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(analysis) }] }] });
  } });
  assert.deepEqual(result, analysis);
  assert.equal(sent.store, false); assert.equal(sent.model, 'configured-model');
  assert.equal(sent.text.format.strict, true);
  assert(sent.input[0].content[1].image_url.startsWith('data:image/jpeg;base64,'));
  assert.throws(() => validateAnalysis({ ...analysis, project_id: 'foreign-project' }, []));
  assert.throws(() => validateAnalysis({ ...analysis, confidence: 'certain' }, []));
  assert.throws(() => validateAnalysis({ ...analysis, reflection_questions: Array(6).fill('x') }, []));
});
test('refused, incomplete, malformed, and HTTP-error outputs are rejected', async () => {
  const bodies = [{ status: 'incomplete', output: [] }, { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] }, { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'not json' }] }] }];
  for (const body of bodies) await assert.rejects(analyzeImage(image, [], { apiKey: 'test', model: 'test', fetcher: async () => Response.json(body) }));
  await assert.rejects(analyzeImage(image, [], { apiKey: 'test', model: 'test', fetcher: async () => new Response('error', { status: 429 }) }));
  await assert.rejects(analyzeImage(new Blob(['text'], { type: 'text/plain' }), [], { apiKey: 'test', model: 'test' }));
});

test('missing server configuration fails without claiming or charging an attempt', async () => {
  const f = fixture();
  const handler = createHandler({ configured: false, model: '', backend: () => f.backend, analyze: async () => { throw new Error('must not run'); }, waitUntil: () => {} });
  assert.equal((await handler(f.request())).status, 503);
  assert.equal(f.calls.claim, 0);
});
