import assert from 'node:assert/strict';
import { clienteUsesPersonalPriceTable, tabelaPrecoMetaEhPadrao } from './hub-parceiro.mjs';

assert.equal(tabelaPrecoMetaEhPadrao({ padrao: true, codigo: 'VIP' }, null), true);
assert.equal(tabelaPrecoMetaEhPadrao({ padrao: false, codigo: 'PADRAO' }, null), true);
assert.equal(tabelaPrecoMetaEhPadrao(null, 'padrao'), true);
assert.equal(tabelaPrecoMetaEhPadrao(null, 'tabela padrão'), true);
assert.equal(tabelaPrecoMetaEhPadrao({ padrao: false, codigo: 'ATACADO' }, null), false);

assert.equal(clienteUsesPersonalPriceTable({ usesPersonalPriceTable: false, tabelaPrecoId: 'uuid-padrao' }), false);
assert.equal(clienteUsesPersonalPriceTable({ usesPersonalPriceTable: true }), true);
assert.equal(clienteUsesPersonalPriceTable({ tabelaPrecoCodigo: 'ATACADO' }), true);
assert.equal(clienteUsesPersonalPriceTable({ tabelaPrecoCodigo: 'padrao' }), false);
assert.equal(clienteUsesPersonalPriceTable(null), false);

console.log('test-tabela-preco-padrao: ok');
