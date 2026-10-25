import type { Analysis, Project } from './analysis.ts';
export type Claim = { status: 'claimed' | 'pending' | 'complete' | 'not_found' | 'daily_limit' | 'attempt_limit'; token?: string; path?: string };
export type Backend = {
  authenticate(): Promise<string | null>;
  claim(id: string, userId: string): Promise<Claim>;
  image(path: string): Promise<Blob>;
  projects(userId: string): Promise<Project[]>;
  finish(id: string, userId: string, token: string, context: Record<string, unknown>, success: boolean): Promise<void>;
};
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' };
const reply = (status: number, data: object) => Response.json(data, { status, headers: cors });
export function createHandler(options: {
  configured: boolean; model: string; backend: (token: string) => Backend;
  analyze: (image: Blob, projects: Project[]) => Promise<Analysis>; waitUntil: (work: Promise<void>) => void;
}) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
    const match = request.headers.get('Authorization')?.match(/^Bearer ([^\s]+)$/i);
    if (!match?.[1]) return reply(401, { error: 'unauthorized' });
    try {
      const backend = options.backend(match[1]);
      const userId = await backend.authenticate();
      if (!userId) return reply(401, { error: 'unauthorized' });
      if (!options.configured) return reply(503, { error: 'analysis_not_configured' });
      // The body only accepts a moment ID, never an owner, URL, prompt, or model.
      const raw = await request.text();
      if (raw.length > 256) return reply(400, { error: 'invalid_request' });
      let body: unknown;
      try { body = JSON.parse(raw); } catch { return reply(400, { error: 'invalid_request' }); }
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 ||
        !('momentId' in body) || typeof body.momentId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.momentId)) return reply(400, { error: 'invalid_request' });
      const id = body.momentId;
      const claim = await backend.claim(id, userId);
      if (claim.status === 'not_found') return reply(404, { error: 'moment_not_found' });
      if (claim.status === 'daily_limit' || claim.status === 'attempt_limit') return reply(429, { error: claim.status });
      if (claim.status !== 'claimed') return reply(200, { status: claim.status });
      const { token, path } = claim;
      if (!token || !path || !path.startsWith(`${userId}/`)) return reply(500, { error: 'analysis_unavailable' });
      const work = (async () => {
        try {
          const [image, projects] = await Promise.all([backend.image(path), backend.projects(userId)]);
          const analysis = await options.analyze(image, projects);
          await backend.finish(id, userId, token, { ...analysis, schema_version: 1, model: options.model, generated_at: new Date().toISOString() }, true);
        } catch {
          // Never persist/log provider errors, raw images, signed URLs, or keys.
          try { await backend.finish(id, userId, token, { error_code: 'analysis_failed' }, false); } catch { /* An expired lease can be retried. */ }
        }
      })();
      options.waitUntil(work);
      return reply(202, { status: 'pending' });
    } catch { return reply(503, { error: 'analysis_unavailable' }); }
  };
}
