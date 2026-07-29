/**
 * Cria TotemLGShopping no Hub, vinculado à distribuidora Ligeirinho Shopping.
 * NÃO altera usuários/distribuidoras da Ligeirinho convencional.
 *
 * Uso (a partir de ligeirinhosite):
 *   node scripts/create-totem-lgshopping.mjs
 */
import { execSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { resolveHubLogin } from './hub-auth.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SUPABASE_URL = 'https://liszpwocwvkytzyaxvit.supabase.co';
const LOGIN = 'TotemLGShopping';
const PASSWORD = 'admin123';
const NOME = 'Ligeirinho Shopping Totem';
const CARGO = 'Caixa';
const DISTRIBUIDORA_NOME = 'Ligeirinho Shopping';

function loadServiceKey() {
    const fromEnv = String(process.env.HUB_SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (fromEnv.startsWith('eyJ') && fromEnv.split('.').length === 3 && !fromEnv.includes('SENSITIVE')) {
        return fromEnv;
    }
    const hubDir = resolve(__dirname, '../../ligeirinhohub');
    const out = execSync(
        'npx supabase projects api-keys --project-ref liszpwocwvkytzyaxvit',
        {
            cwd: hubDir,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        },
    );
    const match = out.match(/service_role\s+\|\s+(eyJ[A-Za-z0-9._-]+)/);
    if (!match) throw new Error('Não foi possível obter service_role do Hub via CLI.');
    return match[1];
}

const SERVICE_KEY = loadServiceKey();

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

async function hubGet(path) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: adminHeaders() });
    const text = await res.text();
    if (!res.ok) throw new Error(`${path} ${res.status}: ${text}`);
    return text ? JSON.parse(text) : null;
}

async function findDistribuidoraShopping() {
    const rows = await hubGet(
        `distribuidoras?select=id,nome,slug,ativo&nome=ilike.${encodeURIComponent(DISTRIBUIDORA_NOME)}&limit=5`,
    );
    const exact = (rows || []).find(
        (d) => String(d.nome || '').trim().toLowerCase() === DISTRIBUIDORA_NOME.toLowerCase(),
    );
    if (exact) return exact;
    if (rows?.length === 1) return rows[0];
    const bySlug = await hubGet(
        `distribuidoras?select=id,nome,slug,ativo&slug=ilike.*shopping*&ativo=eq.true&limit=5`,
    );
    if (bySlug?.length === 1) return bySlug[0];
    throw new Error(
        `Distribuidora "${DISTRIBUIDORA_NOME}" não encontrada. Achados: ${JSON.stringify(rows || bySlug || [])}`,
    );
}

async function findTotemPadrao() {
    const rows = await hubGet(
        `usuarios?select=id,login,email,nome,cargo,ativo,admin_totem,conta_dispositivo,distribuidora_id,paginas_permitidas&login=ilike.Totem&limit=5`,
    );
    const exact = (rows || []).find((u) => String(u.login || '').toLowerCase() === 'totem');
    return exact || rows?.[0] || null;
}

async function findAuthUserByEmail() {
    const res = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(EMAIL)}`,
        { headers: adminHeaders() },
    );
    const data = await res.json();
    return data.users?.[0] || null;
}

async function findUsuarioByLogin() {
    const rows = await hubGet(
        `usuarios?select=id,login,email,nome,cargo,ativo,admin_totem,conta_dispositivo,distribuidora_id,paginas_permitidas&login=ilike.${encodeURIComponent(LOGIN)}&limit=1`,
    );
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

async function upsertUsuario(authUserId, { cargo, distribuidoraId, contaDispositivo }) {
    const row = {
        id: authUserId,
        email: EMAIL,
        login: LOGIN,
        nome: NOME,
        cargo: cargo || CARGO,
        ativo: true,
        paginas_permitidas: null,
        conta_dispositivo: contaDispositivo !== false,
        distribuidora_id: distribuidoraId,
        admin_totem: false,
        pessoa_id: null,
    };

    const existing = await hubGet(
        `usuarios?select=id,login,cargo,distribuidora_id&id=eq.${encodeURIComponent(authUserId)}&limit=1`,
    );

    if (Array.isArray(existing) && existing.length) {
        const patch = {
            email: row.email,
            login: row.login,
            nome: row.nome,
            cargo: row.cargo,
            ativo: row.ativo,
            conta_dispositivo: row.conta_dispositivo,
            distribuidora_id: row.distribuidora_id,
            paginas_permitidas: null,
            pessoa_id: null,
        };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(authUserId)}`, {
            method: 'PATCH',
            headers: adminHeaders({ Prefer: 'return=representation' }),
            body: JSON.stringify(patch),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || JSON.stringify(data));
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

async function atribuirDistribuidora(usuarioId, distribuidoraId) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rpc_atribuir_distribuidora_usuario`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({
            p_usuario_id: usuarioId,
            p_distribuidora_id: distribuidoraId,
        }),
    });
    const text = await res.text();
    if (!res.ok) {
        // Fallback direto se RPC exigir permissão de Desenvolvedor
        console.warn('RPC atribuir falhou, usando PATCH direto:', text.slice(0, 200));
        const patch = await fetch(
            `${SUPABASE_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(usuarioId)}`,
            {
                method: 'PATCH',
                headers: adminHeaders({ Prefer: 'return=representation' }),
                body: JSON.stringify({ distribuidora_id: distribuidoraId }),
            },
        );
        const data = await patch.json();
        if (!patch.ok) throw new Error(data.message || text || 'Falha ao vincular distribuidora');
        return Array.isArray(data) ? data[0] : data;
    }
    return text ? JSON.parse(text) : null;
}

async function main() {
    console.log('Inspecionando Hub (somente leitura de referência)...');
    const shopping = await findDistribuidoraShopping();
    console.log('Distribuidora alvo:', shopping);

    const totemPadrao = await findTotemPadrao();
    console.log('Totem padrão (referência, NÃO será alterado):', totemPadrao
        ? {
              id: totemPadrao.id,
              login: totemPadrao.login,
              cargo: totemPadrao.cargo,
              conta_dispositivo: totemPadrao.conta_dispositivo,
              distribuidora_id: totemPadrao.distribuidora_id,
              admin_totem: totemPadrao.admin_totem,
          }
        : null);

    const cargo = totemPadrao?.cargo || CARGO;
    const contaDispositivo = totemPadrao?.conta_dispositivo !== false;

    console.log(`\nCriando/atualizando apenas ${LOGIN} → ${shopping.nome} (${shopping.id})`);

    const authExisting = await findAuthUserByEmail();
    const usuarioExisting = await findUsuarioByLogin();

    if (
        usuarioExisting &&
        usuarioExisting.login?.toLowerCase() === LOGIN.toLowerCase() &&
        authExisting &&
        usuarioExisting.id !== authExisting.id
    ) {
        throw new Error('Conflito: login já vinculado a outro usuário auth.');
    }

    // Segurança: nunca tocar no Totem padrão
    if (totemPadrao && (authExisting?.id === totemPadrao.id || usuarioExisting?.id === totemPadrao.id)) {
        throw new Error('Abortado: operação colidiria com o Totem padrão.');
    }

    const authUser = await upsertAuthUser(authExisting?.id || usuarioExisting?.id);
    const authId = authUser.id || authUser.user?.id || authExisting?.id || usuarioExisting?.id;
    if (!authId) throw new Error('ID do usuário auth não retornado.');

    let usuario = await upsertUsuario(authId, {
        cargo,
        distribuidoraId: shopping.id,
        contaDispositivo,
    });

    await atribuirDistribuidora(authId, shopping.id);

    usuario = await findUsuarioByLogin();

    console.log('\nPerfil criado/atualizado:', {
        id: usuario.id,
        login: usuario.login,
        email: usuario.email,
        nome: usuario.nome,
        cargo: usuario.cargo,
        ativo: usuario.ativo,
        conta_dispositivo: usuario.conta_dispositivo,
        admin_totem: usuario.admin_totem,
        distribuidora_id: usuario.distribuidora_id,
    });

    if (usuario.distribuidora_id !== shopping.id) {
        throw new Error('Usuário criado, mas distribuidora_id não ficou em Ligeirinho Shopping.');
    }

    const hub = {
        url: SUPABASE_URL,
        anonKey:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpc3pwd29jd3ZreXR6eWF4dml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjczNzUsImV4cCI6MjA5NTMwMzM3NX0.rMfpheVgAKQ4HelKB0ZoNDZXiU_3XQdv7ujLHxgdjEA',
        serviceKey: SERVICE_KEY,
    };

    const test = await resolveHubLogin(hub, LOGIN, PASSWORD);
    if (test.error) throw new Error(`Teste de login falhou: ${test.error}`);

    console.log('\nLogin test OK.');
    console.log(`Role resolvida: ${test.profile?.role}`);
    console.log(`Login: ${LOGIN}`);
    console.log(`Senha: ${PASSWORD}`);
    console.log('Totem padrão e demais usuários: intactos.');
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});
