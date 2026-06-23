(function () {
    const AUTO_PRINT_DELAY_MS = 450;

    let cachedConfig = null;
    let serialPort = null;

    const BRIDGE_STORAGE_KEY = 'lig_totem_print_bridge_url';

    const isMobileTotem = () =>
        typeof navigator !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent);

    const resolvePrintBridgeUrl = (defaults = {}, unit = {}) => {
        try {
            const fromStorage = String(localStorage.getItem(BRIDGE_STORAGE_KEY) || '').trim();
            if (fromStorage) return fromStorage;
        } catch {
            /* ignore */
        }
        const host = String(unit.printBridgeHost || defaults.printBridgeHost || '').trim();
        if (host) {
            const port = Number(unit.printBridgePort || defaults.printBridgePort) || 8787;
            return `http://${host.replace(/^https?:\/\//, '').replace(/\/$/, '')}:${port}/print`;
        }
        return String(unit.printBridgeUrl || defaults.printBridgeUrl || '').trim();
    };

    const loadReceiptConfig = async () => {
        if (cachedConfig) return cachedConfig;
        try {
            const cfg = await fetch('data/totem-units.json').then((r) => r.json());
            const defaults = cfg?.defaults || {};
            const unit = cfg?.units?.default || {};
            cachedConfig = {
                autoPrint: defaults.autoPrintReceipt === true,
                autoPrintDelayMs: Number(defaults.autoPrintDelayMs) || AUTO_PRINT_DELAY_MS,
                totemLabel: unit.label || 'Ligeirinho Totem',
                printMode: String(defaults.printMode || 'auto').toLowerCase(),
                printBridgeUrl: resolvePrintBridgeUrl(defaults, unit),
                escposBaudRate: Number(defaults.escposBaudRate) || 9600,
                escposLineChars: Number(defaults.escposLineChars) || 42,
            };
        } catch {
            cachedConfig = {
                autoPrint: false,
                autoPrintDelayMs: AUTO_PRINT_DELAY_MS,
                totemLabel: 'Ligeirinho Totem',
                printMode: 'auto',
                printBridgeUrl: '',
                escposBaudRate: 9600,
                escposLineChars: 42,
            };
        }
        return cachedConfig;
    };

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
        const forPrint = Boolean(opts.forPrint);
        const code = forPrint ? compactCode(order.id) : formatCode(order.id);
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

        const codeClass = forPrint ? 'totem-receipt__code totem-receipt__code--compact' : 'totem-receipt__code';

        return `<div class="totem-receipt__paper">
<div class="totem-receipt__brand">${esc(unitLabel)}</div>
<p class="totem-receipt__title">COMPROVANTE DE PEDIDO</p>
<p class="totem-receipt__subtitle">Apresente no caixa para pagamento</p>
<div class="totem-receipt__divider" aria-hidden="true"></div>
<p class="totem-receipt__code-label">Código do pedido</p>
<p class="${codeClass}">${esc(code)}</p>
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

    const printCss = () => `@page{size:80mm auto;margin:2mm}html,body{width:80mm;margin:0;padding:0;background:#fff;font-family:'Segoe UI',system-ui,sans-serif}
.totem-receipt__paper{width:76mm;margin:0 auto;padding:2mm 0;font-size:11px;line-height:1.35;color:#000}
.totem-receipt__brand{font-size:12px;font-weight:800;text-align:center;letter-spacing:.04em;text-transform:uppercase}
.totem-receipt__title{margin:.35rem 0 0;font-size:13px;font-weight:800;text-align:center;letter-spacing:.06em}
.totem-receipt__subtitle{margin:.2rem 0 0;font-size:10px;font-weight:600;text-align:center;color:#333}
.totem-receipt__divider{margin:.45rem 0;border-top:1px dashed #000}
.totem-receipt__code-label{margin:0;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;text-align:center;color:#444}
.totem-receipt__code{margin:.25rem 0 0;font-size:18px;font-weight:800;text-align:center;font-family:ui-monospace,monospace}
.totem-receipt__code--compact{letter-spacing:.04em;font-size:16px}
.totem-receipt__meta{margin:.2rem 0 0;font-size:10px;text-align:center;color:#444}
.totem-receipt__items{width:100%;border-collapse:collapse;font-size:10px}
.totem-receipt__items td{padding:.15rem 0;vertical-align:top}
.totem-receipt__qty{width:1.65rem;white-space:nowrap;font-weight:700}
.totem-receipt__name{padding-right:.25rem;word-break:break-word}
.totem-receipt__price{text-align:right;white-space:nowrap}
.totem-receipt__row{display:flex;justify-content:space-between;gap:.5rem;font-size:10px;margin:.15rem 0}
.totem-receipt__row--total{margin-top:.35rem;font-size:11px}
.totem-receipt__row--total strong{font-size:14px}
.totem-receipt__foot{margin:.35rem 0 0;font-size:9px;line-height:1.4;text-align:center}
.totem-receipt__foot--muted{margin-top:.5rem;font-weight:700;font-size:10px}`;

    const printViaBridge = async (order, opts = {}) => {
        const url = String(opts.printBridgeUrl || '').trim();
        if (!url) return false;
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order,
                    totemLabel: opts.totemLabel,
                    escposLineChars: opts.escposLineChars,
                }),
            });
            return res.ok;
        } catch (err) {
            console.warn('totem-receipt bridge', err);
            return false;
        }
    };

    const printViaHiddenIframe = (order, opts = {}) =>
        new Promise((resolve) => {
            const html = buildReceiptHtml(order, { ...opts, forPrint: true });
            const iframe = document.createElement('iframe');
            iframe.setAttribute('aria-hidden', 'true');
            iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:0;height:0;border:0;visibility:hidden';
            document.body.appendChild(iframe);

            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!doc) {
                iframe.remove();
                resolve(false);
                return;
            }

            doc.open();
            doc.write(
                `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Comprovante</title><style>${printCss()}</style></head><body>${html}</body></html>`
            );
            doc.close();

            const cleanup = () => {
                window.setTimeout(() => iframe.remove(), 1000);
            };

            const doPrint = () => {
                try {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                    cleanup();
                    resolve(true);
                } catch {
                    cleanup();
                    resolve(false);
                }
            };

            if (iframe.contentWindow?.document?.readyState === 'complete') {
                window.setTimeout(doPrint, 50);
            } else {
                iframe.onload = () => window.setTimeout(doPrint, 50);
            }
        });

    const escposSupported = () => typeof navigator !== 'undefined' && 'serial' in navigator;

    const getSerialPort = async (requestNew = false) => {
        if (!escposSupported()) return null;
        if (serialPort?.readable) return serialPort;

        if (requestNew) {
            try {
                serialPort = await navigator.serial.requestPort();
                return serialPort;
            } catch {
                return null;
            }
        }

        try {
            const ports = await navigator.serial.getPorts();
            if (ports.length) {
                serialPort = ports[0];
                return serialPort;
            }
        } catch {
            /* ignore */
        }
        return null;
    };

    const pairPrinter = async () => getSerialPort(true);

    const padLine = (left, right, width) => {
        const l = String(left);
        const r = String(right);
        const spaces = Math.max(1, width - l.length - r.length);
        return l + ' '.repeat(spaces) + r;
    };

    const escposEncode = (text) => new TextEncoder().encode(text);

    const buildEscPosReceipt = (order, opts = {}) => {
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
            const name = String(item.name || '').slice(0, width - 8);
            lines.push(padLine(`${qty}x ${name}`, lineTotal, width));
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
        out += ESC + 'a' + '\x01';
        lines.forEach((line) => {
            out += line + '\n';
        });
        out += ESC + 'a' + '\x00';
        out += '\n\n';
        out += GS + 'V' + '\x00';

        return escposEncode(out);
    };

    const printViaEscPos = async (order, opts = {}) => {
        const port = await getSerialPort(Boolean(opts.requestSerial));
        if (!port) return false;

        const config = await loadReceiptConfig();
        const baudRate = Number(opts.escposBaudRate) || config.escposBaudRate;

        try {
            await port.open({ baudRate });
            const writer = port.writable?.getWriter();
            if (!writer) {
                await port.close();
                return false;
            }
            const data = buildEscPosReceipt(order, { ...opts, ...config });
            await writer.write(data);
            writer.releaseLock();
            await port.close();
            return true;
        } catch (err) {
            console.warn('totem-receipt escpos', err);
            try {
                await port.close();
            } catch {
                /* ignore */
            }
            return false;
        }
    };

    const printOrderReceipt = async (order, opts = {}) => {
        if (!order?.id) return false;

        const force = Boolean(opts.force);
        const auto = Boolean(opts.auto);
        if (!force && !auto) return false;

        const config = await loadReceiptConfig();
        if (auto && !config.autoPrint) return false;

        const storageKey = `totem-receipt:${order.id}`;
        if (!force && sessionStorage.getItem(storageKey)) return false;

        const delayMs = Number(opts.delayMs) || config.autoPrintDelayMs || AUTO_PRINT_DELAY_MS;
        const mode = String(opts.printMode || config.printMode || 'auto').toLowerCase();

        const runPrint = async () => {
            const printOpts = {
                totemLabel: opts.totemLabel || config.totemLabel,
                requestSerial: Boolean(opts.requestSerial),
                escposBaudRate: config.escposBaudRate,
                escposLineChars: config.escposLineChars,
                printBridgeUrl: opts.printBridgeUrl || config.printBridgeUrl,
            };

            if (mode === 'browser') {
                return printViaHiddenIframe(order, printOpts);
            }
            if (mode === 'escpos') {
                return printViaEscPos(order, printOpts);
            }
            if (mode === 'bridge') {
                return printViaBridge(order, printOpts);
            }

            if (mode === 'auto' && isMobileTotem()) {
                const bridgeOk = await printViaBridge(order, printOpts);
                if (bridgeOk) return true;
                return false;
            }

            const escOk = await printViaEscPos(order, printOpts);
            if (escOk) return true;

            const bridgeOk = await printViaBridge(order, printOpts);
            if (bridgeOk) return true;

            return printViaHiddenIframe(order, printOpts);
        };

        return new Promise((resolve) => {
            window.requestAnimationFrame(() => {
                window.setTimeout(async () => {
                    const ok = await runPrint();
                    if (ok && !force) sessionStorage.setItem(storageKey, String(Date.now()));
                    resolve(ok);
                }, delayMs);
            });
        });
    };

    try {
        const bridgeFromUrl = new URLSearchParams(window.location.search).get('printBridge');
        if (bridgeFromUrl) {
            localStorage.setItem(BRIDGE_STORAGE_KEY, bridgeFromUrl.trim());
            cachedConfig = null;
        }
    } catch {
        /* ignore */
    }

    window.LigeirinhoTotemReceipt = {
        buildReceiptHtml,
        formatCode,
        compactCode,
        copyToClipboard,
        loadReceiptConfig,
        printOrderReceipt,
        printViaBridge,
        printViaHiddenIframe,
        printViaEscPos,
        pairPrinter,
        escposSupported,
        setPrintBridgeUrl(url) {
            const value = String(url || '').trim();
            if (!value) {
                localStorage.removeItem(BRIDGE_STORAGE_KEY);
                cachedConfig = null;
                return;
            }
            localStorage.setItem(BRIDGE_STORAGE_KEY, value);
            cachedConfig = null;
        },
        getPrintBridgeUrl: () => resolvePrintBridgeUrl(),
    };
})();
