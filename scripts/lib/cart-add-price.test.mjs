import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildCatalogPriceLookup,
    resolveAddToCartPrice,
    simulateAddProduct,
    simulateApplyOrderPriceTable,
    simulateRemoveProduct,
} from './cart-add-price.mjs';

describe('cart-add-price — troca de tabela e re-adicionar', () => {
    const padraoLine = {
        key: 'coca-cx::caixa',
        id: 'coca-cx',
        hubId: 'hub-coca',
        price: 100,
        name: 'Coca CX',
    };
    const tableLookup = new Map([
        ['coca-cx', 101],
        ['hub-coca', 101],
    ]);

    it('sem tabela: re-adicionar usa preço do catálogo PADRAO', () => {
        const cart = {};
        simulateAddProduct(cart, padraoLine, {});
        simulateRemoveProduct(cart, padraoLine.key);
        const r = simulateAddProduct(cart, padraoLine, {});
        assert.equal(r.price, 100);
    });

    it('após trocar tabela: item existente recebe preço da tabela', () => {
        const cart = {};
        simulateAddProduct(cart, padraoLine, {});
        simulateApplyOrderPriceTable(cart, tableLookup, { unlockPrices: true });
        assert.equal(cart[padraoLine.key].price, 101);
    });

    it('após trocar tabela: re-adicionar mantém preço da tabela (não PADRAO)', () => {
        const cart = {};
        simulateAddProduct(cart, padraoLine, {});
        simulateApplyOrderPriceTable(cart, tableLookup, { unlockPrices: true });
        simulateRemoveProduct(cart, padraoLine.key);
        const r = simulateAddProduct(cart, padraoLine, {
            orderTabelaPrecoId: 'tabela-1pct',
            tablePriceLookupId: 'tabela-1pct',
            tablePriceLookup: tableLookup,
        });
        assert.equal(r.price, 101, 'deve usar preço da tabela 1%, não PADRAO');
    });

    it('sem lookup de tabela após troca: re-adicionar cai no PADRAO (regressão conhecida)', () => {
        const cart = {};
        simulateAddProduct(cart, padraoLine, {});
        simulateApplyOrderPriceTable(cart, tableLookup, { unlockPrices: true });
        simulateRemoveProduct(cart, padraoLine.key);
        const r = simulateAddProduct(cart, padraoLine, {});
        assert.equal(r.price, 100, 'sem contexto de tabela, usa catálogo');
    });
});

describe('cart-add-price — edição de pedido', () => {
    const line = {
        key: 'prod-1::caixa',
        id: 'prod-1',
        hubId: 'hub-1',
        price: 50,
    };
    const snapshot = new Map([['prod-1', 45], ['hub-1', 45]]);

    it('re-adicionar durante edição restaura preço original do pedido', () => {
        const cart = {};
        simulateAddProduct(cart, { ...line, price: 45 }, {
            editing: true,
            editPriceSnapshot: snapshot,
        });
        simulateRemoveProduct(cart, line.key);
        const r = simulateAddProduct(cart, { ...line, price: 50 }, {
            editing: true,
            editPriceSnapshot: snapshot,
        });
        assert.equal(r.price, 45);
        assert.equal(r.priceLocked, true);
    });

    it('incrementar qty em edição não altera preço bloqueado', () => {
        const cart = {
            [line.key]: { ...line, price: 45, qty: 1, priceLocked: true },
        };
        const r = simulateAddProduct(cart, { ...line, price: 99 }, {
            editing: true,
            editPriceSnapshot: snapshot,
        });
        assert.equal(r.price, 45);
        assert.equal(cart[line.key].qty, 2);
    });
});

describe('buildCatalogPriceLookup', () => {
    it('indexa id e hubId', () => {
        const map = buildCatalogPriceLookup({
            categories: [{ products: [{ id: 'a', hubId: 'h1', price: 12.5 }] }],
        });
        assert.equal(map.get('a'), 12.5);
        assert.equal(map.get('h1'), 12.5);
    });
});
