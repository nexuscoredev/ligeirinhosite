/**
 * Salva o JSON do catálogo (UTF-8) a partir da resposta CDP do navegador.
 * Uso: node scripts/export-catalogo.js <caminho-cdp-response.json>
 */
const fs = require('fs');
const path = require('path');

const input = process.argv[2];
if (!input) {
    console.error('Informe o arquivo CDP com o JSON do catálogo.');
    process.exit(1);
}

const raw = fs.readFileSync(input, 'utf8');
const parsed = JSON.parse(raw);
const catalog = JSON.parse(parsed.result.value);
const out = path.join(__dirname, '..', 'data', 'catalogo.json');

fs.writeFileSync(out, JSON.stringify(catalog, null, 2), 'utf8');
console.log(`Salvo ${catalog.totalProducts} produtos em ${out}`);
