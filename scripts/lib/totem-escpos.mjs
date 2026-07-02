import { compactTotemCode, scannerTotemCode } from '../totem-order-code.mjs';
import { resolveOrderSplits, paymentMethodLabelShort } from './payment-splits.mjs';

const methodLabel = paymentMethodLabelShort;

const formatPrice = (value) =>
    Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const compactCode = compactTotemCode;

const appendEscPosCode128 = (out, text) => {
    const data = `{B${String(text || '')}`;
    const GS = '\x1D';
    out += GS + 'h' + '\x50';
    out += GS + 'w' + '\x02';
    out += GS + 'H' + '\x02';
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

export function buildEscPosReceipt(order, opts = {}) {
    const width = Number(opts.escposLineChars) || 42;
    const unitLabel = order.totemLabel || opts.totemLabel || 'Ligeirinho Totem';
    const code = compactCode(order.id);
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
    headLines.push(center('Apresente no caixa'));
    headLines.push(divider());
    headLines.push(center('CODIGO DO PEDIDO'));
    headLines.push(center(code));

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
    if (splits.length >= 2) {
        splits.forEach((item) => {
            tailLines.push(padLine(methodLabel(item.method), formatPrice(item.amount), width));
        });
    } else {
        tailLines.push(padLine(methodLabel(order.paymentMethod), formatPrice(order.total), width));
    }
    tailLines.push(padLine('TOTAL', formatPrice(order.total), width));
    tailLines.push(divider());
    tailLines.push(center('Ligeirinho Parceiros'));
    tailLines.push('');

    const scannerCode = scannerTotemCode(order.id);
    const ESC = '\x1B';
    const GS = '\x1D';
    let out = ESC + '@';
    out += ESC + 'E' + '\x01';
    out += ESC + 'a' + '\x01';
    headLines.forEach((line) => {
        out += line + '\n';
    });
    if (scannerCode) {
        out += '\n';
        out = appendEscPosCode128(out, scannerCode);
        out += '\n';
    }
    tailLines.forEach((line) => {
        out += line + '\n';
    });
    out += ESC + 'a' + '\x00';
    out += ESC + 'E' + '\x00';
    out += '\n\n';
    out += GS + 'V' + '\x00';

    return Buffer.from(out, 'binary');
}
