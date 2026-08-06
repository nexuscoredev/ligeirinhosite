import { hubConfig } from '../hub-auth.mjs';
import { normalizeDocDigits, formatCnpj, isValidCnpj, fetchFormasPagamento } from '../hub-parceiro.mjs';
import { formatCpf, isValidCpf } from './cpf.mjs';
import { phoneLocalDigits, phonesMatch, phoneLookupSuffixes } from './phone-match.mjs';

/** Regra padrão Hub — canal Ligeirinho Parceiros. */
export const CONDICAO_PAGAMENTO_PADRAO_PARCEIROS = 'Toda terça subsequente ao pedido';
export const VENCIMENTO_PAGAMENTO_PADRAO_PARCEIROS = 'Toda terça subsequente ao pedido';

const PESSOA_LOOKUP_SELECT =
    'id,nome,nome_fantasia,cpf_cnpj,cpf_cnpj_digits,email,telefone,cliente_a_prazo,condicao_pagamento,parcelas_vencimento,formas_pagamento_ids,clientes(id,canal_cliente,ativo,cliente_a_prazo)';

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

function formatDocDigits(docDigits) {
    if (docDigits.length === 11 && isValidCpf(docDigits)) return formatCpf(docDigits);
    if (docDigits.length === 14 && isValidCnpj(docDigits)) return formatCnpj(docDigits);
    return docDigits;
}

function clienteAPrazoFromPessoa(pessoa) {
    if (!pessoa) return false;
    const clientes = Array.isArray(pessoa.clientes) ? pessoa.clientes : pessoa.clientes ? [pessoa.clientes] : [];
    const parceiros = clientes.find((c) => c?.canal_cliente === 'parceiros' && c?.ativo !== false);
    if (parceiros && parceiros.cliente_a_prazo != null) return Boolean(parceiros.cliente_a_prazo);
    return Boolean(pessoa.cliente_a_prazo);
}

async function fetchPessoaByDoc(config, docDigits) {
    if (!docDigits || docDigits.length < 11) return null;
    const rows = await hubRest(
        config,
        `pessoas?select=${PESSOA_LOOKUP_SELECT}&cpf_cnpj_digits=eq.${encodeURIComponent(docDigits)}&limit=1`,
    );
    return Array.isArray(rows) ? rows[0] ?? null : null;
}

async function fetchCrediarioFormaIds(config) {
    const rows = await hubRest(
        config,
        'formas_pagamento?select=id,tipo,ativo&tipo=in.(crediario,prazo)&ativo=eq.true&order=nome.asc',
    );
    const list = Array.isArray(rows) ? rows : [];
    return list.map((row) => row.id).filter(Boolean);
}

async function mergeFormasPagamentoIds(config, existingIds = [], clienteAPrazo = false) {
    const ids = new Set((existingIds || []).filter(Boolean));
    if (!clienteAPrazo) {
        const formas = await fetchFormasPagamento(config, [...ids]);
        formas
            .filter((f) => f.tipo === 'crediario' || f.tipo === 'prazo')
            .forEach((f) => ids.delete(f.id));
        return [...ids];
    }
    const crediarioIds = await fetchCrediarioFormaIds(config);
    crediarioIds.forEach((id) => ids.add(id));
    return [...ids];
}

async function syncClienteParceirosRow(config, pessoa, patch = {}) {
    const existing = await hubRest(
        config,
        `clientes?select=id,canal_cliente&pessoa_id=eq.${encodeURIComponent(pessoa.id)}&limit=5`,
    );
    const list = Array.isArray(existing) ? existing : [];
    const parceirosRow = list.find((c) => c?.canal_cliente === 'parceiros');
    const row = {
        pessoa_id: pessoa.id,
        nome: pessoa.nome,
        nome_fantasia: pessoa.nome_fantasia || pessoa.nome,
        tabela_preco: 'padrao',
        canal_cliente: 'parceiros',
        ativo: true,
        bloqueado_pedido: false,
        inadimplente: false,
        ...patch,
    };

    if (parceirosRow?.id) {
        await hubRest(config, `clientes?id=eq.${encodeURIComponent(parceirosRow.id)}`, {
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

export function pessoaToClienteSearchHit(pessoa) {
    if (!pessoa?.id) return null;
    const docDigits = normalizeDocDigits(pessoa.cpf_cnpj_digits || pessoa.cpf_cnpj).slice(0, 14);
    return {
        pessoaId: pessoa.id,
        nome: String(pessoa.nome_fantasia || pessoa.nome || '').trim(),
        telefone: String(pessoa.telefone || '').trim(),
        doc: docDigits ? formatDocDigits(docDigits) : '',
        docDigits,
        clienteAPrazo: clienteAPrazoFromPessoa(pessoa),
        condicaoPagamento: String(pessoa.condicao_pagamento || '').trim(),
    };
}

function ilikePattern(raw) {
    const cleaned = String(raw || '')
        .trim()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[%_,]/g, ' ')
        .replace(/\s+/g, '%');
    if (!cleaned || cleaned.length < 2) return '';
    return `*${cleaned}*`;
}

function dedupeSearchHits(list = []) {
    const seen = new Set();
    const out = [];
    for (const hit of list) {
        if (!hit?.pessoaId || seen.has(hit.pessoaId)) continue;
        seen.add(hit.pessoaId);
        out.push(hit);
    }
    return out;
}

async function searchPessoasByPhone(config, phoneLocal, limit = 8) {
    const hits = [];
    const seen = new Set();

    for (const suffix of phoneLookupSuffixes(phoneLocal)) {
        const rows = await hubRest(
            config,
            `pessoas?select=${PESSOA_LOOKUP_SELECT}&telefone=ilike.*${encodeURIComponent(suffix)}*&tipos=cs.{cliente}&ativo=eq.true&limit=${Math.max(limit, 12)}`,
        );
        const list = Array.isArray(rows) ? rows : [];
        for (const pessoa of list) {
            if (!pessoa?.id || seen.has(pessoa.id)) continue;
            if (!phonesMatch(pessoa.telefone, phoneLocal)) continue;
            seen.add(pessoa.id);
            const hit = pessoaToClienteSearchHit(pessoa);
            if (hit?.nome) hits.push(hit);
            if (hits.length >= limit) return hits;
        }
    }

    return hits;
}

async function searchPessoasByName(config, query, limit = 8) {
    const pattern = ilikePattern(query);
    if (!pattern) return [];

    const encoded = encodeURIComponent(pattern);
    const rows = await hubRest(
        config,
        `pessoas?select=${PESSOA_LOOKUP_SELECT}&or=(nome.ilike.${encoded},nome_fantasia.ilike.${encoded})&tipos=cs.{cliente}&ativo=eq.true&order=nome.asc&limit=${limit}`,
    );
    const list = Array.isArray(rows) ? rows : [];
    return dedupeSearchHits(list.map((pessoa) => pessoaToClienteSearchHit(pessoa)).filter(Boolean));
}

/**
 * Busca clientes finais no Hub por nome, CPF/CNPJ ou telefone (conta distribuidora).
 */
export async function searchDistribuidoraClientes(env, queryInput, { limit = 8 } = {}) {
    const config = hubConfig(env);
    if (!config.serviceKey) return [];

    const query = String(queryInput || '').trim();
    if (query.length < 2) return [];

    const digits = normalizeDocDigits(query);
    const hasLetters = /[A-Za-zÀ-ÿ]/.test(query);

    if (!hasLetters && (digits.length === 11 || digits.length === 14)) {
        const pessoa = await fetchPessoaByDoc(config, digits);
        const hit = pessoaToClienteSearchHit(pessoa);
        return hit ? [hit] : [];
    }

    if (!hasLetters && digits.length >= 10) {
        return searchPessoasByPhone(config, phoneLocalDigits(query), limit);
    }

    if (hasLetters || query.length >= 3) {
        return searchPessoasByName(config, query, limit);
    }

    return [];
}

/**
 * Busca cliente final no Hub pelo CPF/CNPJ (conta distribuidora).
 */
export async function lookupDistribuidoraClienteFinal(env, docDigitsInput) {
    const config = hubConfig(env);
    if (!config.serviceKey) return null;

    const docDigits = normalizeDocDigits(docDigitsInput).slice(0, 14);
    if (docDigits.length !== 11 && docDigits.length !== 14) return null;

    const pessoa = await fetchPessoaByDoc(config, docDigits);
    if (!pessoa?.id) return { found: false, clienteAPrazo: false };

    const hit = pessoaToClienteSearchHit(pessoa);
    return {
        found: true,
        ...hit,
    };
}

/**
 * Cria ou atualiza cadastro do cliente final no Hub (canal parceiros) com flag cliente_a_prazo.
 */
export async function syncDistribuidoraClienteFinal(
    env,
    { nome = '', telefone = '', docDigits: docDigitsInput = '', clienteAPrazo = false } = {},
) {
    const config = hubConfig(env);
    if (!config.serviceKey) return null;

    const docDigits = normalizeDocDigits(docDigitsInput).slice(0, 14);
    if (docDigits.length !== 11 && docDigits.length !== 14) return null;

    const nomeTrim = String(nome || '').trim().slice(0, 120);
    const phoneLocal = phoneLocalDigits(telefone);
    let pessoa = await fetchPessoaByDoc(config, docDigits);

    const formasIds = await mergeFormasPagamentoIds(
        config,
        pessoa?.formas_pagamento_ids,
        Boolean(clienteAPrazo),
    );

    const pessoaPatch = {
        tipos: ['cliente'],
        cpf_cnpj: formatDocDigits(docDigits),
        canal_cliente: 'parceiros',
        cliente_a_prazo: Boolean(clienteAPrazo),
        ativo: true,
    };

    if (nomeTrim) {
        pessoaPatch.nome = nomeTrim;
        if (!String(pessoa?.nome_fantasia || '').trim()) {
            pessoaPatch.nome_fantasia = nomeTrim;
        }
    }
    if (phoneLocal && phoneLocal.length >= 10) {
        pessoaPatch.telefone = phoneLocal.slice(-11);
    }
    if (clienteAPrazo) {
        pessoaPatch.condicao_pagamento = CONDICAO_PAGAMENTO_PADRAO_PARCEIROS;
        pessoaPatch.parcelas_vencimento = VENCIMENTO_PAGAMENTO_PADRAO_PARCEIROS;
    }
    if (formasIds.length) {
        pessoaPatch.formas_pagamento_ids = formasIds;
    }

    if (pessoa?.id) {
        const rows = await hubRest(config, `pessoas?id=eq.${encodeURIComponent(pessoa.id)}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: pessoaPatch,
        });
        pessoa = Array.isArray(rows) ? rows[0] : rows;
    } else {
        if (!nomeTrim) return null;
        const rows = await hubRest(config, 'pessoas', {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: {
                ...pessoaPatch,
                nome: nomeTrim,
                nome_fantasia: nomeTrim,
            },
        });
        pessoa = Array.isArray(rows) ? rows[0] : rows;
    }

    if (!pessoa?.id) return null;

    await syncClienteParceirosRow(config, pessoa, {
        nome: pessoa.nome,
        nome_fantasia: pessoa.nome_fantasia || pessoa.nome,
        cliente_a_prazo: Boolean(clienteAPrazo),
        condicao_pagamento: clienteAPrazo ? CONDICAO_PAGAMENTO_PADRAO_PARCEIROS : pessoa.condicao_pagamento,
        parcelas_vencimento: clienteAPrazo
            ? VENCIMENTO_PAGAMENTO_PADRAO_PARCEIROS
            : pessoa.parcelas_vencimento,
        formas_pagamento_ids: formasIds.length ? formasIds : pessoa.formas_pagamento_ids,
    });

    return { pessoaId: pessoa.id, clienteAPrazo: Boolean(clienteAPrazo) };
}

export const CREDIT_PAYMENT_METHODS = new Set(['fiado', 'credito', 'boleto', 'prazo']);

export function orderUsesCreditPayment(paymentMethod, paymentSplits = []) {
    const splits = Array.isArray(paymentSplits) ? paymentSplits : [];
    if (splits.length) {
        return splits.some((item) => CREDIT_PAYMENT_METHODS.has(String(item?.method || '').toLowerCase()));
    }
    return CREDIT_PAYMENT_METHODS.has(String(paymentMethod || '').toLowerCase());
}
