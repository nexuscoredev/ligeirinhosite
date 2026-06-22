(function () {
    /** Impressão térmica desligada até configuração da impressora no totem. */
    const RECEIPT_PRINT_ENABLED = false;

    const esc = (s) =>
        String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

    const formatPrice = (value) =>
        Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const formatCode = (id) => {
        const raw = String(id || '')
            .slice(0, 8)
            .toUpperCase();
        return `PED ${raw.split('').join(' ')}`;
    };

    const compactCode = (id) => {
        const raw = String(id || '')
            .replace(/[^a-fA-F0-9]/gi, '')
            .slice(0, 8)
            .toUpperCase();
        return raw ? `PED ${raw}` : '';
    };

    const copyToClipboard = async (text) => {
        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch {
                /* fallback */
            }
        }
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
        } catch {
            return false;
        }
    };

    const flashCopied = (el) => {
        if (!el) return;
        el.classList.add('totem-success-code--copied');
        window.setTimeout(() => el.classList.remove('totem-success-code--copied'), 1500);
    };

    const bindCopyCodeHandlers = () => {
        document.addEventListener('click', async (e) => {
            const el = e.target.closest('[data-totem-copy-code]');
            if (!el) return;
            e.preventDefault();
            const text = el.dataset.copyText || el.textContent?.trim() || '';
            if (!text) return;
            if (await copyToClipboard(text)) flashCopied(el);
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindCopyCodeHandlers, { once: true });
    } else {
        bindCopyCodeHandlers();
    }

    const methodLabel = (m) => {
        const key = String(m || '').toLowerCase();
        if (key === 'pix') return 'Pix';
        if (key === 'cartao') return 'Cartão débito/crédito';
        return 'Dinheiro';
    };

    const formatDateTime = (iso) => {
        const d = iso ? new Date(iso) : new Date();
        if (Number.isNaN(d.getTime())) return new Date().toLocaleString('pt-BR');
        return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    };

    const buildReceiptHtml = (order, opts = {}) => {
        const code = formatCode(order.id);
        const unitLabel = order.totemLabel || opts.totemLabel || 'Ligeirinho Totem';
        const itemsHtml = (order.items || [])
            .map((item) => {
                const qty = Number(item.qty) || 1;
                const lineTotal = Number(item.price) * qty;
                return `<tr>
<td class="totem-receipt__qty">${qty}x</td>
<td class="totem-receipt__name">${esc(item.name)}</td>
<td class="totem-receipt__price">${formatPrice(lineTotal)}</td>
</tr>`;
            })
            .join('');

        return `<div class="totem-receipt__paper">
<div class="totem-receipt__brand">${esc(unitLabel)}</div>
<p class="totem-receipt__title">COMPROVANTE DE PEDIDO</p>
<p class="totem-receipt__subtitle">Apresente no caixa para pagamento</p>
<div class="totem-receipt__divider" aria-hidden="true"></div>
<p class="totem-receipt__code-label">Código do pedido</p>
<p class="totem-receipt__code">${esc(code)}</p>
<p class="totem-receipt__meta">${esc(formatDateTime(order.createdAt))}</p>
<div class="totem-receipt__divider" aria-hidden="true"></div>
<table class="totem-receipt__items" aria-label="Itens do pedido">
<tbody>${itemsHtml}</tbody>
</table>
<div class="totem-receipt__divider" aria-hidden="true"></div>
<div class="totem-receipt__row"><span>Forma de pagamento</span><strong>${esc(methodLabel(order.paymentMethod))}</strong></div>
<div class="totem-receipt__row totem-receipt__row--total"><span>Total</span><strong>${formatPrice(order.total)}</strong></div>
<div class="totem-receipt__divider" aria-hidden="true"></div>
<p class="totem-receipt__foot">Dirija-se ao caixa com este comprovante. O operador finalizará o pagamento no PDV.</p>
<p class="totem-receipt__foot totem-receipt__foot--muted">Ligeirinho Parceiros</p>
</div>`;
    };

    const ensurePrintRoot = () => {
        let el = document.getElementById('totem-receipt-print');
        if (!el) {
            el = document.createElement('div');
            el.id = 'totem-receipt-print';
            el.className = 'totem-receipt-print';
            el.setAttribute('aria-hidden', 'true');
            document.body.appendChild(el);
        }
        return el;
    };

    const printOrderReceipt = (order, opts = {}) => {
        if (!RECEIPT_PRINT_ENABLED || !order?.id) return false;

        const storageKey = `totem-receipt:${order.id}`;
        const force = Boolean(opts.force);
        if (!force && sessionStorage.getItem(storageKey)) return false;

        const root = ensurePrintRoot();
        root.innerHTML = buildReceiptHtml(order, opts);
        sessionStorage.setItem(storageKey, String(Date.now()));

        const runPrint = () => {
            try {
                window.print();
            } catch {
                /* ignore */
            }
        };

        window.requestAnimationFrame(() => window.setTimeout(runPrint, 200));
        return true;
    };

    window.LigeirinhoTotemReceipt = {
        buildReceiptHtml,
        formatCode,
        compactCode,
        copyToClipboard,
        printOrderReceipt,
    };
})();
