import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePromoVitrinePrices } from './hub-promo-precos.mjs';

describe('resolvePromoVitrinePrices — PL', () => {
    it('pallet promo = caixas × (unit × UN na CX)', () => {
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
        // 264 × (2,99 × 12) = 9.472,32
        assert.equal(out.promoPrice, 9472.32);
        assert.equal(out.fatorMultiplicacao, 3168);
        assert.equal(out.fatorCaixasPl, 264);
    });

    it('pallet no detalhe = caixas × promo CX', () => {
        const cx = resolvePromoVitrinePrices(
            { preco_promo: 3.15 },
            { unidade: 'CX', fator_multiplicacao: 12, preco_base: 45, preco_promo: 3.15 },
        );
        assert.equal(cx.promoPrice, 37.8);
        const caixas = 264;
        const palletViaCaixa = Math.round(cx.promoPrice * caixas * 100) / 100;
        assert.equal(palletViaCaixa, 9979.2);
    });

    it('nao usa unit × fator como se fator fosse UN avulsas', () => {
        const out = resolvePromoVitrinePrices(
            { preco_promo: 2.99 },
            {
                unidade: 'PL',
                fator_multiplicacao: 264,
                fator_caixa_cx: 12,
                preco_promo: 2.99,
            },
        );
        assert.notEqual(out.promoPrice, Math.round(2.99 * 264 * 100) / 100);
    });
});
