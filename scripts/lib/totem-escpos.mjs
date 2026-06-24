const methodLabel = (m) => {
    const key = String(m || '').toLowerCase();
    if (key === 'pix') return 'Pix';
    if (key === 'cartao') return 'Cartao debito/credito';
    return 'Dinheiro';
};

const formatPrice = (value) =>
    Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const TOTEM_CODE_HEX_LENGTH = 4;

const compactCode = (id) => {
    const raw = String(id || '')
        .replace(/[^a-fA-F0-9]/gi, '')
        .slice(0, TOTEM_CODE_HEX_LENGTH)
        .toUpperCase();
    return raw ? `PED ${raw}` : '';
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
    const lines = [];

    const center = (s) => {
        const t = String(s);
        if (t.length >= width) return t.slice(0, width);
        const pad = Math.floor((width - t.length) / 2);
        return ' '.repeat(pad) + t;
    };

    const divider = () => '-'.repeat(width);

    lines.push(center(unitLabel.toUpperCase()));
    lines.push(center('COMPROVANTE DE PEDIDO'));
    lines.push(center('Apresente no caixa'));
    lines.push(divider());
    lines.push(center('CODIGO DO PEDIDO'));
    lines.push(center(code));
    lines.push(center(formatDateTime(order.createdAt)));
    lines.push(divider());

    (order.items || []).forEach((item) => {
        const qty = Number(item.qty) || 1;
        const lineTotal = formatPrice(Number(item.price) * qty);
        const name = String(item.name || '').trim();
        lines.push(`${qty}x ${name}`.slice(0, width));
        lines.push(padLine('', lineTotal, width));
    });

    lines.push(divider());
    lines.push(padLine('Pagamento', methodLabel(order.paymentMethod), width));
    lines.push(padLine('TOTAL', formatPrice(order.total), width));
    lines.push(divider());
    lines.push(center('Ligeirinho Parceiros'));
    lines.push('');

    const ESC = '\x1B';
    const GS = '\x1D';
    let out = ESC + '@';
    out += ESC + 'E' + '\x01';
    out += ESC + 'a' + '\x01';
    lines.forEach((line) => {
        out += line + '\n';
    });
    out += ESC + 'a' + '\x00';
    out += ESC + 'E' + '\x00';
    out += '\n\n';
    out += GS + 'V' + '\x00';

    return Buffer.from(out, 'binary');
}
