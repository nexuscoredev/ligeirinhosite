/**
 * Cria usuário Totem no Ligeirinho Hub.
 * Requer HUB_SUPABASE_SERVICE_ROLE_KEY (ex.: do .env.local do ligeirinhohub).
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolveHubLogin } from './hub-auth.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const LOGIN = (process.argv[2] || process.env.TOTEM_LOGIN || 'Totem').trim();
const PASSWORD = (process.argv[3] || process.env.TOTEM_PASSWORD || 'admin123').trim();
const NOME =
    process.env.TOTEM_NOME ||
    (LOGIN.toLowerCase() === 'totem' ? 'Ligeirinho Totem' : `Ligeirinho ${LOGIN}`);
const CARGO = process.env.TOTEM_CARGO || 'Caixa';
const ADMIN_TOTEM = process.env.TOTEM_ADMIN_TOTEM === '1' || process.env.TOTEM_ADMIN_TOTEM === 'true';

function loadHubServiceKey() {
    if (process.env.HUB_SUPABASE_SERVICE_ROLE_KEY) return process.env.HUB_SUPABASE_SERVICE_ROLE_KEY;
    const hubEnv = resolve(__dirname, '../../ligeirinhohub/.env.local');
    if (!existsSync(hubEnv)) return '';
    const text = readFileSync(hubEnv, 'utf8');
    const match = text.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m);
    return match?.[1]?.trim() || '';
}

const SUPABASE_URL = 'https://liszpwocwvkytzyaxvit.supabase.co';
const SERVICE_KEY = loadHubServiceKey();

if (!SERVICE_KEY) {
    console.error('HUB_SUPABASE_SERVICE_ROLE_KEY não encontrada.');
    process.exit(1);
}

function adminHeaders(extra = {}) {
    return {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        ...extra,
    };
}

function loginParaEmail(login) {
    const emailLocal = login
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
    return `${emailLocal}@hub.ligeirinho.com`;
}

const EMAIL = loginParaEmail(LOGIN);

async function findAuthUserByEmail() {
    const res = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(EMAIL)}`,
        { headers: adminHeaders() }
    );
    const data = await res.json();
    return data.users?.[0] || null;
}

async function findUsuarioByLogin() {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?select=id,login,email,cargo,ativo&login=ilike.${encodeURIComponent(LOGIN)}&limit=1`,
        { headers: adminHeaders() }
    );
    const rows = await res.json();
    return Array.isArray(rows) ? rows[0] : null;
}

async function upsertAuthUser(existingId) {
    if (existingId) {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existingId}`, {
            method: 'PUT',
            headers: adminHeaders(),
            body: JSON.stringify({
                email: EMAIL,
                password: PASSWORD,
                email_confirm: true,
                user_metadata: { nome: NOME, login: LOGIN },
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.msg || data.message || 'Falha ao atualizar auth user');
        return data;
    }

    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({
            email: EMAIL,
            password: PASSWORD,
            email_confirm: true,
            user_metadata: { nome: NOME, login: LOGIN },
        }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.msg || data.message || 'Falha ao criar auth user');
    return data;
}

async function upsertUsuario(authUserId) {
    const row = {
        id: authUserId,
        email: EMAIL,
        login: LOGIN,
        nome: NOME,
        cargo: CARGO,
        ativo: true,
        paginas_permitidas: null,
        ...(ADMIN_TOTEM ? { admin_totem: true } : {}),
    };

    const existing = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?select=id&id=eq.${encodeURIComponent(authUserId)}&limit=1`,
        { headers: adminHeaders() }
    ).then((r) => r.json());

    if (Array.isArray(existing) && existing.length) {
        const current = existing[0];
        const patch = {
            email: row.email,
            login: row.login,
            nome: row.nome,
            ativo: row.ativo,
        };
        if (ADMIN_TOTEM) patch.admin_totem = true;
        if (!current?.cargo) patch.cargo = row.cargo;
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(authUserId)}`,
            {
                method: 'PATCH',
                headers: adminHeaders({ Prefer: 'return=representation' }),
                body: JSON.stringify(patch),
            }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Falha ao atualizar usuarios');
        return Array.isArray(data) ? data[0] : data;
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios`, {
        method: 'POST',
        headers: adminHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify(row),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || JSON.stringify(data));
    return Array.isArray(data) ? data[0] : data;
}

async function main() {
    console.log(`Criando/atualizando usuário Hub: login=${LOGIN}, email=${EMAIL}`);

    const authExisting = await findAuthUserByEmail();
    const usuarioExisting = await findUsuarioByLogin();

    if (usuarioExisting && usuarioExisting.login?.toLowerCase() === LOGIN.toLowerCase() && authExisting && usuarioExisting.id !== authExisting.id) {
        throw new Error('Conflito: login Totem já vinculado a outro usuário.');
    }

    const authUser = await upsertAuthUser(authExisting?.id);
    const authId = authUser.id || authUser.user?.id || authExisting?.id;
    if (!authId) throw new Error('ID do usuário auth não retornado.');

    const usuario = await upsertUsuario(authId);
    console.log('Perfil Hub:', {
        id: usuario.id,
        login: usuario.login,
        cargo: usuario.cargo,
        ativo: usuario.ativo,
        admin_totem: usuario.admin_totem === true,
    });

    const hub = {
        url: SUPABASE_URL,
        anonKey:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpc3pwd29jd3ZreXR6eWF4dml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjczNzUsImV4cCI6MjA5NTMwMzM3NX0.rMfpheVgAKQ4HelKB0ZoNDZXiU_3XQdv7ujLHxgdjEA',
        serviceKey: SERVICE_KEY,
    };

    const test = await resolveHubLogin(hub, LOGIN, PASSWORD);
    if (test.error) throw new Error(`Teste de login falhou: ${test.error}`);

    console.log('Login test OK.');
    console.log('Use em https://ligeirinhoparceiros.vercel.app/');
    console.log(`  Usuário Hub: ${LOGIN}`);
    console.log(`  Senha: ${PASSWORD}`);
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});
