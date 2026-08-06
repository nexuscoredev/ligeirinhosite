(function () {
    const ISSUER = {
        razaoSocial: 'LIGEIRINHO COMERCIO DE BEBIDAS LTDA',
        cnpj: '45.028.186/0001-25',
        ie: '134065480113',
        endereco:
            'ESTRADA DO CAMPO LIMPO, N 2083, Bairro: VILA PREL, Cidade: SAO PAULO - SP-ANEXO 2093 FUNDOS.',
    };

    const DISTRIBUIDORA_CNPJ = '45028186000125';

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

    const formatCpf = (value) => {
        const raw = digits(value);
        if (raw.length !== 11) return value || '';
        return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9)}`;
    };

    const formatDoc = (value) => {
        const raw = digits(value);
        if (raw.length === 11) return formatCpf(raw);
        if (raw.length === 14) return formatCnpj(raw);
        return String(value || '').trim();
    };

    const extractDocFromNotes = (notes) => {
        const text = String(notes || '');
        const tagged = text.match(/Doc cliente:\s*([^·\n]+)/i);
        if (tagged?.[1]) return formatDoc(tagged[1]);
        const cpfNota = text.match(/CPF na nota:\s*([^·\n]+)/i);
        if (cpfNota?.[1]) return formatDoc(cpfNota[1]);
        return '';
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

    const UUID_RE =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const isUuidLike = (value) => UUID_RE.test(String(value || '').trim());

    /** Código do item no DAV: SKU/EAN curto — nunca UUID interno. */
    const resolveProductCode = (item) => {
        const candidates = [
            item?.sku,
            item?.ean,
            item?.barcode,
            item?.codigoBarras,
            item?.codigo_barras,
            item?.legacyGfId,
            item?.legacy_gf_id,
            item?.codigo,
            item?.code,
        ];
        for (const candidate of candidates) {
            const raw = String(candidate || '').trim();
            if (!raw || isUuidLike(raw)) continue;
            const prod = raw.match(/^prod-(\d{1,14})$/i);
            if (prod) return prod[1];
            if (/^prod-/i.test(raw)) continue;
            return raw;
        }
        return '—';
    };

    const formatQty = (value) => {
        const n = Number(value || 0);
        if (!Number.isFinite(n)) return '0';
        if (Math.abs(n - Math.round(n)) < 1e-9) {
            return Math.round(n).toLocaleString('pt-BR');
        }
        return n.toLocaleString('pt-BR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3,
        });
    };

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

    const paymentMethodLabelSingle = (id) => {
        const methods = window.LigeirinhoPaymentMethods;
        if (methods?.label?.(id)) return methods.label(id);
        const key = String(id || '').toLowerCase();
        if (key === 'pix') return 'PIX';
        if (key === 'mercado_pago') return 'Mercado Pago';
        if (key === 'dinheiro') return 'Dinheiro';
        if (key === 'cartao') return 'Cartão';
        if (key === 'boleto' || key === 'prazo') return 'Boleto para 20 dias';
        return id ? String(id).trim() : '';
    };

    const paymentDisplayLine = (method, amount) =>
        `${esc(paymentMethodLabelSingle(method))} ${esc(formatMoney(amount))}`;

    /** HTML do pagamento no DAV — uma forma por linha para não estourar a tabela. */
    const resolvePaymentDisplayHtml = (order) => {
        const splitsApi = window.LigeirinhoPaymentSplits;
        const splits = splitsApi?.resolveOrderSplits?.(order) || [];
        if (splits.length >= 2) {
            return splits
                .map((item) =>
                    paymentDisplayLine(item.method, Number(item.amount) || Number(order?.total) || 0),
                )
                .join('<br>');
        }
        if (splits.length === 1) {
            const amount = Number(splits[0].amount) || Number(order?.total) || 0;
            return paymentDisplayLine(splits[0].method, amount);
        }
        const method = order?.paymentMethod || order?.payment_method;
        if (method) {
            return paymentDisplayLine(method, Number(order?.total) || 0);
        }
        const notes = String(order?.notes || '');
        const match = notes.match(/Pagamento:\s*([^·\n]+)/i);
        if (match?.[1]?.trim()) return esc(match[1].trim());
        return '—';
    };

    const resolveDestinatario = (order, session) => {
        const isDistribuidora = isDistribuidoraAccount(session);
        const customerName = String(order?.customerName || order?.customer_name || '').trim();
        const name = isDistribuidora
            ? customerName || 'LIGEIRINHO DISTRIBUIDORA'
            : customerName ||
              String(session?.razaoSocial || '').trim() ||
              String(session?.name || '').trim() ||
              '—';
        const clientDoc =
            formatDoc(order?.customerDoc) ||
            formatDoc(order?.customerCpf || order?.customer_cpf) ||
            formatDoc(order?.customerCnpj || order?.customer_cnpj) ||
            extractDocFromNotes(order?.notes);
        const cnpj = isDistribuidora
            ? clientDoc || '—'
            : formatCnpj(session?.cnpj || session?.login) ||
              clientDoc ||
              (order?.customerCpf ? formatDoc(order.customerCpf) : '');
        const phone = formatPhoneDisplay(order?.customerPhone || session?.phone);
        const rawAddress = String(order?.address || '').trim();
        const isPickup =
            String(order?.deliveryType || order?.delivery_type || '').toLowerCase() === 'retirada';
        const address =
            rawAddress ||
            (isPickup ? 'RETIRADA NO PONTO LIGEIRINHO' : '');
        return { name: String(name).toUpperCase(), cnpj, phone, address };
    };

    const resolveDeliveryFee = (order) => {
        const fromField = Number(order?.deliveryFee ?? order?.delivery_fee);
        if (Number.isFinite(fromField) && fromField > 0) return fromField;
        const feeItem = (order?.items || []).find(isDeliveryFeeLineItem);
        if (feeItem) {
            return (Number(feeItem.price) || 0) * (Number(feeItem.qty) || 1);
        }
        return 0;
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
            const code = resolveProductCode(item);
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
        const paymentDisplayHtml = resolvePaymentDisplayHtml(order);
        const deliveryFee = resolveDeliveryFee(order);

        const itemRows = lines
            .map(
                (line) => `<tr>
<td class="idx">${line.index}</td>
<td class="code">${esc(line.code)}</td>
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
@page { size: A4 portrait; margin: 12mm; }
body { margin: 0; background: #fff; }
@media screen { body { padding: 12mm; } }
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
<p class="dav-doc__issuer-meta">CNPJ: ${esc(ISSUER.cnpj)} · IE: ${esc(ISSUER.ie)}</p>
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

<table class="dav-doc__dest">
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
<colgroup>
<col class="c-idx">
<col class="c-code">
<col class="c-desc">
<col class="c-und">
<col class="c-qty">
<col class="c-unit">
<col class="c-sub">
<col class="c-disc">
<col class="c-total">
</colgroup>
<thead>
<tr>
<th>#</th>
<th>Código</th>
<th>Descrição</th>
<th>Und</th>
<th>Qtd</th>
<th>Unitário</th>
<th>Subtotal</th>
<th>Desc.</th>
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
<tr class="dav-doc__payment-row"><td class="label">Forma(s) de pagamento</td><td class="value">${paymentDisplayHtml}</td></tr>
<tr><td class="label">Taxa de entrega</td><td class="value">${deliveryFee > 0 ? formatMoney(deliveryFee) : 'Grátis'}</td></tr>
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
  }, 250);
});
<\/script>
</body>
</html>`;
    };

    const isDistribuidoraAccount = (session) => {
        if (!session) return false;
        return digits(session.cnpj || session.login) === DISTRIBUIDORA_CNPJ;
    };

    const writePrintWindow = (printWin, html) => {
        printWin.document.open();
        printWin.document.write(html);
        printWin.document.close();
    };

    const printOrderDav = async (orderId, session) => {
        // Abrir no mesmo tick do clique (sem noopener): com noopener o Chromium
        // devolve null e deixa about:blank em branco; após await o pop-up é bloqueado.
        const printWin = window.open('about:blank', '_blank', 'width=900,height=720');
        if (!printWin) {
            throw new Error('Permita pop-ups neste site para imprimir o DAV.');
        }

        try {
            writePrintWindow(
                printWin,
                '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>DAV</title></head><body style="font-family:system-ui,sans-serif;padding:24px;color:#333">Preparando DAV…</body></html>',
            );

            const res = await fetch(`/api/orders/get?id=${encodeURIComponent(orderId)}`, {
                headers: { Accept: 'application/json' },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.order) {
                throw new Error(data.error || 'Não foi possível carregar o pedido para impressão.');
            }

            const html = buildDavHtml(data.order, data.tracking || {}, session);
            try {
                writePrintWindow(printWin, html);
            } catch {
                // Fallback se document.write falhar (alguns bloqueios de about:blank)
                const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                printWin.location.replace(url);
                window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
            }
        } catch (err) {
            try {
                printWin.close();
            } catch {
                /* ignore */
            }
            throw err;
        }
    };

    window.LigeirinhoOrderDavPrint = {
        isDistribuidoraAccount,
        buildDavHtml,
        printOrderDav,
    };
})();
