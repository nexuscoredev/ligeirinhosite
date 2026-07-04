import { hubConfig } from '../hub-auth.mjs';
import { normalizeDocDigits, fetchPessoaParceiroByCnpj } from '../hub-parceiro.mjs';
import { phoneLocalDigits, phonesMatch, phoneLookupSuffixes } from './phone-match.mjs';

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
    const totemCliente = clientes.find((c) => c?.canal_cliente === 'totem' && c?.ativo !== false);
    const clienteNome = totemCliente?.nome || clientes.find((c) => c?.ativo !== false)?.nome;
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

function docFromPessoa(pessoa) {
    const digits = normalizeDocDigits(pessoa.cpf_cnpj_digits || pessoa.cpf_cnpj);
    if (digits.length === 11) return { cpf: digits, cnpj: '' };
    if (digits.length === 14) return { cpf: '', cnpj: digits };
    return { cpf: '', cnpj: '' };
}

function pessoaRichnessScore(pessoa) {
    let score = 0;
    if (normalizeDocDigits(pessoa?.cpf_cnpj_digits || pessoa?.cpf_cnpj)) score += 20;
    if (String(pessoa?.telefone || '').trim()) score += 10;
    if (normalizeEmail(pessoa?.email)) score += 5;
    return score;
}

function mergePessoas(candidates) {
    const list = (candidates || []).filter(Boolean);
    if (!list.length) return null;
    const sorted = [...list].sort((a, b) => pessoaRichnessScore(b) - pessoaRichnessScore(a));
    const merged = { ...sorted[0] };
    const clientes = [];
    for (const pessoa of sorted) {
        const docDigits = normalizeDocDigits(pessoa.cpf_cnpj_digits || pessoa.cpf_cnpj);
        if (!normalizeDocDigits(merged.cpf_cnpj_digits || merged.cpf_cnpj) && docDigits) {
            merged.cpf_cnpj = pessoa.cpf_cnpj;
            merged.cpf_cnpj_digits = pessoa.cpf_cnpj_digits;
        }
        if (!String(merged.telefone || '').trim() && String(pessoa.telefone || '').trim()) {
            merged.telefone = pessoa.telefone;
        }
        if (!normalizeEmail(merged.email) && normalizeEmail(pessoa.email)) {
            merged.email = pessoa.email;
        }
        const rows = Array.isArray(pessoa.clientes) ? pessoa.clientes : pessoa.clientes ? [pessoa.clientes] : [];
        clientes.push(...rows);
    }
    if (clientes.length) merged.clientes = clientes;
    merged.id = sorted[0].id;
    return merged;
}

async function fetchRelatedPessoas(config, pessoa) {
    const email = normalizeEmail(pessoa?.email);
    const phoneLocal = phoneLocalDigits(pessoa?.telefone);
    const byId = new Map();

    const addRows = (rows) => {
        for (const row of Array.isArray(rows) ? rows : []) {
            if (row?.id) byId.set(row.id, row);
        }
    };

    if (pessoa?.id) {
        addRows(
            await hubRest(
                config,
                `pessoas?select=${PESSOA_SELECT}&id=eq.${encodeURIComponent(pessoa.id)}&limit=1`,
            ),
        );
    }
    if (email) {
        addRows(
            await hubRest(
                config,
                `pessoas?select=${PESSOA_SELECT}&email=ilike.${encodeURIComponent(email)}&limit=10`,
            ),
        );
    }
    if (phoneLocal) {
        try {
            addRows(
                await hubRest(
                    config,
                    `pessoas?select=${PESSOA_SELECT}&telefone_digits=eq.${encodeURIComponent(phoneLocal)}&limit=5`,
                ),
            );
        } catch {
            /* coluna telefone_digits pode não existir */
        }
        for (const suffix of phoneLookupSuffixes(phoneLocal)) {
            addRows(
                await hubRest(
                    config,
                    `pessoas?select=${PESSOA_SELECT}&telefone=ilike.*${encodeURIComponent(suffix)}*&limit=10`,
                ),
            );
        }
    }

    return [...byId.values()].filter((row) => {
        if (pessoa?.id && row.id === pessoa.id) return true;
        if (email && normalizeEmail(row.email) === email) return true;
        if (phoneLocal && phonesMatch(row.telefone, phoneLocal)) return true;
        return false;
    });
}

async function resolvePessoaHit(config, pessoa, matchedBy) {
    const related = await fetchRelatedPessoas(config, pessoa);
    const merged = mergePessoas(related.length ? related : [pessoa]);
    return toPublicHit(merged || pessoa, matchedBy);
}

function toPublicHit(pessoa, matchedBy) {
    const name = displayName(pessoa);
    if (!name) return null;
    const docDigits = normalizeDocDigits(pessoa.cpf_cnpj_digits || pessoa.cpf_cnpj);
    const phoneDigits = normalizeDocDigits(pessoa.telefone);
    const { cpf, cnpj } = docFromPessoa(pessoa);
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
        cpf,
        cnpj,
        hint,
        matchedBy,
    };
}

async function lookupByPhone(config, digits) {
    const local = phoneLocalDigits(digits);
    if (!local) return null;

    const seen = new Set();
    const exactKeys = [...new Set([local, local.slice(-10)])];
    for (const key of exactKeys) {
        let rows = null;
        try {
            rows = await hubRest(
                config,
                `pessoas?select=${PESSOA_SELECT}&telefone_digits=eq.${encodeURIComponent(key)}&limit=5`,
            );
        } catch {
            rows = null;
        }
        const exactList = Array.isArray(rows) ? rows : [];
        for (const pessoa of exactList) {
            if (!phonesMatch(pessoa.telefone, local)) continue;
            const hit = await resolvePessoaHit(config, pessoa, 'phone');
            if (hit) return hit;
        }
    }

    for (const suffix of phoneLookupSuffixes(digits)) {
        const rows = await hubRest(
            config,
            `pessoas?select=${PESSOA_SELECT}&telefone=ilike.*${encodeURIComponent(suffix)}*&limit=20`,
        );
        const list = Array.isArray(rows) ? rows : [];
        for (const pessoa of list) {
            if (seen.has(pessoa.id)) continue;
            if (!phonesMatch(pessoa.telefone, local)) continue;
            seen.add(pessoa.id);
            const hit = await resolvePessoaHit(config, pessoa, 'phone');
            if (hit) return hit;
        }
    }
    return null;
}

async function lookupByEmail(config, rawEmail) {
    const email = normalizeEmail(rawEmail);
    const rows = await hubRest(
        config,
        `pessoas?select=${PESSOA_SELECT}&email=ilike.${encodeURIComponent(email)}&limit=10`,
    );
    const list = (Array.isArray(rows) ? rows : []).filter(
        (pessoa) => normalizeEmail(pessoa.email) === email,
    );
    if (!list.length) return null;
    const merged = mergePessoas(list);
    return toPublicHit(merged, 'email');
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
        return resolvePessoaHit(config, fallback, digits.length === 14 ? 'cnpj' : 'cpf');
    }
    return resolvePessoaHit(config, pessoa, digits.length === 14 ? 'cnpj' : 'cpf');
}

function looksLikeMobilePhone(digits) {
    return digits.length === 11 && digits[2] === '9';
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

    if (digits.length === 11 && looksLikeMobilePhone(digits)) {
        const byPhone = await lookupByPhone(config, digits);
        if (byPhone) return byPhone;
        const byDoc = await lookupByDoc(config, digits);
        if (byDoc) return byDoc;
    } else if (digits.length === 11 || digits.length === 14) {
        const byDoc = await lookupByDoc(config, digits);
        if (byDoc) return byDoc;
    }

    if (digits.length >= 10) {
        const byPhone = await lookupByPhone(config, digits);
        if (byPhone) return byPhone;
    }

    return null;
}
