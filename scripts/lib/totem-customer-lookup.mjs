import { hubConfig } from '../hub-auth.mjs';
import { normalizeDocDigits, fetchPessoaParceiroByCnpj } from '../hub-parceiro.mjs';

const PESSOA_SELECT =
    'id,nome,nome_fantasia,cpf_cnpj,cpf_cnpj_digits,email,telefone,clientes(id,nome,canal_cliente,ativo)';

function hubHeaders(config, extra = {}) {
    return {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        'Content-Type': 'application/json',
        ...extra,
    };
}

async function hubRest(config, path, options = {}) {
    if (!config.serviceKey) return null;
    const res = await fetch(`${config.url}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: hubHeaders(config, options.headers || {}),
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await res.text();
    let data = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }
    if (!res.ok) {
        const err = new Error(data?.message || data?.error || text || `Hub ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
}

function displayName(pessoa) {
    const clientes = Array.isArray(pessoa?.clientes) ? pessoa.clientes : pessoa?.clientes ? [pessoa.clientes] : [];
    const clienteNome = clientes.find((c) => c?.ativo !== false)?.nome;
    return String(clienteNome || pessoa?.nome_fantasia || pessoa?.nome || '').trim();
}

function maskDoc(digits) {
    const d = normalizeDocDigits(digits);
    if (d.length === 11) return `CPF •••.•••.•••-${d.slice(-2)}`;
    if (d.length === 14) return `CNPJ ••.•••.•••/${d.slice(8, 12)}-${d.slice(-2)}`;
    return '';
}

function maskPhone(digits) {
    const d = normalizeDocDigits(digits);
    if (d.length < 10) return '';
    return `Tel. (••) •••••-${d.slice(-4)}`;
}

function normalizeEmail(raw) {
    return String(raw || '').trim().toLowerCase();
}

function isValidEmail(raw) {
    const email = normalizeEmail(raw);
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function maskEmail(raw) {
    const email = normalizeEmail(raw);
    const at = email.indexOf('@');
    if (at <= 0) return '';
    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    const maskedLocal =
        local.length <= 1 ? '*' : `${local[0]}${'•'.repeat(Math.min(3, local.length - 1))}`;
    return `E-mail ${maskedLocal}@${domain}`;
}

function toPublicHit(pessoa, matchedBy) {
    const name = displayName(pessoa);
    if (!name) return null;
    const docDigits = normalizeDocDigits(pessoa.cpf_cnpj_digits || pessoa.cpf_cnpj);
    const phoneDigits = normalizeDocDigits(pessoa.telefone);
    const hint =
        matchedBy === 'email'
            ? maskEmail(pessoa.email)
            : matchedBy === 'phone'
              ? maskPhone(phoneDigits)
              : maskDoc(docDigits) || maskPhone(phoneDigits) || 'Cadastro Ligeirinho';
    return {
        name,
        phone: String(pessoa.telefone || '').trim(),
        email: String(pessoa.email || '').trim(),
        pessoaId: pessoa.id,
        hint,
        matchedBy,
    };
}

async function lookupByPhone(config, digits) {
    const local = digits.slice(-11);
    const rows = await hubRest(
        config,
        `pessoas?select=${PESSOA_SELECT}&telefone=ilike.*${encodeURIComponent(local)}*&limit=5`,
    );
    const list = Array.isArray(rows) ? rows : [];
    for (const pessoa of list) {
        const hit = toPublicHit(pessoa, 'phone');
        if (hit) return hit;
    }
    return null;
}

async function lookupByEmail(config, rawEmail) {
    const email = normalizeEmail(rawEmail);
    const rows = await hubRest(
        config,
        `pessoas?select=${PESSOA_SELECT}&email=ilike.${encodeURIComponent(email)}&limit=5`,
    );
    const list = Array.isArray(rows) ? rows : [];
    for (const pessoa of list) {
        if (normalizeEmail(pessoa.email) !== email) continue;
        const hit = toPublicHit(pessoa, 'email');
        if (hit) return hit;
    }
    return null;
}

async function lookupByDoc(config, digits) {
    const pessoa = await fetchPessoaParceiroByCnpj(config, digits);
    if (!pessoa) {
        const rows = await hubRest(
            config,
            `pessoas?select=${PESSOA_SELECT}&cpf_cnpj_digits=eq.${encodeURIComponent(digits)}&limit=1`,
        );
        const fallback = Array.isArray(rows) ? rows[0] : null;
        if (!fallback) return null;
        return toPublicHit(fallback, digits.length === 14 ? 'cnpj' : 'cpf');
    }
    return toPublicHit(pessoa, digits.length === 14 ? 'cnpj' : 'cpf');
}

export async function lookupTotemCustomer(env, rawQuery, { type } = {}) {
    const config = hubConfig(env);
    if (!config.serviceKey) {
        const err = new Error('Busca de cliente indisponível no momento.');
        err.status = 503;
        throw err;
    }

    const query = String(rawQuery || '').trim();
    const emailMode = type === 'email' || query.includes('@');

    if (emailMode) {
        if (!isValidEmail(query)) {
            const err = new Error('Informe um e-mail válido.');
            err.status = 400;
            throw err;
        }
        return lookupByEmail(config, query);
    }

    const digits = normalizeDocDigits(query);
    if (digits.length < 10) {
        const err = new Error('Informe telefone, CPF ou CNPJ válido.');
        err.status = 400;
        throw err;
    }

    if (digits.length === 11 || digits.length === 14) {
        const byDoc = await lookupByDoc(config, digits);
        if (byDoc) return byDoc;
    }

    if (digits.length >= 10) {
        const byPhone = await lookupByPhone(config, digits);
        if (byPhone) return byPhone;
    }

    return null;
}
