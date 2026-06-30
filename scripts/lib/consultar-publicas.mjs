const USER_AGENT = 'LigeirinhoParceiros/1.0 (consultar-cnpj)';
const CNPJ_TIMEOUT_MS = 45_000;

export function apenasDigitos(valor) {
    return String(valor || '').replace(/\D/g, '');
}

export function formatarCep(cep) {
    const d = apenasDigitos(cep);
    if (d.length !== 8) return String(cep || '').trim();
    return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function mapPublicaCnpj(data) {
    const est = data.estabelecimento;
    if (!est || typeof est !== 'object') return null;

    const cidade = est.cidade;
    const estado = est.estado;

    const ddd = String(est.ddd1 ?? '');
    const tel = String(est.telefone1 ?? '');
    const telefone = ddd && tel ? `${ddd}${tel}` : null;

    const tipoLog = String(est.tipo_logradouro ?? '').trim();
    const logradouro = String(est.logradouro ?? '').trim();
    const logradouroCompleto = [tipoLog, logradouro].filter(Boolean).join(' ') || null;

    return {
        razao_social: String(data.razao_social ?? ''),
        nome_fantasia: est.nome_fantasia ? String(est.nome_fantasia) : null,
        cnpj: String(est.cnpj ?? ''),
        cep: est.cep ? String(est.cep) : null,
        logradouro: logradouroCompleto,
        numero: est.numero ? String(est.numero) : null,
        complemento: est.complemento ? String(est.complemento) : null,
        bairro: est.bairro ? String(est.bairro) : null,
        municipio: cidade?.nome ? String(cidade.nome) : null,
        uf: estado?.sigla ? String(estado.sigla) : null,
        ddd_telefone_1: telefone,
        email: est.email ? String(est.email) : null,
    };
}

async function consultarBrasilApi(cnpj) {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(CNPJ_TIMEOUT_MS),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Brasil API respondeu ${res.status}`);

    const data = await res.json();
    return {
        razao_social: String(data.razao_social ?? ''),
        nome_fantasia: data.nome_fantasia ? String(data.nome_fantasia) : null,
        cnpj: String(data.cnpj ?? cnpj),
        cep: data.cep ? String(data.cep) : null,
        logradouro: data.logradouro ? String(data.logradouro) : null,
        numero: data.numero ? String(data.numero) : null,
        complemento: data.complemento ? String(data.complemento) : null,
        bairro: data.bairro ? String(data.bairro) : null,
        municipio: data.municipio ? String(data.municipio) : null,
        uf: data.uf ? String(data.uf) : null,
        ddd_telefone_1: data.ddd_telefone_1 ? String(data.ddd_telefone_1) : null,
        email: data.email ? String(data.email) : null,
    };
}

async function consultarPublicaCnpj(cnpj) {
    const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(CNPJ_TIMEOUT_MS),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`publica.cnpj.ws respondeu ${res.status}`);

    const data = await res.json();
    return mapPublicaCnpj(data);
}

/** Consulta CNPJ em fontes públicas (Brasil API → publica.cnpj.ws). */
export async function consultarEmpresaPorCnpj(cnpjInput) {
    const digits = apenasDigitos(cnpjInput);
    if (digits.length !== 14) {
        throw new Error('Informe um CNPJ com 14 dígitos.');
    }

    try {
        const brasil = await consultarBrasilApi(digits);
        if (brasil?.razao_social?.trim()) return brasil;
    } catch (e) {
        console.warn('[consultar-publicas] Brasil API:', e?.message || e);
    }

    try {
        const publica = await consultarPublicaCnpj(digits);
        if (publica?.razao_social?.trim()) return publica;
    } catch (e) {
        console.warn('[consultar-publicas] publica.cnpj.ws:', e?.message || e);
    }

    return null;
}

export async function consultarEnderecoPorCep(cepInput) {
    const digits = apenasDigitos(cepInput);
    if (digits.length !== 8) {
        throw new Error('Informe um CEP com 8 dígitos.');
    }

    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error('CEP não encontrado.');

    const data = await res.json();
    if (data.erro || !data.localidade) {
        throw new Error('CEP não encontrado.');
    }

    return {
        cep: formatarCep(data.cep ?? digits),
        logradouro: data.logradouro ?? '',
        complemento: data.complemento ?? '',
        bairro: data.bairro ?? '',
        cidade: data.localidade ?? '',
        uf: data.uf ?? '',
    };
}
