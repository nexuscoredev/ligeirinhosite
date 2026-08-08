import { hubConfig } from '../hub-auth.mjs';
import {
    clienteUsesPersonalPriceTable,
    resolveClientePriceTableFromPessoaId,
} from '../hub-parceiro.mjs';

const EMPTY_PRICE_META = Object.freeze({
    usesPersonalPriceTable: false,
    tabelaPrecoId: '',
    tabelaPrecoCodigo: '',
    clienteId: '',
});

/** Meta pública de tabela de preço para respostas do Totem (lookup/register). */
export async function resolveTotemCustomerPriceMeta(env, pessoaId) {
    const id = String(pessoaId || '').trim();
    if (!id) return { ...EMPTY_PRICE_META };

    const config = hubConfig(env);
    if (!config.serviceKey) return { ...EMPTY_PRICE_META };

    const meta = await resolveClientePriceTableFromPessoaId(config, id);
    if (!meta?.clienteId || !clienteUsesPersonalPriceTable(meta)) {
        return {
            ...EMPTY_PRICE_META,
            clienteId: meta?.clienteId || '',
        };
    }

    return {
        usesPersonalPriceTable: true,
        tabelaPrecoId: meta.tabelaPrecoId || '',
        tabelaPrecoCodigo: meta.tabelaPrecoCodigo || '',
        clienteId: meta.clienteId || '',
    };
}

export function attachPriceMetaToCustomer(customer, priceMeta) {
    if (!customer || typeof customer !== 'object') return customer;
    return {
        ...customer,
        usesPersonalPriceTable: Boolean(priceMeta?.usesPersonalPriceTable),
        tabelaPrecoId: priceMeta?.tabelaPrecoId || '',
        tabelaPrecoCodigo: priceMeta?.tabelaPrecoCodigo || '',
        clienteId: priceMeta?.clienteId || '',
    };
}
