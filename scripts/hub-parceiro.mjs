import { hubConfig } from './hub-auth.mjs';

export function normalizeDocDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

export function formatCnpj(digits) {
    const d = normalizeDocDigits(digits);
    if (d.length !== 14) return digits || '';
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function hubHeaders(config, token, extra = {}) {
    const key = config.anonKey;
    return {
        apikey: key,
        Authorization: `Bearer ${token || config.serviceKey || key}`,
        'Content-Type': 'application/json',
        ...extra,
    };
}

async function hubRest(config, path, options = {}) {
    const token = options.token || config.serviceKey;
    if (!token) throw new Error('Credenciais do Hub ausentes.');
    const res = await fetch(`${config.url}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: hubHeaders(config, token, options.headers || {}),
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
        const msg = data?.message || data?.error_description || text || `Hub ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

export async function resolveLoginEmailExtended(config, login) {
    const trimmed = String(login || '').trim();
    if (!trimmed) return null;

    const tryRpc = async (value) => {
        try {
            const res = await fetch(`${config.url}/rest/v1/rpc/resolve_login_email`, {
                method: 'POST',
                headers: hubHeaders(config, config.anonKey),
                body: JSON.stringify({ p_login: value }),
            });
            const text = await res.text();
            if (!res.ok) return null;
            if (!text || text === 'null') return null;
            return JSON.parse(text);
        } catch {
            return null;
        }
    };

    let email = await tryRpc(trimmed);
    if (email) return email;

    const digits = normalizeDocDigits(trimmed);
    if (digits.length >= 11) {
        email = await tryRpc(digits);
        if (email) return email;

        if (config.serviceKey) {
            const usuario = await fetchUsuarioByLoginDigits(config, digits);
            if (usuario?.email) return usuario.email;

            const pessoa = await fetchPessoaParceiroByCnpj(config, digits);
            if (pessoa?.email) {
                const byEmail = await fetchUsuarioByEmail(config, pessoa.email);
                if (byEmail?.email) return byEmail.email;
            }
        }
    }

    return null;
}

async function fetchUsuarioByLoginDigits(config, digits) {
    const rows = await hubRest(
        config,
        `usuarios?select=id,email,login,nome,cargo,ativo,telefone,must_change_password&or=(login.ilike.${encodeURIComponent(digits)},login.ilike.${encodeURIComponent(formatCnpj(digits))})&ativo=eq.true&limit=1`
    );
    return Array.isArray(rows) ? rows[0] : null;
}

export async function fetchUsuarioByEmail(config, email) {
    if (!email || !config.serviceKey) return null;
    const rows = await hubRest(
        config,
        `usuarios?select=id,email,login,nome,cargo,ativo,telefone,must_change_password&email=eq.${encodeURIComponent(email)}&limit=1`
    );
    return Array.isArray(rows) ? rows[0] : null;
}

export async function fetchUsuarioById(config, userId, token) {
    const rows = await hubRest(
        config,
        `usuarios?select=id,email,login,nome,cargo,ativo,telefone,must_change_password&id=eq.${encodeURIComponent(userId)}&limit=1`,
        { token: token || config.serviceKey }
    );
    return Array.isArray(rows) ? rows[0] : null;
}

export async function fetchPessoaParceiroByCnpj(config, digits) {
    if (!config.serviceKey || digits.length < 11) return null;
    const rows = await hubRest(
        config,
        `pessoas?select=id,nome,nome_fantasia,cpf_cnpj,cpf_cnpj_digits,email,telefone,condicao_pagamento,parcelas_vencimento,datas_entrega,formas_pagamento_ids,bloqueado_pedido,inadimplente,clientes(canal_cliente,ativo)&cpf_cnpj_digits=eq.${encodeURIComponent(digits)}&limit=1`
    );
    const pessoa = Array.isArray(rows) ? rows[0] : null;
    if (!pessoa) return null;
    const clientes = Array.isArray(pessoa.clientes) ? pessoa.clientes : pessoa.clientes ? [pessoa.clientes] : [];
    const parceiro = clientes.some((c) => c?.canal_cliente === 'parceiros' && c?.ativo !== false);
    if (!parceiro && digits.length === 14) return null;
    return pessoa;
}

async function findPessoaForUsuario(config, usuario) {
    const loginDigits = normalizeDocDigits(usuario?.login);
    if (loginDigits.length >= 11) {
        const byLogin = await fetchPessoaParceiroByCnpj(config, loginDigits);
        if (byLogin) return byLogin;
    }
    if (usuario?.email) {
        const rows = await hubRest(
            config,
            `pessoas?select=id,nome,nome_fantasia,cpf_cnpj,cpf_cnpj_digits,email,telefone,condicao_pagamento,parcelas_vencimento,datas_entrega,formas_pagamento_ids,bloqueado_pedido,inadimplente,clientes(canal_cliente,ativo)&email=ilike.${encodeURIComponent(usuario.email)}&limit=3`
        );
        const list = Array.isArray(rows) ? rows : [];
        const match = list.find((p) => {
            const clientes = Array.isArray(p.clientes) ? p.clientes : p.clientes ? [p.clientes] : [];
            return clientes.some((c) => c?.canal_cliente === 'parceiros' && c?.ativo !== false);
        });
        if (match) return match;
    }
    const phoneDigits = normalizeDocDigits(usuario?.telefone);
    if (phoneDigits.length >= 10) {
        const local = phoneDigits.slice(-11);
        const rows = await hubRest(
            config,
            `pessoas?select=id,nome,nome_fantasia,cpf_cnpj,cpf_cnpj_digits,email,telefone,condicao_pagamento,parcelas_vencimento,datas_entrega,formas_pagamento_ids,bloqueado_pedido,inadimplente,clientes(canal_cliente,ativo)&telefone=ilike.*${encodeURIComponent(local)}*&limit=3`
        );
        const list = Array.isArray(rows) ? rows : [];
        const match = list.find((p) => {
            const clientes = Array.isArray(p.clientes) ? p.clientes : p.clientes ? [p.clientes] : [];
            return clientes.some((c) => c?.canal_cliente === 'parceiros' && c?.ativo !== false);
        });
        if (match) return match;
    }
    return null;
}

export async function fetchFormasPagamento(config, ids = []) {
    const unique = [...new Set((ids || []).filter(Boolean))];
    if (!unique.length || !config.serviceKey) return [];
    const rows = await hubRest(
        config,
        `formas_pagamento?select=id,nome,codigo,tipo,ativo&id=in.(${unique.join(',')})&ativo=eq.true&order=nome.asc`
    );
    return Array.isArray(rows) ? rows : [];
}

export const DEFAULT_PAYMENT_METHODS = [
    { id: 'mercado_pago', label: 'Pix / Cartão (Mercado Pago)', hint: 'Pagamento online imediato' },
    { id: 'boleto', label: 'Boleto', hint: 'Taxas podem ser aplicadas' },
    { id: 'dinheiro', label: 'Dinheiro', hint: 'Pagamento na entrega ou retirada' },
    { id: 'prazo', label: 'Prazo / Crediário', hint: 'Conforme condição comercial' },
];

export function paymentMethodsForParceiro(formas = [], condicaoPagamento = '') {
    if (!formas.length) {
        const methods = [...DEFAULT_PAYMENT_METHODS];
        if (!condicaoPagamento || /vista/i.test(condicaoPagamento)) {
            return methods.filter((m) => m.id !== 'prazo');
        }
        return methods;
    }

    const tipoToMethod = {
        pix: 'mercado_pago',
        cartao_debito: 'mercado_pago',
        cartao_credito: 'mercado_pago',
        boleto: 'boleto',
        dinheiro: 'dinheiro',
        crediario: 'prazo',
    };

    const ids = new Set();
    formas.forEach((f) => {
        const mapped = tipoToMethod[f.tipo];
        if (mapped) ids.add(mapped);
    });
    if (!ids.size) return DEFAULT_PAYMENT_METHODS;
    return DEFAULT_PAYMENT_METHODS.filter((m) => ids.has(m.id));
}

export function deliveryDateOptions(datasEntrega = [], count = 4) {
    const allowed = new Set((datasEntrega || []).map(Number));
    const options = [];
    const now = new Date();
    for (let i = 1; i <= 21 && options.length < count; i += 1) {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        const dow = d.getDay();
        if (allowed.size && !allowed.has(dow)) continue;
        const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' });
        options.push({
            value: d.toISOString().slice(0, 10),
            label,
            weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
            type: 'Regular',
            priceLabel: 'Grátis',
        });
    }
    if (!options.length) {
        for (let i = 1; i <= count; i += 1) {
            const d = new Date(now);
            d.setDate(d.getDate() + i);
            const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
            const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' });
            options.push({
                value: d.toISOString().slice(0, 10),
                label,
                weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
                type: 'Regular',
                priceLabel: 'Grátis',
            });
        }
    }
    return options;
}

export async function buildParceiroExtras(config, usuario) {
    if (!config.serviceKey || !usuario?.id) return {};
    const pessoa = await findPessoaForUsuario(config, usuario);
    if (!pessoa) return {};

    const formas = await fetchFormasPagamento(config, pessoa.formas_pagamento_ids || []);
    const cnpjDigits = pessoa.cpf_cnpj_digits || normalizeDocDigits(pessoa.cpf_cnpj);

    return {
        pessoaId: pessoa.id,
        cnpj: pessoa.cpf_cnpj || formatCnpj(cnpjDigits),
        cnpjDigits,
        condicaoPagamento: pessoa.condicao_pagamento || '',
        parcelasVencimento: pessoa.parcelas_vencimento || '',
        datasEntrega: pessoa.datas_entrega || [],
        bloqueadoPedido: Boolean(pessoa.bloqueado_pedido),
        inadimplente: Boolean(pessoa.inadimplente),
        paymentMethods: paymentMethodsForParceiro(formas, pessoa.condicao_pagamento),
        deliveryDateOptions: deliveryDateOptions(pessoa.datas_entrega),
        razaoSocial: pessoa.nome_fantasia || pessoa.nome || '',
    };
}

export async function updateUsuarioFields(config, userId, patch) {
    const allowed = {};
    if (patch.telefone !== undefined) allowed.telefone = String(patch.telefone || '').trim() || null;
    if (patch.email !== undefined) allowed.email = String(patch.email || '').trim() || null;
    if (Object.keys(allowed).length === 0) return null;

    const rows = await hubRest(
        config,
        `usuarios?id=eq.${encodeURIComponent(userId)}`,
        {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: allowed,
        }
    );
    return Array.isArray(rows) ? rows[0] : rows;
}

export async function clearMustChangePassword(config, userId) {
    try {
        await hubRest(config, `usuarios?id=eq.${encodeURIComponent(userId)}`, {
            method: 'PATCH',
            body: { must_change_password: false },
        });
    } catch {
        /* coluna pode não existir ainda */
    }

    try {
        await fetch(`${config.url}/auth/v1/admin/users/${userId}`, {
            method: 'PUT',
            headers: hubHeaders(config, config.serviceKey),
            body: JSON.stringify({
                user_metadata: { must_change_password: false },
            }),
        });
    } catch {
        /* ignore */
    }
}

export async function changePasswordWithToken(config, accessToken, newPassword) {
    const res = await fetch(`${config.url}/auth/v1/user`, {
        method: 'PUT',
        headers: hubHeaders(config, accessToken),
        body: JSON.stringify({ password: newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error_description || data.msg || data.message || 'Não foi possível alterar a senha.');
    }
    return data;
}

export async function verifyHubPassword(config, email, password) {
    const res = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: hubHeaders(config, config.anonKey),
        body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    return res.ok;
}

export { hubConfig };
