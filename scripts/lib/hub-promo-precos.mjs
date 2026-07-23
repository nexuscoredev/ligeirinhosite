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
    if (u === 'PL' || u === 'PLT' || u === 'PALLET' || u === 'PAL') return true;
    if (u === 'CX' || u === 'FD' || u === 'PC' || u === 'FARDO') return true;
    return fatorEmbalagemValido(fator) > 1;
}

/** PL: caixas no pallet × UN por caixa (CX). */
export function fatorTotalPl(caixas, fatorCaixa) {
    const c = fatorEmbalagemValido(caixas);
    const cx = fatorEmbalagemValido(fatorCaixa);
    return c * cx;
}

/**
 * Hub pode enviar PL como caixas (22) ou UN totais (264 = 22×12).
 * Quando divisível pelo UN/CX, converte para número de caixas.
 */
export function caixasNoPallet(fatorPl, fatorCaixa) {
    const pl = fatorEmbalagemValido(fatorPl);
    const cx = fatorEmbalagemValido(fatorCaixa);
    if (cx > 1 && pl >= cx && pl % cx === 0) return pl / cx;
    return pl;
}

/**
 * Converte preço unitário da tabela PROMOCAO para valor de venda da embalagem (caixa/pallet).
 * PL: caixas × preço da caixa (unitário × UN na CX), não caixas × UN isoladas.
 * @param {{ preco_original?: number, preco_promo?: number, unidade?: string }} row
 * @param {{ preco_base?: number, preco_promo?: number, unidade?: string, fator_multiplicacao?: number, fator_caixa_cx?: number } | null} meta
 */
export function resolvePromoVitrinePrices(row, meta = null) {
    const unidade = String(meta?.unidade || row.unidade || '').trim().toUpperCase();
    const fatorCx = fatorEmbalagemValido(meta?.fator_caixa_cx);
    const caixasPl =
        unidade === 'PL'
            ? caixasNoPallet(meta?.fator_multiplicacao, fatorCx)
            : fatorEmbalagemValido(meta?.fator_multiplicacao);
    const fatorCxEmbalagem = unidade === 'PL' ? fatorCx : caixasPl;
    const precoPromoUnit = Number(meta?.preco_promo ?? row.preco_promo);
    const precoBaseCatalogo = Number(meta?.preco_base ?? row.preco_original);

    let promoPrice = Number.isFinite(precoPromoUnit) ? precoPromoUnit : null;
    let originalPrice = Number.isFinite(precoBaseCatalogo) ? precoBaseCatalogo : Number(row.preco_original);

    if (unidade === 'PL') {
        if (promoPrice != null) {
            if (fatorCx > 1) {
                promoPrice = Math.round(precoEmbalagem(promoPrice, fatorCx) * caixasPl * 100) / 100;
            } else {
                promoPrice = precoEmbalagem(promoPrice, caixasPl);
            }
        }
    } else if (unidadeUsaPrecoEmbalagem(unidade, caixasPl) && promoPrice != null) {
        promoPrice = precoEmbalagem(promoPrice, caixasPl);
    }

    if (!Number.isFinite(originalPrice)) originalPrice = null;
    if (!Number.isFinite(promoPrice)) promoPrice = null;

    const discountPct =
        originalPrice > 0 && promoPrice != null && promoPrice < originalPrice
            ? Math.max(0, Math.round((1 - promoPrice / originalPrice) * 100))
            : 0;

    const fatorMultiplicacao =
        unidade === 'PL' && fatorCx > 1 ? fatorTotalPl(caixasPl, fatorCx) : caixasPl;

    return {
        originalPrice,
        promoPrice,
        discountPct,
        unidade,
        fatorMultiplicacao,
        fatorCaixasPl: unidade === 'PL' ? caixasPl : null,
        fatorUnCx: unidade === 'PL' && fatorCx > 1 ? fatorCx : null,
    };
}
