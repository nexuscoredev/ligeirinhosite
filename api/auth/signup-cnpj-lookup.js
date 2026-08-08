import { hubConfig } from '../../scripts/hub-auth.mjs';
import {
    fetchPessoaByCnpjDigits,
    formatCnpj,
    isValidCnpj,
    normalizeDocDigits,
} from '../../scripts/hub-parceiro.mjs';
import { consultarEmpresaPorCnpj } from '../../scripts/lib/consultar-publicas.mjs';

export const config = { maxDuration: 30 };

function maskPhoneBr(raw) {
    const digits = String(raw || '').replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function buildPayload({ digits, company, phone, email, source }) {
    return {
        cnpj: formatCnpj(digits),
        company: String(company || '').trim(),
        phone: phone ? maskPhoneBr(phone) : '',
        email: String(email || '').trim().toLowerCase(),
        source,
    };
}

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const digits = normalizeDocDigits(req.body?.cnpj || '');
        if (!isValidCnpj(digits)) {
            return res.status(400).json({ error: 'Informe um CNPJ válido com 14 dígitos.' });
        }

        const config = hubConfig(process.env);
        if (config.serviceKey) {
            const pessoa = await fetchPessoaByCnpjDigits(config, digits);
            if (pessoa) {
                return res.status(200).json(
                    buildPayload({
                        digits,
                        company: pessoa.nome_fantasia || pessoa.nome || '',
                        phone: pessoa.telefone || '',
                        email: pessoa.email || '',
                        source: 'hub',
                    }),
                );
            }
        }

        const empresa = await consultarEmpresaPorCnpj(digits);
        if (empresa) {
            return res.status(200).json(
                buildPayload({
                    digits,
                    company: empresa.nome_fantasia || empresa.razao_social || '',
                    phone: empresa.ddd_telefone_1 || '',
                    email: empresa.email || '',
                    source: 'receita',
                }),
            );
        }

        return res.status(404).json({ error: 'CNPJ não encontrado. Preencha os dados manualmente.' });
    } catch (err) {
        console.error('[api/auth/signup-cnpj-lookup]', err);
        return res.status(502).json({
            error: 'Não foi possível consultar o CNPJ agora. Preencha os dados manualmente.',
        });
    }
}
