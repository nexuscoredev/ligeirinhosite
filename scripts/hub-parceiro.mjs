import crypto from 'crypto';
import { hubConfig } from './hub-auth.mjs';
import {
    clienteParceirosFromPessoa,
    deliveryDateOptions,
    resolveParceiroClienteFields,
    rotuloDiasEntrega,
} from './parceiro-delivery.mjs';

const CLIENTE_PARCEIROS_SELECT =
    'id,canal_cliente,ativo,datas_entrega,condicao_pagamento,parcelas_vencimento,formas_pagamento_ids';

const PESSOA_CLIENTE_LOOKUP_SELECT =
    'id,nome,nome_fantasia,cpf_cnpj_digits,email,telefone,clientes(id,nome,canal_cliente,ativo)';

export function normalizeDocDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

export function formatCnpj(digits) {
    const d = normalizeDocDigits(digits);
    if (d.length !== 14) return digits || '';
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function isValidCnpj(value) {
    const c = normalizeDocDigits(value);
    if (c.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(c)) return false;

    const checkDigit = (base) => {
        let sum = 0;
        let pos = base.length - 7;
        for (let i = base.length; i >= 1; i -= 1) {
            sum += Number(c[base.length - i]) * pos;
            pos -= 1;
            if (pos < 2) pos = 9;
        }
        const mod = sum % 11;
        return mod < 2 ? 0 : 11 - mod;
    };

    return checkDigit(c.slice(0, 12)) === Number(c[12]) && checkDigit(c.slice(0, 13)) === Number(c[13]);
}

export function usuarioHasCnpj(usuario, extras = {}) {
    const fromExtras = normalizeDocDigits(extras.cnpjDigits || extras.cnpj);
    if (fromExtras.length === 14 && isValidCnpj(fromExtras)) return true;
    const loginDigits = normalizeDocDigits(usuario?.login);
    return loginDigits.length === 14 && isValidCnpj(loginDigits);
}

export const PARCEIRO_EMAIL_DOMAIN = 'ligeirinho.app';

export function parceiroSyntheticEmail(cnpjDigits) {
    const d = normalizeDocDigits(cnpjDigits);
    if (d.length !== 14 || !isValidCnpj(d)) return '';
    return `parceiro${d}@${PARCEIRO_EMAIL_DOMAIN}`;
}

export function isParceiroSyntheticEmail(email) {
    const e = String(email || '').trim().toLowerCase();
    if (!e) return false;
    const escaped = PARCEIRO_EMAIL_DOMAIN.replace(/\./g, '\\.');
    return new RegExp(`^parceiro\\d{14}@${escaped}$`).test(e);
}

export function hubEmailNeedsSynthetic(email) {
    const e = String(email || '').trim().toLowerCase();
    if (!e) return true;
    if (isParceiroSyntheticEmail(e)) return true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return true;
    if (/^parceiro[^@]*@/i.test(e)) return true;
    return false;
}

export function resolveParceiroEmail({
    provider = 'hub',
    authEmail = '',
    usuario = null,
    pessoa = null,
    cnpjDigits = '',
} = {}) {
    const auth = String(authEmail || '').trim().toLowerCase();
    if (provider === 'google' && auth) return auth;

    const hubEmail = String(usuario?.email || pessoa?.email || '').trim().toLowerCase();
    const digits = normalizeDocDigits(
        cnpjDigits || usuario?.login || pessoa?.cpf_cnpj_digits || pessoa?.cpf_cnpj,
    );

    if (hubEmail && !hubEmailNeedsSynthetic(hubEmail)) {
        return provider === 'google' && auth ? auth : hubEmail;
    }

    if (digits.length === 14 && isValidCnpj(digits)) {
        return parceiroSyntheticEmail(digits);
    }

    return provider === 'google' ? auth : hubEmail;
}

export function resolveParceiroDisplayName({
    provider = 'hub',
    authName = '',
    usuario = null,
    pessoa = null,
    cnpjDigits = '',
} = {}) {
    const auth = String(authName || '').trim();
    const digits = normalizeDocDigits(
        cnpjDigits || usuario?.login || pessoa?.cpf_cnpj_digits || pessoa?.cpf_cnpj,
    );
    const hasCnpj = digits.length === 14 && isValidCnpj(digits);

    if (provider === 'google') {
        return auth;
    }

    if (provider === 'phone') {
        return auth;
    }

    if (hasCnpj) {
        return (
            String(usuario?.nome || '').trim() ||
            String(pessoa?.nome_fantasia || pessoa?.nome || '').trim()
        );
    }

    return String(usuario?.nome || auth || '').trim();
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

export function isHubUsuarioUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        String(value || ''),
    );
}

function clienteFromPessoa(pessoa) {
    const cliente = clienteParceirosFromPessoa(pessoa);
    if (!cliente?.id) return null;
    return {
        clienteId: cliente.id,
        pessoaId: pessoa.id,
        clienteNome: cliente.nome || pessoa.nome_fantasia || pessoa.nome || '',
    };
}

async function fetchUsuarioByPhoneDigits(config, digits) {
    if (!digits || digits.length < 10 || !config.serviceKey) return null;
    const suffixes = [
        ...new Set(
            [digits.slice(-11), digits.slice(-10), digits.slice(-9), digits.slice(-8)].filter(
                (s) => s.length >= 8,
            ),
        ),
    ];
    for (const local of suffixes) {
        const rows = await hubRest(
            config,
            `usuarios?select=id,email,login,nome,telefone,cargo,ativo,must_change_password&telefone=ilike.*${encodeURIComponent(local)}*&ativo=eq.true&limit=5`,
        );
        const list = Array.isArray(rows) ? rows : [];
        for (const row of list) {
            const pessoa = await findPessoaForUsuario(config, row);
            if (pessoa && clienteFromPessoa(pessoa)) return row;
        }
        if (list[0]) return list[0];
    }
    return null;
}

async function findUsuarioForPessoa(config, pessoa) {
    if (!pessoa) return null;
    const digits = normalizeDocDigits(pessoa.cpf_cnpj_digits || pessoa.cpf_cnpj);
    if (digits.length >= 11) {
        const byLogin = await fetchUsuarioByLoginDigits(config, digits);
        if (byLogin) return byLogin;
    }
    const email = String(pessoa.email || '').trim().toLowerCase();
    if (email) return fetchUsuarioByEmail(config, email);
    const phoneDigits = normalizeDocDigits(pessoa.telefone);
    if (phoneDigits.length >= 10) return fetchUsuarioByPhoneDigits(config, phoneDigits);
    return null;
}

/** IDs Hub de todas as contas (CNPJ, Google, e-mail) do mesmo parceiro comercial. */
export async function collectParceiroHubUserIds(config, usuario) {
    const ids = new Set();
    if (usuario?.id) ids.add(usuario.id);
    if (!config.serviceKey || !usuario?.id) return [...ids];

    const pessoa = await findPessoaForUsuario(config, usuario);
    if (!pessoa) return [...ids];

    const cnpjDigits = normalizeDocDigits(pessoa.cpf_cnpj_digits || pessoa.cpf_cnpj);
    if (cnpjDigits.length >= 11) {
        const byCnpj = await fetchUsuarioByLoginDigits(config, cnpjDigits);
        if (byCnpj?.id) ids.add(byCnpj.id);
    }

    const linked = await findUsuarioForPessoa(config, pessoa);
    if (linked?.id) ids.add(linked.id);

    const pessoaEmail = String(pessoa.email || '').trim().toLowerCase();
    if (pessoaEmail) {
        const byPessoaEmail = await fetchUsuarioByEmail(config, pessoaEmail);
        if (byPessoaEmail?.id) ids.add(byPessoaEmail.id);
    }

    const usuarioEmail = String(usuario.email || '').trim().toLowerCase();
    if (usuarioEmail && usuarioEmail !== pessoaEmail) {
        const byUsuarioEmail = await fetchUsuarioByEmail(config, usuarioEmail);
        if (byUsuarioEmail?.id) ids.add(byUsuarioEmail.id);
    }

    return [...ids];
}

/** Chaves para listar pedidos Parceiros (Hub UUID, e-mail e IDs legados do Google). */
export async function collectParceiroOrderLookup(config, usuario, authExtras = {}) {
    const hubUserIds = await collectParceiroHubUserIds(config, usuario);
    const emails = new Set();
    const legacyHubUserIds = new Set();

    const addEmail = (value) => {
        const email = String(value || '').trim().toLowerCase();
        if (email && email.includes('@')) emails.add(email);
    };

    addEmail(usuario?.email);
    addEmail(authExtras.email);

    const pessoa = await findPessoaForUsuario(config, usuario);
    if (pessoa) addEmail(pessoa.email);

    const sub = String(authExtras.sub || '').trim();
    if (sub && !isHubUsuarioUuid(sub) && !hubUserIds.includes(sub)) {
        legacyHubUserIds.add(sub);
    }

    const login = String(usuario?.login || '').trim();
    if (login && !isHubUsuarioUuid(login) && !hubUserIds.includes(login) && !login.includes('@')) {
        legacyHubUserIds.add(login);
    }

    return {
        hubUserIds,
        emails: [...emails],
        legacyHubUserIds: [...legacyHubUserIds],
    };
}

async function fetchPessoaById(config, pessoaId) {
    if (!pessoaId || !config.serviceKey) return null;
    const rows = await hubRest(
        config,
        `pessoas?select=${PESSOA_CLIENTE_LOOKUP_SELECT}&id=eq.${encodeURIComponent(pessoaId)}&limit=1`,
    );
    return Array.isArray(rows) ? rows[0] ?? null : null;
}

/** Busca parceiro no Hub por e-mail e/ou telefone (pessoa ou usuário). */
export async function resolveParceiroHubContact(config, { email, phone } = {}) {
    if (!config.serviceKey) return null;

    const emailNorm = String(email || '').trim().toLowerCase();
    const phoneDigits = normalizeDocDigits(phone);

    if (emailNorm) {
        const usuario = await fetchUsuarioByEmail(config, emailNorm);
        if (usuario) {
            const pessoa = await findPessoaForUsuario(config, usuario);
            const cliente = pessoa ? clienteFromPessoa(pessoa) : null;
            if (cliente) return { usuario, pessoa, cliente };
        }
    }

    if (phoneDigits.length >= 10) {
        const usuario = await fetchUsuarioByPhoneDigits(config, phoneDigits);
        if (usuario) {
            const pessoa = await findPessoaForUsuario(config, usuario);
            const cliente = pessoa ? clienteFromPessoa(pessoa) : null;
            if (cliente) return { usuario, pessoa, cliente };
        }
    }

    const cliente = await findPessoaParceiroByContact(config, {
        email: emailNorm,
        phoneDigits,
    });
    if (!cliente) return null;

    const pessoa = await fetchPessoaById(config, cliente.pessoaId);
    const usuario = pessoa ? await findUsuarioForPessoa(config, pessoa) : null;
    return { usuario, pessoa, cliente };
}

/** Grava e-mail/telefone do app no cadastro Hub quando ainda estão vazios. */
export async function syncParceiroContactLink(config, { usuario, pessoa, email, phone } = {}) {
    if (!config.serviceKey) return;

    const emailNorm = String(email || '').trim().toLowerCase();
    const phoneDigits = normalizeDocDigits(phone);
    const phoneLocal = phoneDigits.length >= 10 ? phoneDigits.slice(-11) : '';

    if (pessoa?.id) {
        const patch = {};
        if (emailNorm && !String(pessoa.email || '').trim()) patch.email = emailNorm;
        if (phoneLocal && !normalizeDocDigits(pessoa.telefone)) patch.telefone = phoneLocal;
        if (Object.keys(patch).length) {
            await hubRest(config, `pessoas?id=eq.${encodeURIComponent(pessoa.id)}`, {
                method: 'PATCH',
                body: patch,
            });
        }
    }

    if (usuario?.id) {
        const patch = {};
        if (phoneLocal && !normalizeDocDigits(usuario.telefone)) patch.telefone = phoneLocal;
        if (Object.keys(patch).length) {
            await hubRest(config, `usuarios?id=eq.${encodeURIComponent(usuario.id)}`, {
                method: 'PATCH',
                body: patch,
            });
        }
    }
}

export async function buildParceiroExtrasFromPessoa(config, pessoa) {
    if (!pessoa?.id) return {};
    const clienteFields = resolveParceiroClienteFields(pessoa);
    const formas = await fetchFormasPagamento(config, clienteFields.formasPagamentoIds);
    const cnpjDigits = pessoa.cpf_cnpj_digits || normalizeDocDigits(pessoa.cpf_cnpj);
    const datasEntrega = clienteFields.datasEntrega;

    return {
        pessoaId: pessoa.id,
        cnpj: pessoa.cpf_cnpj || formatCnpj(cnpjDigits),
        cnpjDigits,
        condicaoPagamento: clienteFields.condicaoPagamento,
        parcelasVencimento: clienteFields.parcelasVencimento,
        datasEntrega,
        diasEntregaLabel: rotuloDiasEntrega(datasEntrega),
        bloqueadoPedido: Boolean(pessoa.bloqueado_pedido),
        inadimplente: Boolean(pessoa.inadimplente),
        paymentMethods: paymentMethodsForParceiro(formas, clienteFields.condicaoPagamento),
        deliveryDateOptions: deliveryDateOptions(datasEntrega),
        razaoSocial: pessoa.nome_fantasia || pessoa.nome || '',
    };
}

async function findPessoaParceiroByContact(config, { email, phoneDigits }) {
    if (email) {
        const rows = await hubRest(
            config,
            `pessoas?select=${PESSOA_CLIENTE_LOOKUP_SELECT}&email=ilike.${encodeURIComponent(email)}&limit=5`,
        );
        const list = Array.isArray(rows) ? rows : [];
        for (const pessoa of list) {
            const hit = clienteFromPessoa(pessoa);
            if (hit) return hit;
        }
    }
    if (phoneDigits && phoneDigits.length >= 10) {
        const local = phoneDigits.slice(-11);
        const rows = await hubRest(
            config,
            `pessoas?select=${PESSOA_CLIENTE_LOOKUP_SELECT}&telefone=ilike.*${encodeURIComponent(local)}*&limit=5`,
        );
        const list = Array.isArray(rows) ? rows : [];
        for (const pessoa of list) {
            const hit = clienteFromPessoa(pessoa);
            if (hit) return hit;
        }
    }
    return null;
}

function cnpjDigitsFromOrder(order) {
    const direct = normalizeDocDigits(order?.customer_cnpj);
    if (direct.length >= 11) return direct;
    const notes = String(order?.notes || '');
    const tagged = notes.match(/CNPJ:\s*([0-9./-]+)/i);
    if (tagged?.[1]) {
        const digits = normalizeDocDigits(tagged[1]);
        if (digits.length >= 11) return digits;
    }
    const loose = notes.match(/\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/);
    if (loose?.[1]) {
        const digits = normalizeDocDigits(loose[1]);
        if (digits.length >= 11) return digits;
    }
    return '';
}

/** Resolve cliente parceiros no Hub a partir de um pedido do app Parceiros. */
export async function resolveClienteParceiroForOrder(config, order) {
    if (!config.serviceKey || !order) return null;

    const cnpjDigits = cnpjDigitsFromOrder(order);
    if (cnpjDigits.length >= 11) {
        const pessoa = await fetchPessoaParceiroByCnpj(config, cnpjDigits);
        const hit = pessoa ? clienteFromPessoa(pessoa) : null;
        if (hit) return hit;
    }

    const hit = await resolveParceiroHubContact(config, {
        email: order.customer_email,
        phone: order.customer_phone,
    });
    return hit?.cliente ?? null;
}

export async function fetchPessoaParceiroByCnpj(config, digits) {
    if (!config.serviceKey || digits.length < 11) return null;
    const rows = await hubRest(
        config,
        `pessoas?select=id,nome,nome_fantasia,cpf_cnpj,cpf_cnpj_digits,email,telefone,condicao_pagamento,parcelas_vencimento,datas_entrega,formas_pagamento_ids,bloqueado_pedido,inadimplente,clientes(${CLIENTE_PARCEIROS_SELECT})&cpf_cnpj_digits=eq.${encodeURIComponent(digits)}&limit=1`
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
            `pessoas?select=id,nome,nome_fantasia,cpf_cnpj,cpf_cnpj_digits,email,telefone,condicao_pagamento,parcelas_vencimento,datas_entrega,formas_pagamento_ids,bloqueado_pedido,inadimplente,clientes(${CLIENTE_PARCEIROS_SELECT})&email=ilike.${encodeURIComponent(usuario.email)}&limit=3`
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
            `pessoas?select=id,nome,nome_fantasia,cpf_cnpj,cpf_cnpj_digits,email,telefone,condicao_pagamento,parcelas_vencimento,datas_entrega,formas_pagamento_ids,bloqueado_pedido,inadimplente,clientes(${CLIENTE_PARCEIROS_SELECT})&telefone=ilike.*${encodeURIComponent(local)}*&limit=3`
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
    { id: 'pix', label: 'PIX', hint: 'Pagamento instantâneo', logo: '/img/icon-pix.svg' },
    {
        id: 'cartao',
        label: 'Cartão débito e crédito',
        hint: 'Visa, Mastercard e Elo',
        logo: '/img/icon-cartoes.svg',
    },
    { id: 'dinheiro', label: 'Dinheiro', hint: 'Pagamento na entrega ou retirada', icon: 'payments' },
    { id: 'prazo', label: 'Prazo / Crediário', hint: 'Conforme condição comercial', icon: 'calendar_month' },
];

export function paymentMethodsForParceiro(formas = [], condicaoPagamento = '') {
    if (!formas.length) {
        const methods = DEFAULT_PAYMENT_METHODS.filter((m) => m.id !== 'boleto');
        if (!condicaoPagamento || /vista/i.test(condicaoPagamento)) {
            return methods.filter((m) => m.id !== 'prazo');
        }
        return methods;
    }

    const tipoToMethod = {
        pix: 'pix',
        cartao_debito: 'cartao',
        cartao_credito: 'cartao',
        dinheiro: 'dinheiro',
        crediario: 'prazo',
    };

    const ids = new Set();
    formas.forEach((f) => {
        const mapped = tipoToMethod[f.tipo];
        if (mapped) ids.add(mapped);
    });
    if (!ids.size) return DEFAULT_PAYMENT_METHODS.filter((m) => m.id !== 'boleto');
    return DEFAULT_PAYMENT_METHODS.filter((m) => ids.has(m.id));
}

export { deliveryDateOptions } from './parceiro-delivery.mjs';

export async function buildParceiroExtras(config, usuario) {
    if (!config.serviceKey || !usuario?.id) return {};
    const pessoa = await findPessoaForUsuario(config, usuario);
    const loginDigits = normalizeDocDigits(usuario?.login);
    if (!pessoa) {
        if (loginDigits.length === 14 && isValidCnpj(loginDigits)) {
            return {
                cnpj: formatCnpj(loginDigits),
                cnpjDigits: loginDigits,
            };
        }
        return {};
    }

    const clienteFields = resolveParceiroClienteFields(pessoa);
    const formas = await fetchFormasPagamento(config, clienteFields.formasPagamentoIds);
    const cnpjDigits = pessoa.cpf_cnpj_digits || normalizeDocDigits(pessoa.cpf_cnpj);
    const datasEntrega = clienteFields.datasEntrega;

    return {
        pessoaId: pessoa.id,
        cnpj: pessoa.cpf_cnpj || formatCnpj(cnpjDigits),
        cnpjDigits,
        condicaoPagamento: clienteFields.condicaoPagamento,
        parcelasVencimento: clienteFields.parcelasVencimento,
        datasEntrega,
        diasEntregaLabel: rotuloDiasEntrega(datasEntrega),
        bloqueadoPedido: Boolean(pessoa.bloqueado_pedido),
        inadimplente: Boolean(pessoa.inadimplente),
        paymentMethods: paymentMethodsForParceiro(formas, clienteFields.condicaoPagamento),
        deliveryDateOptions: deliveryDateOptions(datasEntrega),
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
    const usuario = Array.isArray(rows) ? rows[0] : rows;

    if (usuario && allowed.telefone) {
        const pessoa = await findPessoaForUsuario(config, usuario);
        if (pessoa?.id) {
            const phoneDigits = normalizeDocDigits(allowed.telefone);
            if (phoneDigits.length >= 10) {
                await hubRest(config, `pessoas?id=eq.${encodeURIComponent(pessoa.id)}`, {
                    method: 'PATCH',
                    body: { telefone: phoneDigits.slice(-11) },
                });
            }
        }
    }

    return usuario;
}

export async function ensureUsuarioForGoogleParceiro(config, { email, name = '' } = {}) {
    if (!config.serviceKey) {
        throw new Error('Hub não configurado para vincular conta Google.');
    }

    const emailNorm = String(email || '').trim().toLowerCase();
    if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
        throw new Error('E-mail Google inválido.');
    }

    const existing = await fetchUsuarioByEmail(config, emailNorm);
    if (existing?.id) return existing;

    const password = crypto.randomUUID();
    const authRes = await fetch(`${config.url}/auth/v1/admin/users`, {
        method: 'POST',
        headers: hubHeaders(config, config.serviceKey),
        body: JSON.stringify({
            email: emailNorm,
            email_confirm: true,
            password,
            user_metadata: { nome: name || emailNorm, provider: 'google' },
        }),
    });
    const authUser = await authRes.json();
    if (!authRes.ok) {
        throw new Error(authUser.msg || authUser.message || 'Não foi possível criar usuário no Hub.');
    }

    const authId = authUser.id || authUser.user?.id;
    if (!authId) throw new Error('ID do usuário auth não retornado.');

    const rows = await hubRest(config, 'usuarios', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: {
            id: authId,
            email: emailNorm,
            login: emailNorm,
            nome: String(name || emailNorm).slice(0, 120),
            cargo: 'Clientes',
            ativo: true,
        },
    });

    return Array.isArray(rows) ? rows[0] : rows;
}

function formatCepBr(cep) {
    const d = normalizeDocDigits(cep);
    if (d.length !== 8) return String(cep || '').trim();
    return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function enderecoGfInicial(cnpjFormatado) {
    return {
        pais: 'BRASIL',
        uf: 'SP',
        indicador_ie: '3',
        cnpj: cnpjFormatado,
        cliente: {
            situacao: 'liberado',
            ao_exceder_limite: 'permitir',
            ao_crediario_vencido: 'bloquear_compra',
        },
    };
}

function buildEnderecoFromCadastro(cadastro, cnpjFormatado, existingEndereco = {}) {
    const base =
        existingEndereco && typeof existingEndereco === 'object'
            ? { ...enderecoGfInicial(cnpjFormatado), ...existingEndereco }
            : enderecoGfInicial(cnpjFormatado);
    const e = cadastro.endereco || {};
    return {
        ...base,
        cnpj: cnpjFormatado,
        cep: e.cep ? formatCepBr(e.cep) : base.cep || '',
        logradouro: String(e.logradouro || '').trim() || base.logradouro || '',
        numero: String(e.numero || '').trim() || base.numero || '',
        complemento: String(e.complemento || '').trim() || base.complemento || '',
        bairro: String(e.bairro || '').trim() || base.bairro || '',
        cidade: String(e.cidade || '').trim() || base.cidade || '',
        uf: String(e.uf || '').trim().toUpperCase() || base.uf || 'SP',
    };
}

export async function fetchPessoaByCnpjDigits(config, digits) {
    if (!config.serviceKey || digits.length < 11) return null;
    const rows = await hubRest(
        config,
        `pessoas?select=id,nome,nome_fantasia,cpf_cnpj,cpf_cnpj_digits,email,telefone,endereco,canal_cliente,clientes(${CLIENTE_PARCEIROS_SELECT})&cpf_cnpj_digits=eq.${encodeURIComponent(digits)}&limit=1`,
    );
    return Array.isArray(rows) ? rows[0] : null;
}

async function syncClienteParceiros(config, pessoa) {
    const existing = await hubRest(
        config,
        `clientes?select=id&pessoa_id=eq.${encodeURIComponent(pessoa.id)}&limit=1`,
    );
    const row = {
        pessoa_id: pessoa.id,
        nome: pessoa.nome,
        nome_fantasia: pessoa.nome_fantasia,
        tabela_preco: 'padrao',
        canal_cliente: 'parceiros',
        ativo: true,
        bloqueado_pedido: false,
        inadimplente: false,
    };
    if (Array.isArray(existing) && existing[0]?.id) {
        await hubRest(config, `clientes?id=eq.${encodeURIComponent(existing[0].id)}`, {
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

export async function registerParceiroCnpjCadastro(config, userId, usuario, cadastro = {}) {
    const digits = normalizeDocDigits(cadastro.cnpj);
    if (!isValidCnpj(digits)) {
        throw new Error('Informe um CNPJ válido com 14 dígitos.');
    }

    const razao = String(cadastro.razao_social || cadastro.nome || '').trim();
    if (!razao) {
        throw new Error('Informe a razão social da empresa.');
    }

    const fantasia = String(cadastro.nome_fantasia || '').trim() || razao;
    const cnpjFormatted = formatCnpj(digits);
    const enderecoInput = cadastro.endereco || {};
    if (!String(enderecoInput.cep || '').replace(/\D/g, '').match(/^\d{8}$/)) {
        throw new Error('Informe o CEP da empresa.');
    }
    if (!String(enderecoInput.logradouro || '').trim()) {
        throw new Error('Informe o logradouro.');
    }
    if (!String(enderecoInput.cidade || '').trim()) {
        throw new Error('Informe a cidade.');
    }
    if (!String(enderecoInput.uf || '').trim()) {
        throw new Error('Informe o estado (UF).');
    }

    await registerUsuarioCnpj(config, userId, usuario, digits);

    const emailNorm = String(cadastro.email || usuario.email || '').trim().toLowerCase();
    const phoneDigits = normalizeDocDigits(cadastro.telefone || usuario.telefone);
    const telefone = phoneDigits.length >= 10 ? phoneDigits.slice(-11) : null;

    let pessoa = await fetchPessoaByCnpjDigits(config, digits);
    const endereco = buildEnderecoFromCadastro(cadastro, cnpjFormatted, pessoa?.endereco);

    const pessoaRow = {
        tipos: ['cliente'],
        nome: razao,
        nome_fantasia: fantasia,
        cpf_cnpj: cnpjFormatted,
        email: emailNorm || null,
        telefone,
        endereco,
        canal_cliente: 'parceiros',
        tabela_preco: 'padrao',
        ativo: true,
    };

    if (pessoa?.id) {
        const patch = { ...pessoaRow };
        if (pessoa.email && emailNorm && pessoa.email.toLowerCase() !== emailNorm) {
            if (!hubEmailNeedsSynthetic(pessoa.email)) delete patch.email;
        }
        if (pessoa.telefone && telefone && normalizeDocDigits(pessoa.telefone) !== telefone) {
            delete patch.telefone;
        }
        const rows = await hubRest(config, `pessoas?id=eq.${encodeURIComponent(pessoa.id)}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: patch,
        });
        pessoa = Array.isArray(rows) ? rows[0] : rows;
    } else {
        const rows = await hubRest(config, 'pessoas', {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: pessoaRow,
        });
        pessoa = Array.isArray(rows) ? rows[0] : rows;
    }

    if (!pessoa?.id) {
        throw new Error('Não foi possível salvar o cadastro da empresa.');
    }

    await syncClienteParceiros(config, pessoa);

    const usuarioPatch = { nome: fantasia.slice(0, 120) };
    if (telefone) usuarioPatch.telefone = telefone;
    const usuarioRows = await hubRest(config, `usuarios?id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: usuarioPatch,
    });
    const usuarioUpdated = Array.isArray(usuarioRows) ? usuarioRows[0] : usuarioRows;

    await syncParceiroContactLink(config, {
        usuario: usuarioUpdated,
        pessoa,
        email: emailNorm,
        phone: telefone,
    });

    return usuarioUpdated;
}

export async function registerUsuarioCnpj(config, userId, usuario, cnpjInput) {
    const digits = normalizeDocDigits(cnpjInput);
    if (!isValidCnpj(digits)) {
        throw new Error('Informe um CNPJ válido com 14 dígitos.');
    }

    const currentExtras = await buildParceiroExtras(config, usuario);
    if (usuarioHasCnpj(usuario, currentExtras)) {
        throw new Error('Esta conta já possui CNPJ cadastrado.');
    }

    const otherUsuario = await fetchUsuarioByLoginDigits(config, digits);
    if (otherUsuario?.id && otherUsuario.id !== userId) {
        throw new Error('Este CNPJ já está vinculado a outra conta.');
    }

    const pessoa = await fetchPessoaParceiroByCnpj(config, digits);
    if (pessoa?.email) {
        const byEmail = await fetchUsuarioByEmail(config, pessoa.email);
        if (byEmail?.id && byEmail.id !== userId) {
            const linked = await buildParceiroExtras(config, byEmail);
            if (usuarioHasCnpj(byEmail, linked)) {
                throw new Error('Este CNPJ já está vinculado a outra conta.');
            }
        }
    }

    const rows = await hubRest(
        config,
        `usuarios?id=eq.${encodeURIComponent(userId)}`,
        {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: { login: digits },
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
