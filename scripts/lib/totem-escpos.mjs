import { compactTotemCode, scannerTotemCode } from '../totem-order-code.mjs';

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

const formatCpf = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '');
    if (digits.length !== 11) return String(raw || '').trim();
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

/** Pedido reduzido para cupom fisico/tablet — sem itens, valores ou total. */
export function sanitizeOrderForPhysicalReceipt(order, opts = {}) {
    if (!order?.id) return null;
    return {
        id: order.id,
        createdAt: order.createdAt,
        customerName: order.customerName || order.customer_name || '',
        customerPhone: order.customerPhone || order.customer_phone || '',
        customerCpf: order.customerCpf || order.customer_cpf || '',
        totemLabel: order.totemLabel || opts.totemLabel || '',
    };
}

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
    const safeOrder = sanitizeOrderForPhysicalReceipt(order, opts) || order;
    const width = Number(opts.escposLineChars) || 42;
    const unitLabel = safeOrder.totemLabel || opts.totemLabel || 'Ligeirinho Totem';
    const code = compactCode(safeOrder.id);
    const scannerCode = scannerTotemCode(safeOrder.id);

    const divider = () => '-'.repeat(width);

    const ESC = '\x1B';
    const GS = '\x1D';
    const ALIGN_LEFT = ESC + 'a' + '\x00';
    const ALIGN_CENTER = ESC + 'a' + '\x01';

    let out = ESC + '@';
    out += ESC + 'E' + '\x01';

    // ===== Cabecalho (centralizado por hardware) =====
    out += ALIGN_CENTER;
    out += unitLabel.toUpperCase() + '\n';
    out += 'COMPROVANTE DE PEDIDO' + '\n';
    wrapCenter('Apresente no caixa para pagamento', width).forEach((line) => {
        out += line + '\n';
    });
    out += divider() + '\n';
    out += 'CODIGO DO PEDIDO' + '\n';

    // Codigo do pedido em dobro (como o HTML em 16px bold)
    out += '\n';
    out += GS + '!' + '\x11';
    out += `${code}\n`;
    out += GS + '!' + '\x00';
    out += '\n';

    if (scannerCode) {
        out = appendEscPosCode128(out, scannerCode, { height: 110, moduleWidth: 3, hri: false });
        out += '\n';
        out += scannerCode + '\n';
        out += '\n';
    }

    out += formatDateTime(safeOrder.createdAt) + '\n';

    // ===== Corpo (alinhado a esquerda) — sem lista de produtos, pagamento ou total =====
    out += ALIGN_LEFT;
    out += divider() + '\n';

    const customerName = String(safeOrder.customerName || '').trim();
    const customerPhone = String(safeOrder.customerPhone || '').trim();
    const customerCpf = formatCpf(safeOrder.customerCpf);
    if (customerName) {
        out += padLine('Cliente', customerName.slice(0, Math.max(8, width - 10)), width) + '\n';
    }
    if (customerPhone) {
        out += padLine('Telefone', customerPhone.slice(0, Math.max(8, width - 11)), width) + '\n';
    }
    if (customerCpf) {
        out += padLine('CPF', customerCpf, width) + '\n';
    }
    if (customerName || customerPhone || customerCpf) {
        out += divider() + '\n';
    }

    out += divider() + '\n';

    // ===== Rodape (centralizado por hardware) =====
    out += ALIGN_CENTER;
    wrapCenter('Dirija-se ao caixa e passe o codigo de barras no leitor do PDV.', width).forEach(
        (line) => {
            out += line + '\n';
        },
    );
    out += '\n';
    out += 'Ligeirinho Parceiros' + '\n';
    out += '\n';

    out += ESC + 'E' + '\x00';
    out += ALIGN_LEFT;
    out += '\n\n';
    out += GS + 'V' + '\x00';

    return Buffer.from(out, 'binary');
}
