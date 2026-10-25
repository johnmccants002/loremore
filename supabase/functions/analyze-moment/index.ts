import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { analyzeImage } from './analysis.ts';
import { createHandler, type Backend, type Claim } from './handler.ts';

declare const EdgeRuntime: { waitUntil(work: Promise<void>): void };
const url = Deno.env.get('SUPABASE_URL') ?? '';
const publicKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const apiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
const model = Deno.env.get('OPENAI_VISION_MODEL') ?? '';
const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

function backend(token: string): Backend {
  const user = createClient(url, publicKey, { auth: authOptions, global: { headers: { Authorization: `Bearer ${token}` } } });
  const server = createClient(url, serverKey, { auth: authOptions });
  return {
    async authenticate() { const { data, error } = await user.auth.getUser(token); return error ? null : data.user?.id ?? null; },
    async claim(id, userId) {
      const { data, error } = await server.rpc('claim_moment_analysis', { p_moment_id: id, p_user_id: userId });
      if (error) throw error;
      return data as Claim;
    },
    async image(path) {
      const { data, error } = await user.storage.from('moments').download(path);
      if (error) throw error;
      return data;
    },
    async projects(userId) {
      const { data, error } = await user.from('projects').select('id,title').eq('user_id', userId).is('archived_at', null).order('updated_at', { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
    async finish(id, userId, token, context, success) {
      const { error } = await server.rpc('finish_moment_analysis', { p_moment_id: id, p_user_id: userId, p_token: token, p_context: context, p_success: success });
      if (error) throw error;
    },
  };
}
Deno.serve(createHandler({ configured: Boolean(apiKey && model && url && serverKey && publicKey), model, backend,
  analyze: (image, projects) => analyzeImage(image, projects, { apiKey, model }),
  waitUntil: work => EdgeRuntime.waitUntil(work),
}));
