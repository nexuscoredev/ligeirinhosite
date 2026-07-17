import { compactTotemCode, scannerTotemCode } from '../totem-order-code.mjs';
import {
    resolveOrderSplits,
    paymentMethodLabelShort,
    computeCashChange,
} from './payment-splits.mjs';

const methodLabel = paymentMethodLabelShort;

const formatPrice = (value) =>
    Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const compactCode = compactTotemCode;

/** Code 128 alinhado ao cupom HTML (barra alta e larga para o PDV). */
const appendEscPosCode128 = (out, text, opts = {}) => {
    const data = `{B${String(text || '')}`;
    const GS = '\x1D';
    const height = Number(opts.height) || 110;
    const width = Number(opts.moduleWidth) || 3;
    const hri = opts.hri === false ? 0 : 2;
    out += GS + 'h' + String.fromCharCode(Math.min(255, Math.max(1, height)));
    out += GS + 'w' + String.fromCharCode(Math.min(6, Math.max(1, width)));
    out += GS + 'H' + String.fromCharCode(hri);
    out += GS + 'k' + '\x49' + String.fromCharCode(data.length) + data;
    return out;
};

const formatDateTime = (iso) => {
    const d = iso ? new Date(iso) : new Date();
    if (Number.isNaN(d.getTime())) return new Date().toLocaleString('pt-BR');
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const padLine = (left, right, width) => {
    const l = String(left);
    const r = String(right);
    const spaces = Math.max(1, width - l.length - r.length);
    return l + ' '.repeat(spaces) + r;
};

const wrapCenter = (text, width) => {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const lines = [];
    let current = '';
    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length <= width) {
            current = next;
            continue;
        }
        if (current) lines.push(current);
        current = word.length > width ? word.slice(0, width) : word;
    }
    if (current) lines.push(current);
    return lines;
};

export function buildEscPosReceipt(order, opts = {}) {
    const width = Number(opts.escposLineChars) || 42;
    const unitLabel = order.totemLabel || opts.totemLabel || 'Ligeirinho Totem';
    const code = compactCode(order.id);
    const scannerCode = scannerTotemCode(order.id);
    const headLines = [];
    const tailLines = [];

    const center = (s) => {
        const t = String(s);
        if (t.length >= width) return t.slice(0, width);
        const pad = Math.floor((width - t.length) / 2);
        return ' '.repeat(pad) + t;
    };

    const divider = () => '-'.repeat(width);

    headLines.push(center(unitLabel.toUpperCase()));
    headLines.push(center('COMPROVANTE DE PEDIDO'));
    wrapCenter('Apresente no caixa para pagamento', width).forEach((line) => {
        headLines.push(center(line));
    });
    headLines.push(divider());
    headLines.push(center('CODIGO DO PEDIDO'));

    tailLines.push(center(formatDateTime(order.createdAt)));
    tailLines.push(divider());

    const customerName = String(order.customerName || '').trim();
    const customerPhone = String(order.customerPhone || '').trim();
    if (customerName) {
        tailLines.push(padLine('Cliente', customerName.slice(0, Math.max(8, width - 10)), width));
    }
    if (customerPhone) {
        tailLines.push(padLine('Telefone', customerPhone.slice(0, Math.max(8, width - 11)), width));
    }
    if (customerName || customerPhone) {
        tailLines.push(divider());
    }

    (order.items || []).forEach((item) => {
        const qty = Number(item.qty) || 1;
        const lineTotal = formatPrice(Number(item.price) * qty);
        const name = String(item.name || '').trim();
        tailLines.push(`${qty}x ${name}`.slice(0, width));
        tailLines.push(padLine('', lineTotal, width));
    });

    tailLines.push(divider());
    const splits = resolveOrderSplits(order);
    const isCashTender =
        splits.length === 1 && String(splits[0]?.method || '').toLowerCase() === 'dinheiro';
    if (splits.length >= 2 || isCashTender) {
        splits.forEach((item) => {
            tailLines.push(padLine(methodLabel(item.method), formatPrice(item.amount), width));
        });
        const troco = computeCashChange(splits, order.total);
        if (troco > 0.009) {
            tailLines.push(padLine('Troco', formatPrice(troco), width));
        }
    } else {
        // Igual ao cupom HTML: sempre mostra a forma (padrao Dinheiro se ainda nao escolhida)
        tailLines.push(padLine(methodLabel(order.paymentMethod), formatPrice(order.total), width));
    }
    tailLines.push(padLine('Total', formatPrice(order.total), width));
    tailLines.push(divider());
    wrapCenter('Dirija-se ao caixa e passe o codigo de barras no leitor do PDV.', width).forEach(
        (line) => {
            tailLines.push(center(line));
        },
    );
    tailLines.push('');
    tailLines.push(center('Ligeirinho Parceiros'));
    tailLines.push('');

    const ESC = '\x1B';
    const GS = '\x1D';
    let out = ESC + '@';
    out += ESC + 'a' + '\x01';
    out += ESC + 'E' + '\x01';
    headLines.forEach((line) => {
        out += line + '\n';
    });

    // Código do pedido em dobro (como o HTML em 16px bold)
    out += '\n';
    out += GS + '!' + '\x11';
    out += `${code}\n`;
    out += GS + '!' + '\x00';
    out += '\n';

    if (scannerCode) {
        out = appendEscPosCode128(out, scannerCode, { height: 110, moduleWidth: 3, hri: false });
        out += '\n';
        out += center(scannerCode) + '\n';
        out += '\n';
    }

    tailLines.forEach((line) => {
        out += line + '\n';
    });
    out += ESC + 'E' + '\x00';
    out += ESC + 'a' + '\x00';
    out += '\n\n';
    out += GS + 'V' + '\x00';

    return Buffer.from(out, 'binary');
}
