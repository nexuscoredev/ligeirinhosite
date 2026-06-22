/**
 * Aplica scripts/hub-parceiros-auth-migration.sql no Supabase Hub.
 *
 *   set HUB_SUPABASE_DB_PASSWORD=sua_senha_hub
 *   npm run migrate:hub-auth
 *
 * SQL manual: https://supabase.com/dashboard/project/liszpwocwvkytzyaxvit/sql/new
 */
import { buildDbUrl, connectPg, HUB_REF, runSqlFile } from './apply-migration-utils.mjs';

async function main() {
    const dbUrl = buildDbUrl(HUB_REF, {
        ...process.env,
        SUPABASE_DB_PASSWORD: process.env.HUB_SUPABASE_DB_PASSWORD || process.env.SUPABASE_DB_PASSWORD,
        SUPABASE_DB_URL: process.env.HUB_SUPABASE_DB_URL || process.env.SUPABASE_DB_URL,
    });

    if (!dbUrl) {
        console.error('Defina HUB_SUPABASE_DB_PASSWORD ou HUB_SUPABASE_DB_URL.');
        console.error(`SQL manual: https://supabase.com/dashboard/project/${HUB_REF}/sql/new`);
        process.exit(1);
    }

    const client = await connectPg(dbUrl);
    try {
        await runSqlFile(client, 'hub-parceiros-auth-migration.sql');
        const { rows } = await client.query(
            `select column_name from information_schema.columns
             where table_schema = 'public' and table_name = 'usuarios' and column_name = 'must_change_password'`
        );
        const fn = await client.query(
            `select proname from pg_proc join pg_namespace n on n.oid = pronamespace
             where n.nspname = 'public' and proname = 'resolve_login_email'`
        );
        console.log('Migração Hub (auth parceiros) aplicada.');
        console.log('must_change_password:', rows.length ? 'ok' : 'ausente');
        console.log('resolve_login_email:', fn.rows.length ? 'ok' : 'ausente');
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error('Falha na migração Hub:', err.message);
    process.exit(1);
});
