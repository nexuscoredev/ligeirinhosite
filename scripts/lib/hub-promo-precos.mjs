/** Alinha preços promocionais ao Hub (valor_venda_desc / valor_venda_original). */

const CAIXA_UNIDADES = new Set(['CX', 'FD', 'PC', 'FARDO', 'PL', 'PALLET', 'PAL', 'PLT']);

export function fatorEmbalagemValido(fator) {
    const f = Number(fator);
    return Number.isFinite(f) && f > 0 ? f : 1;
}

export function precoEmbalagem(precoUnitario, fator) {
    return Math.round(Number(precoUnitario) * fatorEmbalagemValido(fator) * 100) / 100;
}

export function unidadeUsaPrecoEmbalagem(unidade, fator) {
    const u = String(unidade || '').trim().toUpperCase();
    if (CAIXA_UNIDADES.has(u)) return true;
    return fatorEmbalagemValido(fator) > 1;
}

/**
 * Converte preço unitário da tabela PROMOCAO para valor de venda da embalagem (caixa/pallet).
 * @param {{ preco_original?: number, preco_promo?: number, unidade?: string }} row
 * @param {{ preco_base?: number, preco_promo?: number, unidade?: string, fator_multiplicacao?: number } | null} meta
 */
export function resolvePromoVitrinePrices(row, meta = null) {
    const unidade = String(meta?.unidade || row.unidade || '').trim().toUpperCase();
    const fator = fatorEmbalagemValido(meta?.fator_multiplicacao);
    const precoPromoUnit = Number(meta?.preco_promo ?? row.preco_promo);
    const precoBaseCatalogo = Number(meta?.preco_base ?? row.preco_original);

    let promoPrice = Number.isFinite(precoPromoUnit) ? precoPromoUnit : null;
    let originalPrice = Number.isFinite(precoBaseCatalogo) ? precoBaseCatalogo : Number(row.preco_original);

    if (unidadeUsaPrecoEmbalagem(unidade, fator) && promoPrice != null) {
        promoPrice = precoEmbalagem(promoPrice, fator);
    }

    if (!Number.isFinite(originalPrice)) originalPrice = null;
    if (!Number.isFinite(promoPrice)) promoPrice = null;

    const discountPct =
        originalPrice > 0 && promoPrice != null && promoPrice < originalPrice
            ? Math.max(0, Math.round((1 - promoPrice / originalPrice) * 100))
            : 0;

    return {
        originalPrice,
        promoPrice,
        discountPct,
        unidade,
        fatorMultiplicacao: fator,
    };
}
