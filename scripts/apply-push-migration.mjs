#!/usr/bin/env node
/**
 * Aplica só a migração de Web Push no Supabase Parceiros.
 *
 *   set SUPABASE_DB_PASSWORD=...
 *   node scripts/apply-push-migration.mjs
 */
import { buildDbUrl, connectPg, PARCEIROS_REF, runSqlFile } from './apply-migration-utils.mjs';

const dbUrl = buildDbUrl(PARCEIROS_REF);
if (!dbUrl) {
    console.error('Defina SUPABASE_DB_PASSWORD (ou SUPABASE_DB_URL) do projeto Parceiros.');
    process.exit(1);
}

const client = await connectPg(dbUrl);
try {
    console.log('[parceiros] Aplicando push-schema-migration.sql…');
    await runSqlFile(client, 'push-schema-migration.sql');
    const check = await client.query(`
        select
          to_regclass('public.push_subscriptions') as push_subscriptions,
          exists(
            select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'orders'
              and column_name = 'last_notified_track_key'
          ) as has_last_notified
    `);
    console.log('[parceiros] OK', check.rows[0]);
} finally {
    await client.end();
}
