import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePromoVitrinePrices } from './hub-promo-precos.mjs';

describe('resolvePromoVitrinePrices — PL', () => {
    it('pallet promo = caixas × preço da caixa (unit × UN na CX)', () => {
        const out = resolvePromoVitrinePrices(
            { preco_promo: 2.99 },
            {
                unidade: 'PL',
                fator_multiplicacao: 22,
                fator_caixa_cx: 12,
                preco_base: 900,
                preco_promo: 2.99,
            },
        );
        // 22 × (2,99 × 12) = 22 × 35,88 = 789,36
        assert.equal(out.promoPrice, 789.36);
        assert.equal(out.fatorMultiplicacao, 264);
    });

    it('pallet no detalhe deve bater com caixas × promo CX', () => {
        const cx = resolvePromoVitrinePrices(
            { preco_promo: 3.15 },
            { unidade: 'CX', fator_multiplicacao: 12, preco_base: 45, preco_promo: 3.15 },
        );
        assert.equal(cx.promoPrice, 37.8);
        const pl = resolvePromoVitrinePrices(
            { preco_promo: 2.99 },
            {
                unidade: 'PL',
                fator_multiplicacao: 22,
                fator_caixa_cx: 12,
                preco_base: 900,
                preco_promo: 2.99,
            },
        );
        // Se unit PL ≠ unit CX, totem usa caixas × cx promo no modal
        const palletViaCaixa = Math.round(cx.promoPrice * 22 * 100) / 100;
        assert.equal(palletViaCaixa, 831.6);
        assert.notEqual(pl.promoPrice, palletViaCaixa);
    });

    it('pallet com fator em UN totais (264) normaliza para 22 caixas', () => {
        const out = resolvePromoVitrinePrices(
            { preco_promo: 2.99 },
            {
                unidade: 'PL',
                fator_multiplicacao: 264,
                fator_caixa_cx: 12,
                preco_base: 900,
                preco_promo: 2.99,
            },
        );
        assert.equal(out.promoPrice, 789.36);
        assert.equal(out.fatorMultiplicacao, 264);
        assert.equal(out.fatorCaixasPl, 22);
    });
});
