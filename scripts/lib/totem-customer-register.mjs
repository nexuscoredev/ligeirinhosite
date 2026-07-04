import { hubConfig } from '../hub-auth.mjs';
import { normalizeDocDigits } from '../hub-parceiro.mjs';
import { formatCpf, isValidCpf } from './cpf.mjs';

const PESSOA_SELECT =
    'id,nome,nome_fantasia,cpf_cnpj,cpf_cnpj_digits,email,telefone,clientes(id,nome,canal_cliente,ativo)';

const CANAL_TOTEM = 'totem';

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

function normalizeEmail(raw) {
    return String(raw || '').trim().toLowerCase();
}

function isValidEmail(raw) {
    const email = normalizeEmail(raw);
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function displayName(pessoa) {
    const clientes = Array.isArray(pessoa?.clientes) ? pessoa.clientes : pessoa?.clientes ? [pessoa.clientes] : [];
    const clienteNome = clientes.find((c) => c?.ativo !== false)?.nome;
    return String(clienteNome || pessoa?.nome_fantasia || pessoa?.nome || '').trim();
}

function toPublicCustomer(pessoa) {
    const name = displayName(pessoa);
    if (!name) return null;
    const docDigits = normalizeDocDigits(pessoa.cpf_cnpj_digits || pessoa.cpf_cnpj);
    return {
        name,
        phone: String(pessoa.telefone || '').trim(),
        email: String(pessoa.email || '').trim(),
        pessoaId: pessoa.id,
        hint: docDigits.length === 11 ? `CPF •••.•••.•••-${docDigits.slice(-2)}` : '',
        matchedBy: 'register',
    };
}

async function fetchPessoaById(config, pessoaId) {
    const rows = await hubRest(
        config,
        `pessoas?select=${PESSOA_SELECT}&id=eq.${encodeURIComponent(pessoaId)}&limit=1`,
    );
    return Array.isArray(rows) ? rows[0] ?? null : null;
}

async function findPessoaByPhone(config, phoneLocal) {
    const rows = await hubRest(
        config,
        `pessoas?select=${PESSOA_SELECT}&telefone=ilike.*${encodeURIComponent(phoneLocal)}*&limit=5`,
    );
    const list = Array.isArray(rows) ? rows : [];
    for (const pessoa of list) {
        const digits = normalizeDocDigits(pessoa.telefone);
        if (digits.slice(-11) === phoneLocal || digits.slice(-10) === phoneLocal.slice(-10)) {
            return pessoa;
        }
    }
    return null;
}

async function findPessoaByEmail(config, email) {
    const rows = await hubRest(
        config,
        `pessoas?select=${PESSOA_SELECT}&email=ilike.${encodeURIComponent(email)}&limit=5`,
    );
    const list = Array.isArray(rows) ? rows : [];
    return list.find((pessoa) => normalizeEmail(pessoa.email) === email) || null;
}

async function findPessoaByCpf(config, cpfDigits) {
    const rows = await hubRest(
        config,
        `pessoas?select=${PESSOA_SELECT}&cpf_cnpj_digits=eq.${encodeURIComponent(cpfDigits)}&limit=1`,
    );
    return Array.isArray(rows) ? rows[0] ?? null : null;
}

async function syncClienteTotem(config, pessoa) {
    const existing = await hubRest(
        config,
        `clientes?select=id,canal_cliente&pessoa_id=eq.${encodeURIComponent(pessoa.id)}&limit=5`,
    );
    const list = Array.isArray(existing) ? existing : [];
    const totemCliente = list.find((c) => c?.canal_cliente === CANAL_TOTEM);
    const row = {
        pessoa_id: pessoa.id,
        nome: pessoa.nome,
        nome_fantasia: pessoa.nome_fantasia || pessoa.nome,
        tabela_preco: 'padrao',
        canal_cliente: CANAL_TOTEM,
        ativo: true,
        bloqueado_pedido: false,
        inadimplente: false,
    };

    if (totemCliente?.id) {
        await hubRest(config, `clientes?id=eq.${encodeURIComponent(totemCliente.id)}`, {
            method: 'PATCH',
            body: row,
        });
        return;
    }

    if (list[0]?.id) {
        await hubRest(config, `clientes?id=eq.${encodeURIComponent(list[0].id)}`, {
            method: 'PATCH',
            body: row,
        });
        return;
    }

    await hubRest(config, 'clientes', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: row,
    });
}

function buildPatch(existing, { nome, phoneLocal, emailNorm, cpfDigits, cpfValid }) {
    const patch = {};
    if (nome && nome !== existing.nome) patch.nome = nome;
    if (nome && !String(existing.nome_fantasia || '').trim()) patch.nome_fantasia = nome;
    if (phoneLocal && !normalizeDocDigits(existing.telefone)) patch.telefone = phoneLocal;
    if (emailNorm && !String(existing.email || '').trim()) patch.email = emailNorm;
    if (cpfValid && !normalizeDocDigits(existing.cpf_cnpj_digits || existing.cpf_cnpj)) {
        patch.cpf_cnpj = formatCpf(cpfDigits);
        patch.cpf_cnpj_digits = cpfDigits;
    }
    return patch;
}

/**
 * Cria ou atualiza cadastro de cliente varejo (totem) no Hub para reconhecimento no próximo pedido.
 */
export async function registerTotemCustomer(env, { name, phone, email, cpf, pessoaId } = {}) {
    const config = hubConfig(env);
    if (!config.serviceKey) {
        const err = new Error('Cadastro indisponível no momento.');
        err.status = 503;
        throw err;
    }

    const nome = String(name || '').trim().replace(/\s+/g, ' ');
    if (!nome) {
        const err = new Error('Informe o nome.');
        err.status = 400;
        throw err;
    }

    const phoneDigits = normalizeDocDigits(phone);
    const phoneLocal = phoneDigits.length >= 10 ? phoneDigits.slice(-11) : '';
    const cpfDigits = normalizeDocDigits(cpf);
    const cpfValid = cpfDigits.length === 11 && isValidCpf(cpfDigits);
    const emailNorm = normalizeEmail(email);

    if (!phoneLocal && !cpfValid && !emailNorm) {
        const err = new Error('Informe telefone, CPF ou e-mail para salvar o cadastro.');
        err.status = 400;
        throw err;
    }
    if (emailNorm && !isValidEmail(emailNorm)) {
        const err = new Error('E-mail inválido.');
        err.status = 400;
        throw err;
    }

    let pessoa = null;
    if (pessoaId) {
        pessoa = await fetchPessoaById(config, pessoaId);
    }
    if (!pessoa && cpfValid) {
        pessoa = await findPessoaByCpf(config, cpfDigits);
    }
    if (!pessoa && phoneLocal) {
        pessoa = await findPessoaByPhone(config, phoneLocal);
    }
    if (!pessoa && emailNorm) {
        pessoa = await findPessoaByEmail(config, emailNorm);
    }

    if (pessoa?.id) {
        const patch = buildPatch(pessoa, { nome, phoneLocal, emailNorm, cpfDigits, cpfValid });
        if (Object.keys(patch).length) {
            const rows = await hubRest(config, `pessoas?id=eq.${encodeURIComponent(pessoa.id)}`, {
                method: 'PATCH',
                headers: { Prefer: 'return=representation' },
                body: patch,
            });
            pessoa = Array.isArray(rows) ? rows[0] ?? { ...pessoa, ...patch } : { ...pessoa, ...patch };
        }
    } else {
        const rows = await hubRest(config, 'pessoas', {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: {
                tipos: ['cliente'],
                nome,
                nome_fantasia: nome,
                telefone: phoneLocal || null,
                email: emailNorm || null,
                cpf_cnpj: cpfValid ? formatCpf(cpfDigits) : null,
                cpf_cnpj_digits: cpfValid ? cpfDigits : null,
                canal_cliente: CANAL_TOTEM,
                tabela_preco: 'padrao',
                ativo: true,
            },
        });
        pessoa = Array.isArray(rows) ? rows[0] : rows;
    }

    if (!pessoa?.id) {
        const err = new Error('Não foi possível salvar o cadastro.');
        err.status = 500;
        throw err;
    }

    await syncClienteTotem(config, pessoa);

    const refreshed = await fetchPessoaById(config, pessoa.id);
    const customer = toPublicCustomer(refreshed || pessoa);
    if (!customer) {
        const err = new Error('Cadastro salvo sem nome válido.');
        err.status = 500;
        throw err;
    }

    return customer;
}
