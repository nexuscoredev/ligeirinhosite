(function () {
    const ISSUER = {
        razaoSocial: 'LIGEIRINHO COMERCIO DE BEBIDAS LTDA',
        cnpj: '45.028.186/0001-25',
        ie: '134065480113',
        endereco:
            'ESTRADA DO CAMPO LIMPO, N 2083, Bairro: VILA PREL, Cidade: SAO PAULO - SP-ANEXO 2093 FUNDOS.',
    };

    const DISTRIBUIDORA_CNPJ = '45028186000125';
    const DISTRIBUIDORA_PHONE = '11970924909';

    const DELIVERY_FEE_CART_KEY = 'taxa-entrega-hr';
    const DELIVERY_FEE_SKU = '1045';
    const DELIVERY_FEE_HUB_PRODUCT_ID = '59af880d-0c08-4827-b2de-7ea5b10a6324';

    const esc = (value) =>
        String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const digits = (value) => String(value || '').replace(/\D/g, '');

    const normalizePhone = (value) => {
        const raw = digits(value);
        return raw.startsWith('55') && raw.length >= 12 ? raw.slice(2) : raw;
    };

    const isDeliveryFeeLineItem = (item) => {
        if (!item) return false;
        if (item.isDeliveryFee === true) return true;
        const id = String(item.id || item.cartKey || '').toLowerCase();
        const sku = String(item.sku || '').trim();
        const hubId = String(item.hubId || item.hubProductId || '').toLowerCase();
        return (
            id === DELIVERY_FEE_CART_KEY ||
            sku === DELIVERY_FEE_SKU ||
            hubId === DELIVERY_FEE_HUB_PRODUCT_ID.toLowerCase()
        );
    };

    const formatCnpj = (value) => {
        const raw = digits(value);
        if (raw.length !== 14) return value || '';
        return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12)}`;
    };

    const formatPhoneDisplay = (value) => {
        const local = normalizePhone(value);
        if (local.length === 11) {
            return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
        }
        if (local.length === 10) {
            return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
        }
        return value || '';
    };

    const formatQty = (value) =>
        Number(value || 0).toLocaleString('pt-BR', {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3,
        });

    const formatMoney = (value) =>
        Number(value || 0).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

    const formatDateTime = (value) => {
        const date = value ? new Date(value) : new Date();
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const resolveUnit = (item) => {
        const pack = String(item.packType || '').toLowerCase();
        if (pack === 'caixa' || pack === 'cx') return 'CX';
        if (pack === 'pallet' || pack === 'pl') return 'PL';
        return 'UN';
    };

    const resolveOperator = (session) => {
        const auth = window.LigeirinhoAuth;
        const name = String(session?.name || '').trim();
        if (name) return name.toUpperCase();
        const first = auth?.firstName?.(session);
        return first ? String(first).toUpperCase() : 'OPERADOR';
    };

    const resolveDestinatario = (order, session) => {
        const name =
            String(order?.customerName || '').trim() ||
            String(session?.razaoSocial || '').trim() ||
            String(session?.name || '').trim() ||
            '—';
        const cnpj =
            formatCnpj(session?.cnpj || session?.login) ||
            (order?.customerCpf ? formatCnpj(order.customerCpf) : '');
        const phone = formatPhoneDisplay(order?.customerPhone || session?.phone);
        const address = String(order?.address || '').trim();
        return { name: name.toUpperCase(), cnpj, phone, address };
    };

    const buildLineRows = (items) => {
        const rows = (items || []).filter((item) => !isDeliveryFeeLineItem(item));
        return rows.map((item, index) => {
            const qty = Number(item.qty) || 1;
            const unitPrice = Number(item.price) || 0;
            const original = Number(item.originalPrice) || unitPrice;
            const subtotal = original * qty;
            const discount = Math.max(0, subtotal - unitPrice * qty);
            const total = unitPrice * qty;
            const code = String(item.sku || item.hubId || item.id || '—').trim() || '—';
            return {
                index: index + 1,
                code,
                name: String(item.name || '—').toUpperCase(),
                unit: resolveUnit(item),
                qty,
                unitPrice,
                subtotal,
                discount,
                total,
            };
        });
    };

    const buildDavHtml = (order, tracking, session) => {
        const origin = window.location.origin || '';
        const cssHref = `${origin}/css/order-dav-print.css`;
        const logoSrc = `${origin}/img/ligeirinhologo.png`;
        const lines = buildLineRows(order?.items);
        const qtyTotal = lines.reduce((sum, line) => sum + line.qty, 0);
        const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
        const discountTotal = lines.reduce((sum, line) => sum + line.discount, 0);
        const total = Number(order?.total) || lines.reduce((sum, line) => sum + line.total, 0);
        const davNo = tracking?.hubNumero || order?.hubPedidoId || order?.id?.slice(0, 8) || '—';
        const barcodeValue = String(davNo).replace(/[^\dA-Za-z]/g, '') || '0';
        const barcodeSvg = window.LigeirinhoTotemBarcode?.code128Svg?.(barcodeValue, {
            height: 36,
            barWidth: 1.2,
        });
        const dest = resolveDestinatario(order, session);
        const issuedAt = formatDateTime(order?.createdAt || Date.now());
        const operator = resolveOperator(session);

        const itemRows = lines
            .map(
                (line) => `<tr>
<td class="idx">${line.index}</td>
<td>${esc(line.code)}</td>
<td class="desc">${esc(line.name)}</td>
<td class="und">${esc(line.unit)}</td>
<td class="num">${formatQty(line.qty)}</td>
<td class="num">${formatMoney(line.unitPrice)}</td>
<td class="num">${formatMoney(line.subtotal)}</td>
<td class="num">${formatMoney(line.discount)}</td>
<td class="num">${formatMoney(line.total)}</td>
</tr>`,
            )
            .join('');

        return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>DAV ${esc(davNo)}</title>
<link rel="stylesheet" href="${esc(cssHref)}">
<style>
body { margin: 0; background: #fff; }
</style>
</head>
<body>
<div class="dav-doc">
<table class="dav-doc__header">
<tr>
<td class="dav-doc__brand">
<div class="dav-doc__brand-inner">
<img class="dav-doc__logo" src="${esc(logoSrc)}" alt="" width="42" height="42">
<div>
<p class="dav-doc__issuer-name">${esc(ISSUER.razaoSocial)}</p>
<p class="dav-doc__issuer-meta">CNPJ: ${esc(ISSUER.cnpj)}</p>
<p class="dav-doc__issuer-meta">IE: ${esc(ISSUER.ie)}</p>
<p class="dav-doc__issuer-meta">${esc(ISSUER.endereco)}</p>
</div>
</div>
</td>
<td class="dav-doc__meta">
<p class="dav-doc__title">Documento auxiliar de venda - orçamento</p>
<p class="dav-doc__meta-row"><strong>Emissão:</strong> ${esc(issuedAt)}</p>
<p class="dav-doc__meta-row"><strong>Operador:</strong> ${esc(operator)}</p>
<p class="dav-doc__dav-no">DAV ${esc(davNo)}</p>
<div class="dav-doc__barcode">${barcodeSvg || ''}</div>
</td>
</tr>
</table>

<table class="dav-doc__disclaimer">
<tr><td>Não é documento fiscal - não é válido como recibo e como garantia de mercadoria - não comprova pagamento</td></tr>
</table>

<table>
<tr class="dav-doc__section-title"><td colspan="4">Identificação do destinatário</td></tr>
<tr>
<td class="dav-doc__dest-label">Nome / Razão Social</td>
<td class="dav-doc__dest-value" colspan="3">${esc(dest.name)}</td>
</tr>
<tr>
<td class="dav-doc__dest-label">CPF/CNPJ</td>
<td class="dav-doc__dest-value">${esc(dest.cnpj || '—')}</td>
<td class="dav-doc__dest-label">Telefone</td>
<td class="dav-doc__dest-value">${esc(dest.phone || '—')}</td>
</tr>
<tr>
<td class="dav-doc__dest-label">Endereço</td>
<td class="dav-doc__dest-value" colspan="3">${esc(dest.address || '—')}</td>
</tr>
</table>

<table class="dav-doc__items">
<thead>
<tr>
<th>#</th>
<th>Código</th>
<th>Descrição</th>
<th>Und</th>
<th>Quantidade</th>
<th>Unitário</th>
<th>Subtotal</th>
<th>Desconto</th>
<th>Total</th>
</tr>
</thead>
<tbody>
${itemRows || '<tr><td colspan="9" style="text-align:center">Sem itens</td></tr>'}
</tbody>
</table>

<table class="dav-doc__totals">
<tr>
<td>
<table class="dav-doc__totals-wrap">
<tr><td class="label">Quant. Total Itens</td><td class="value">${formatQty(qtyTotal)}</td></tr>
<tr><td class="label">SubTotal</td><td class="value">${formatMoney(subtotal)}</td></tr>
<tr><td class="label">Desconto</td><td class="value">${formatMoney(discountTotal)}</td></tr>
<tr><td class="label">Valor Total</td><td class="value">${formatMoney(total)}</td></tr>
</table>
</td>
</tr>
</table>
</div>
<script>
window.addEventListener('load', function () {
  window.setTimeout(function () {
    window.focus();
    window.print();
  }, 150);
});
<\/script>
</body>
</html>`;
    };

    const isDistribuidoraAccount = (session) => {
        if (!session) return false;
        const cnpj = digits(session.cnpj || session.login);
        const phone = normalizePhone(session.phone);
        return cnpj === DISTRIBUIDORA_CNPJ && phone === DISTRIBUIDORA_PHONE;
    };

    const printOrderDav = async (orderId, session) => {
        const res = await fetch(`/api/orders/get?id=${encodeURIComponent(orderId)}`, {
            headers: { Accept: 'application/json' },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.order) {
            throw new Error(data.error || 'Não foi possível carregar o pedido para impressão.');
        }

        const html = buildDavHtml(data.order, data.tracking || {}, session);
        const printWin = window.open('', '_blank', 'noopener,noreferrer,width=900,height=720');
        if (!printWin) {
            throw new Error('Permita pop-ups neste site para imprimir o DAV.');
        }
        printWin.document.open();
        printWin.document.write(html);
        printWin.document.close();
    };

    window.LigeirinhoOrderDavPrint = {
        isDistribuidoraAccount,
        buildDavHtml,
        printOrderDav,
    };
})();
