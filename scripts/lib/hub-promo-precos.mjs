/** Alinha preços promocionais e tabelas percentuais ao Hub. */

const CAIXA_UNIDADES = new Set(['CX', 'FD', 'PC', 'FARDO', 'PL', 'PALLET', 'PAL', 'PLT']);
const DECIMAIS_PRECO_UNITARIO = 2;
const EPS = 1e-9;

export function fatorEmbalagemValido(fator) {
    const f = Number(fator);
    return Number.isFinite(f) && f > 0 ? f : 1;
}

export function precoEmbalagem(precoUnitario, fator) {
    return Math.round(Number(precoUnitario) * fatorEmbalagemValido(fator) * 100) / 100;
}

export function normalizarUnidadeProduto(unidade) {
    const raw = String(unidade || 'UN').trim().toUpperCase();
    if (['UN', 'CX', 'PL'].includes(raw)) return raw;
    if (['PC', 'FARDO', 'FD', 'PCT', 'PCTO', 'PACOTE', 'CAIXA'].includes(raw)) return 'CX';
    if (['PLT', 'PALLET', 'PAL'].includes(raw)) return 'PL';
    return 'UN';
}

export function unidadeExigeQuantidadeEmbalagem(unidade) {
    const u = normalizarUnidadeProduto(unidade);
    return u === 'CX' || u === 'PL';
}

function precoTemMaisCasasQue(valor, casas) {
    if (!Number.isFinite(valor)) return false;
    const f = 10 ** casas;
    const escalado = valor * f;
    return Math.abs(escalado - Math.round(escalado)) > EPS;
}

/** Mesma regra do Hub (`arredondarPrecoParaCima`). */
export function arredondarPrecoParaCima(valor, casas = DECIMAIS_PRECO_UNITARIO) {
    if (!Number.isFinite(valor)) return 0;
    const f = 10 ** casas;
    if (!precoTemMaisCasasQue(valor, casas)) {
        return Math.round(valor * f) / f;
    }
    return Math.ceil(valor * f - EPS) / f;
}

/** Preço unitário = valor da embalagem ÷ quantidade (arredonda para cima se dízima). */
export function precoUnitarioDeEmbalagem(precoEmb, fator) {
    const f = fatorEmbalagemValido(fator);
    const unitario = Number(precoEmb) / f;
    if (!Number.isFinite(unitario)) return 0;
    return arredondarPrecoParaCima(unitario, DECIMAIS_PRECO_UNITARIO);
}

export function fatorTotalUnidadesEmbalagem(produto) {
    const u = normalizarUnidadeProduto(produto?.unidade);
    const fator = fatorEmbalagemValido(produto?.fator_multiplicacao);
    if (u === 'PL') {
        const cx = Number(produto?.fator_caixa_cx);
        const fCx = Number.isFinite(cx) && cx > 0 ? cx : 1;
        return fator * fCx;
    }
    return fator;
}

export function produtoUsaPrecoEmbalagem(produto) {
    const base = String(produto?.produto_base_id || '').trim();
    return (
        unidadeExigeQuantidadeEmbalagem(produto?.unidade) ||
        Boolean(base && produto?.id && base !== produto.id)
    );
}

/** Cadastro CX/PL: `preco_base`/`valor_custo` na escala da embalagem → unitário UN. */
export function precoBaseUnitarioDoProduto(produto, bruto) {
    const valor = Number(bruto);
    if (!Number.isFinite(valor)) return 0;
    if (!produtoUsaPrecoEmbalagem(produto)) return valor;
    return precoUnitarioDeEmbalagem(valor, fatorTotalUnidadesEmbalagem(produto));
}

/** Unitário da tabela → preço de vitrine (embalagem para CX/PL). */
export function catalogPriceFromUnitPrice(produto, unitPrice) {
    const unit = Number(unitPrice);
    if (!Number.isFinite(unit)) return 0;
    if (!produtoUsaPrecoEmbalagem(produto)) return unit;
    return precoEmbalagem(unit, fatorTotalUnidadesEmbalagem(produto));
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
 * Converte preço unitário da tabela PROMOCAO para valor de venda da embalagem (caixa/pallet).
 * PL: caixas no pallet × preço da caixa (unitário × UN na CX).
 * O fator PL no Hub é a quantidade de caixas (ex.: 264), não UN totais.
 * @param {{ preco_original?: number, preco_promo?: number, unidade?: string }} row
 * @param {{ preco_base?: number, preco_promo?: number, unidade?: string, fator_multiplicacao?: number, fator_caixa_cx?: number } | null} meta
 */
export function resolvePromoVitrinePrices(row, meta = null) {
    const unidade = String(meta?.unidade || row.unidade || '').trim().toUpperCase();
    const caixasPl = fatorEmbalagemValido(meta?.fator_multiplicacao);
    const fatorCx = fatorEmbalagemValido(meta?.fator_caixa_cx);
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
        if (originalPrice != null && Number.isFinite(originalPrice)) {
            if (fatorCx > 1) {
                originalPrice = Math.round(precoEmbalagem(originalPrice, fatorCx) * caixasPl * 100) / 100;
            } else if (caixasPl > 1) {
                originalPrice = precoEmbalagem(originalPrice, caixasPl);
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
