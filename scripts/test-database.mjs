// Run a rollback-only SQL suite in this project's disposable Supabase container.
// psql is used because CLI db query prepares a single statement, not a SQL script.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const result = spawnSync('docker', [
  'exec', '-i', 'supabase_db_loremore', 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1',
], { input: ['ownership.sql', 'analysis.sql'].map(name => readFileSync(new URL(`../supabase/tests/${name}`, import.meta.url), 'utf8')).join('\n'), stdio: ['pipe', 'inherit', 'inherit'] });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
