(function () {
    const AUTO_PRINT_DELAY_MS = 0;

    let cachedConfig = null;
    let serialPort = null;
    let warmPrintFrame = null;

    const BRIDGE_STORAGE_KEY = 'lig_totem_print_bridge_url';
    const PRINT_MARGIN_LEFT_KEY = 'lig_totem_print_margin_left_mm';
    const PRINT_MARGIN_RIGHT_KEY = 'lig_totem_print_margin_right_mm';

    const resolvePrintMarginLeftMm = (defaults = {}) => {
        try {
            const fromStorage = String(localStorage.getItem(PRINT_MARGIN_LEFT_KEY) || '').trim();
            if (fromStorage && !Number.isNaN(Number(fromStorage))) return Number(fromStorage);
        } catch {
            /* ignore */
        }
        const fromConfig = Number(defaults.printMarginLeftMm);
        return Number.isFinite(fromConfig) ? fromConfig : 3;
    };

    const resolvePrintMarginRightMm = (defaults = {}) => {
        try {
            const fromStorage = String(localStorage.getItem(PRINT_MARGIN_RIGHT_KEY) || '').trim();
            if (fromStorage && !Number.isNaN(Number(fromStorage))) return Number(fromStorage);
        } catch {
            /* ignore */
        }
        const fromConfig = Number(defaults.printMarginRightMm);
        return Number.isFinite(fromConfig) ? fromConfig : 7;
    };

    const isMobileTotem = () =>
        typeof navigator !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent);

    const resolveSessionUnitId = (cfg = {}) => {
        const session = window.LigeirinhoAuth?.loadSession?.() || {};
        const login = String(session.login || '').trim();
        const map = cfg.loginUnitMap || {};
        return (
            String(session.totemUnitId || '').trim() ||
            map[login] ||
            map[login.toLowerCase()] ||
            'default'
        );
    };

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

    const pickBool = (unitVal, defaultVal, fallback) => {
        if (unitVal !== undefined) return unitVal === true;
        if (defaultVal !== undefined) return defaultVal === true;
        return fallback;
    };

    const loadReceiptConfig = async () => {
        if (cachedConfig) return cachedConfig;
        try {
            const cfg = await fetch('data/totem-units.json').then((r) => r.json());
            const defaults = cfg?.defaults || {};
            const unitId = resolveSessionUnitId(cfg);
            const unit = { ...defaults, ...(cfg?.units?.[unitId] || {}) };
            cachedConfig = {
                unitId,
                autoPrint: pickBool(unit.autoPrintReceipt, defaults.autoPrintReceipt, false),
                autoPrintDelayMs: Number(unit.autoPrintDelayMs ?? defaults.autoPrintDelayMs) || AUTO_PRINT_DELAY_MS,
                totemLabel: unit.label || 'Ligeirinho Totem',
                printMode: String(unit.printMode || defaults.printMode || 'auto').toLowerCase(),
                printBridgeUrl: resolvePrintBridgeUrl(defaults, unit),
                printerHost: String(unit.printerHost || defaults.printerHost || '').trim(),
                printerPort: Number(unit.printerPort || defaults.printerPort) || 9100,
                escposBaudRate: Number(unit.escposBaudRate || defaults.escposBaudRate) || 9600,
                escposLineChars: Number(unit.escposLineChars || defaults.escposLineChars) || 42,
                printMarginLeftMm: resolvePrintMarginLeftMm(unit),
                printMarginRightMm: resolvePrintMarginRightMm(unit),
                printPaperWidthMm: Number(unit.printPaperWidthMm || defaults.printPaperWidthMm) || 70,
                printFallbackBrowser: pickBool(unit.printFallbackBrowser, defaults.printFallbackBrowser, true),
            };
        } catch {
            cachedConfig = {
                unitId: 'default',
                autoPrint: false,
                autoPrintDelayMs: AUTO_PRINT_DELAY_MS,
                totemLabel: 'Ligeirinho Totem',
                printMode: 'auto',
                printBridgeUrl: '',
                printerHost: '',
                printerPort: 9100,
                escposBaudRate: 9600,
                escposLineChars: 42,
                printMarginLeftMm: 3,
                printMarginRightMm: 7,
                printPaperWidthMm: 70,
                printFallbackBrowser: true,
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

    const TOTEM_CODE_HEX_LENGTH = 4;

    const formatCode = (id) => {
        const raw = String(id || '')
            .replace(/[^a-fA-F0-9]/gi, '')
            .slice(0, TOTEM_CODE_HEX_LENGTH)
            .toUpperCase();
        return raw ? `PED ${raw.split('').join(' ')}` : '';
    };

    const compactCode = (id) => {
        const raw = String(id || '')
            .replace(/[^a-fA-F0-9]/gi, '')
            .slice(0, TOTEM_CODE_HEX_LENGTH)
            .toUpperCase();
        return raw ? `PED ${raw}` : '';
    };

    const truncateName = (name, max = 42) => {
        const text = String(name || '').trim();
        if (text.length <= max) return text;
        return `${text.slice(0, max - 1)}…`;
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
        const key = String(m || '').toLowerCase().split('+')[0].trim();
        if (key === 'pix') return 'Pix';
        if (key === 'cartao') return 'Cartão';
        return 'Dinheiro';
    };

    const parseMoneyBr = (raw) => {
        const text = String(raw || '').trim();
        if (!text) return 0;
        const normalized = text.includes(',')
            ? text.replace(/\./g, '').replace(',', '.')
            : text.replace(/[^\d.]/g, '');
        const n = Number(normalized);
        return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
    };

    const mapHumanLabelToMethod = (label) => {
        const text = String(label || '').toLowerCase().trim();
        if (text.includes('pix')) return 'pix';
        if (text.includes('cart') || text.includes('cartao') || text.includes('cartão')) return 'cartao';
        if (text.includes('dinheiro')) return 'dinheiro';
        return text;
    };

    const normalizeSplitEntries = (raw) => {
        if (!Array.isArray(raw)) return [];
        const seen = new Set();
        const out = [];
        raw.forEach((entry) => {
            const method = String(entry?.method || entry?.id || '').toLowerCase().trim();
            const amount = parseMoneyBr(entry?.amount);
            if (!method || amount <= 0 || seen.has(method)) return;
            seen.add(method);
            out.push({ method, amount });
        });
        return out;
    };

    const SPLIT_MARKER = '[[lig-payment-splits:';

    const parseSplitsFromNotesHuman = (notes) => {
        const text = String(notes || '');
        const match = text.match(/Pagamento dividido(?: no totem)?:\s*([^[\n]+)/i);
        if (!match) return [];
        const chunks = match[1].split(/\s*\+\s*|\s*;\s*/);
        const out = [];
        chunks.forEach((chunk) => {
            const part = chunk.trim();
            const m = part.match(/^(.+?)\s+R\$\s*([\d.,]+)$/i);
            if (!m) return;
            const method = mapHumanLabelToMethod(m[1]);
            const amount = parseMoneyBr(m[2]);
            if (method && amount > 0) out.push({ method, amount });
        });
        return out.length >= 2 ? out : [];
    };

    const resolvePaymentSplits = (order) => {
        const splitsApi = window.LigeirinhoPaymentSplits;
        if (splitsApi?.resolveOrderSplits) {
            const resolved = normalizeSplitEntries(splitsApi.resolveOrderSplits(order));
            if (resolved.length >= 1) return resolved;
        }
        const fromColumn = normalizeSplitEntries(order?.paymentSplits || order?.payment_splits);
        if (fromColumn.length >= 1) return fromColumn;

        const text = String(order?.notes || '');
        const start = text.indexOf(SPLIT_MARKER);
        if (start !== -1) {
            const end = text.indexOf(']]', start);
            if (end !== -1) {
                try {
                    const parsed = normalizeSplitEntries(JSON.parse(text.slice(start + SPLIT_MARKER.length, end)));
                    if (parsed.length >= 1) return parsed;
                } catch {
                    /* ignore */
                }
            }
        }

        return parseSplitsFromNotesHuman(order?.notes);
    };

    const cashChangeForOrder = (order, splits) => {
        const splitsApi = window.LigeirinhoPaymentSplits;
        if (splitsApi?.computeCashChange) {
            return splitsApi.computeCashChange(splits, order.total);
        }
        const cash = splits.find((s) => String(s.method).toLowerCase() === 'dinheiro');
        if (!cash) return 0;
        const nonCash = splits
            .filter((s) => String(s.method).toLowerCase() !== 'dinheiro')
            .reduce((acc, s) => acc + Number(s.amount || 0), 0);
        const needed = Math.max(0, Math.round((Number(order.total) - nonCash) * 100) / 100);
        return Math.max(0, Math.round((Number(cash.amount) - needed) * 100) / 100);
    };

    const buildPaymentReceiptBlock = (order, forPrint = false) => {
        const splits = resolvePaymentSplits(order);
        const isCashTender =
            splits.length === 1 && String(splits[0]?.method || '').toLowerCase() === 'dinheiro';
        if (splits.length >= 2 || isCashTender) {
            const rows = splits.map((item) => {
                const label = methodLabel(item.method);
                const amount = formatPrice(item.amount);
                if (forPrint) {
                    return `<div class="totem-receipt__row totem-receipt__row--split"><span>${label}</span><strong>${amount}</strong></div>`;
                }
                return `<div class="totem-receipt__row totem-receipt__row--split"><span>${esc(label)}</span><strong>${esc(amount)}</strong></div>`;
            });
            const troco = cashChangeForOrder(order, splits);
            if (troco > 0.009) {
                const trocoLabel = formatPrice(troco);
                if (forPrint) {
                    rows.push(
                        `<div class="totem-receipt__row totem-receipt__row--troco"><span>Troco</span><strong>${trocoLabel}</strong></div>`,
                    );
                } else {
                    rows.push(
                        `<div class="totem-receipt__row totem-receipt__row--troco"><span>Troco</span><strong>${esc(trocoLabel)}</strong></div>`,
                    );
                }
            }
            return rows.join('');
        }
        const label = methodLabel(order.paymentMethod);
        const amount = formatPrice(order.total);
        if (forPrint) {
            return `<div class="totem-receipt__row"><span>${label}</span><strong>${amount}</strong></div>`;
        }
        return `<div class="totem-receipt__row"><span>${esc(label)}</span><strong>${esc(amount)}</strong></div>`;
    };

    const appendEscPosPaymentLines = (lines, order, width, padLine) => {
        const splits = resolvePaymentSplits(order);
        const isCashTender =
            splits.length === 1 && String(splits[0]?.method || '').toLowerCase() === 'dinheiro';
        if (splits.length >= 2 || isCashTender) {
            splits.forEach((item) => {
                lines.push(padLine(methodLabel(item.method), formatPrice(item.amount), width));
            });
            const troco = cashChangeForOrder(order, splits);
            if (troco > 0.009) {
                lines.push(padLine('Troco', formatPrice(troco), width));
            }
            return;
        }
        lines.push(padLine(methodLabel(order.paymentMethod), formatPrice(order.total), width));
    };

    const formatDateTime = (iso) => {
        const d = iso ? new Date(iso) : new Date();
        if (Number.isNaN(d.getTime())) return new Date().toLocaleString('pt-BR');
        return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    };

    const formatCpfReceipt = (raw) => {
        const d = String(raw || '').replace(/\D/g, '');
        if (d.length !== 11) return '';
        return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
    };

    const contactDigits = (value) => String(value || '').replace(/\D/g, '');

    const looksLikePhoneDigits = (digits) => {
        const d = contactDigits(digits);
        if (d.length === 10) return true;
        if (d.length === 11 && d[2] === '9') return true;
        return false;
    };

    const sanitizeReceiptPhone = (phone, cpf = '', cnpj = '') => {
        const raw = String(phone || '').trim();
        const phoneDigits = contactDigits(raw);
        if (!phoneDigits || !looksLikePhoneDigits(phoneDigits)) return '';
        const cpfDigits = contactDigits(cpf);
        const cnpjDigits = contactDigits(cnpj);
        if (cpfDigits && phoneDigits === cpfDigits) return '';
        if (cnpjDigits && phoneDigits === cnpjDigits) return '';
        return raw;
    };

    const buildCustomerReceiptBlock = (order, forPrint = false) => {
        const rows = [];
        const name = String(order.customerName || '').trim();
        const cpf = formatCpfReceipt(order.customerCpf || order.customer_cpf);
        const phone = sanitizeReceiptPhone(
            order.customerPhone,
            order.customerCpf || order.customer_cpf,
            order.customerCnpj || order.customer_cnpj,
        );
        if (name) {
            const label = forPrint ? truncateName(name, 28) : esc(name);
            rows.push(`<div class="totem-receipt__row"><span>Cliente</span><strong>${label}</strong></div>`);
        }
        if (phone) {
            rows.push(`<div class="totem-receipt__row"><span>Telefone</span><strong>${esc(phone)}</strong></div>`);
        }
        if (cpf) {
            rows.push(`<div class="totem-receipt__row"><span>CPF</span><strong>${forPrint ? cpf : esc(cpf)}</strong></div>`);
        }
        if (!rows.length) return '';
        return `${rows.join('')}<div class="totem-receipt__divider" aria-hidden="true"></div>`;
    };

    const buildBarcodeHtml = (orderId, forPrint = false) => {
        const bc = window.LigeirinhoTotemBarcode;
        const payload = bc?.scannerTotemCode?.(orderId) || '';
        if (!payload || !bc?.code128Svg) return '';
        const height = forPrint ? 52 : 56;
        const svg = bc.code128Svg(payload, { height, barWidth: forPrint ? 1.25 : 1.35 });
        return `<div class="totem-receipt__barcode" aria-hidden="true">${svg}</div><p class="totem-receipt__barcode-hint">${esc(payload)}</p>`;
    };

    const buildReceiptHtml = (order, opts = {}) => {
        const forPrint = Boolean(opts.forPrint);
        const code = forPrint ? compactCode(order.id) : formatCode(order.id);
        const unitLabel = order.totemLabel || opts.totemLabel || 'Ligeirinho Totem';
        const itemsHtml = (order.items || [])
            .map((item) => {
                const qty = Number(item.qty) || 1;
                const lineTotal = Number(item.price) * qty;
                const name = forPrint ? truncateName(item.name) : esc(item.name);
                if (forPrint) {
                    return `<div class="totem-receipt__item">
<div class="totem-receipt__item-head">
<span class="totem-receipt__qty">${qty}x</span>
<span class="totem-receipt__name">${esc(name)}</span>
</div>
<div class="totem-receipt__item-price">${formatPrice(lineTotal)}</div>
</div>`;
                }
                return `<tr>
<td class="totem-receipt__qty">${qty}x</td>
<td class="totem-receipt__name">${name}</td>
<td class="totem-receipt__price">${formatPrice(lineTotal)}</td>
</tr>`;
            })
            .join('');

        const codeClass = forPrint ? 'totem-receipt__code totem-receipt__code--compact' : 'totem-receipt__code';
        const itemsBlock = forPrint
            ? `<div class="totem-receipt__items">${itemsHtml}</div>`
            : `<table class="totem-receipt__items" aria-label="Itens do pedido"><tbody>${itemsHtml}</tbody></table>`;

        return `<div class="totem-receipt__paper">
<div class="totem-receipt__brand">${esc(unitLabel)}</div>
<p class="totem-receipt__title">COMPROVANTE DE PEDIDO</p>
<p class="totem-receipt__subtitle">Apresente no caixa para pagamento</p>
<div class="totem-receipt__divider" aria-hidden="true"></div>
<p class="totem-receipt__code-label">Código do pedido</p>
<p class="${codeClass}">${esc(code)}</p>
${buildBarcodeHtml(order.id, forPrint)}
<p class="totem-receipt__meta">${esc(formatDateTime(order.createdAt))}</p>
${buildCustomerReceiptBlock(order, forPrint)}
<div class="totem-receipt__divider" aria-hidden="true"></div>
${itemsBlock}
<div class="totem-receipt__divider" aria-hidden="true"></div>
${buildPaymentReceiptBlock(order, forPrint)}
<div class="totem-receipt__row totem-receipt__row--total"><span>Total</span><strong>${formatPrice(order.total)}</strong></div>
<div class="totem-receipt__divider" aria-hidden="true"></div>
<p class="totem-receipt__foot">Dirija-se ao caixa e passe o código de barras no leitor do PDV.</p>
<p class="totem-receipt__foot totem-receipt__foot--muted">Ligeirinho Parceiros</p>
</div>`;
    };

    const printCss = (opts = {}) => {
        const marginLeft = Number(opts.printMarginLeftMm);
        const marginRight = Number(opts.printMarginRightMm);
        const marginLeftMm = Number.isFinite(marginLeft) ? marginLeft : 3;
        const marginRightMm = Number.isFinite(marginRight) ? marginRight : 7;
        const paperWidth = Number(opts.printPaperWidthMm) || 70;
        return `@page{size:80mm auto;margin:0}html,body{width:80mm;max-width:80mm;min-width:80mm;margin:0;padding:0;background:#fff;overflow:hidden;font-family:'Courier New',Courier,ui-monospace,monospace}
body{display:flex;justify-content:center;align-items:flex-start}
.totem-receipt__paper{box-sizing:border-box;width:${paperWidth}mm;max-width:${paperWidth}mm;margin:0 auto;padding:2mm ${marginRightMm}mm 2mm ${marginLeftMm}mm;font-size:11px;line-height:1.35;color:#000;font-weight:700;overflow:hidden;word-wrap:break-word;overflow-wrap:anywhere}
.totem-receipt__paper *{font-weight:700}
.totem-receipt__brand{font-size:12px;font-weight:900;text-align:center;letter-spacing:.02em;text-transform:uppercase}
.totem-receipt__title{margin:2mm 0 0;font-size:13px;font-weight:900;text-align:center;letter-spacing:.04em}
.totem-receipt__subtitle{margin:1mm 0 0;font-size:11px;font-weight:700;text-align:center}
.totem-receipt__divider{margin:2.5mm 0;border-top:1px dashed #000}
.totem-receipt__code-label{margin:0;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;text-align:center}
.totem-receipt__code{margin:1.5mm 0 0;font-size:16px;font-weight:900;text-align:center;letter-spacing:.06em;word-break:break-all}
.totem-receipt__code--compact{letter-spacing:.06em;font-size:16px;font-weight:900}
.totem-receipt__barcode{margin:2mm auto 0;max-width:100%;text-align:center;line-height:0}
.totem-receipt__barcode svg{display:block;margin:0 auto;max-width:58mm;height:auto}
.totem-receipt__barcode-hint{margin:1mm 0 0;font-size:10px;font-weight:900;text-align:center;letter-spacing:.08em}
.totem-receipt__meta{margin:1.5mm 0 0;font-size:11px;font-weight:700;text-align:center}
.totem-receipt__items{display:flex;flex-direction:column;gap:2mm;width:100%}
.totem-receipt__item{width:100%}
.totem-receipt__item-head{display:flex;align-items:flex-start;gap:1.5mm;width:100%}
.totem-receipt__qty{flex-shrink:0;min-width:5mm;font-weight:900}
.totem-receipt__name{flex:1;min-width:0;font-size:11px;line-height:1.3;font-weight:700}
.totem-receipt__item-price{box-sizing:border-box;margin-top:.5mm;padding-left:6.5mm;padding-right:1mm;font-size:11px;font-weight:900;text-align:right;font-variant-numeric:tabular-nums}
.totem-receipt__row{display:flex;align-items:baseline;justify-content:space-between;gap:2mm;width:100%;font-size:11px;margin:1mm 0;font-weight:700}
.totem-receipt__row>span{flex:1;min-width:0;font-weight:700}
.totem-receipt__row strong{flex-shrink:0;max-width:44%;padding-right:1mm;text-align:right;font-size:11px;font-weight:900;font-variant-numeric:tabular-nums;word-break:break-word}
.totem-receipt__row--total{margin-top:2mm;font-size:12px;font-weight:900}
.totem-receipt__row--total strong{font-size:13px;font-weight:900;max-width:50%;padding-right:1mm}
.totem-receipt__split-title{margin:1.5mm 0 0;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}
.totem-receipt__row--split{margin:0.5mm 0}
.totem-receipt__row--troco{margin:0.8mm 0 0;font-weight:900}
.totem-receipt__foot{margin:2mm 0 0;font-size:10px;line-height:1.35;text-align:center;font-weight:700}
.totem-receipt__foot--muted{margin-top:2mm;font-weight:900;font-size:10px}`;
    };

    const printOptsKey = (opts = {}) =>
        `${Number(opts.printMarginLeftMm) || 3}:${Number(opts.printMarginRightMm) || 7}:${Number(opts.printPaperWidthMm) || 70}`;

    const ensureWarmPrintFrame = (opts = {}) => {
        const key = printOptsKey(opts);
        if (warmPrintFrame?.isConnected && warmPrintFrame._optsKey === key) {
            return warmPrintFrame;
        }
        if (warmPrintFrame?.isConnected) {
            warmPrintFrame.remove();
            warmPrintFrame = null;
        }
        const iframe = document.createElement('iframe');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.setAttribute('title', 'Comprovante');
        iframe.style.cssText =
            'position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0;visibility:hidden;pointer-events:none';
        document.body.appendChild(iframe);
        const css = printCss(opts);
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write(
                `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Comprovante</title><style>${css}</style></head><body></body></html>`
            );
            doc.close();
        }
        iframe._optsKey = key;
        warmPrintFrame = iframe;
        return iframe;
    };

    const prewarmPrint = async () => {
        if (!document.body) return;
        const config = await loadReceiptConfig();
        ensureWarmPrintFrame({
            printMarginLeftMm: config.printMarginLeftMm,
            printMarginRightMm: config.printMarginRightMm,
            printPaperWidthMm: config.printPaperWidthMm,
        });
    };

    const PRINTING_CLASS = 'totem-is-printing';

    const beginPrintScreen = () => {
        document.body.classList.add(PRINTING_CLASS);
    };

    const endPrintScreen = () => {
        document.body.classList.remove(PRINTING_CLASS);
    };

    const printInDocument = (doc, win, order, opts = {}) =>
        new Promise((resolve) => {
            if (!doc || !win) {
                resolve(false);
                return;
            }
            doc.body.innerHTML = buildReceiptHtml(order, { ...opts, forPrint: true });

            let settled = false;
            const finish = (ok) => {
                if (settled) return;
                settled = true;
                endPrintScreen();
                resolve(ok);
            };

            beginPrintScreen();
            win.addEventListener('afterprint', () => finish(true), { once: true });
            try {
                win.focus();
                win.print();
                window.setTimeout(() => finish(true), 500);
            } catch {
                finish(false);
            }
        });

    const printViaWarmIframe = (order, opts = {}) => {
        const iframe = ensureWarmPrintFrame(opts);
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        const win = iframe.contentWindow;
        return printInDocument(doc, win, order, opts);
    };

    const printViaPrintWindow = (order, opts = {}, targetWin) => {
        if (!targetWin || targetWin.closed) return Promise.resolve(false);
        const css = printCss(opts);
        const html = buildReceiptHtml(order, { ...opts, forPrint: true });
        try {
            targetWin.document.open();
            targetWin.document.write(
                `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Comprovante</title><style>${css}</style></head><body>${html}</body></html>`
            );
            targetWin.document.close();
        } catch {
            return Promise.resolve(false);
        }
        return printInDocument(targetWin.document, targetWin, order, opts);
    };

    const printViaBridge = async (order, opts = {}) => {
        const url = String(opts.printBridgeUrl || '').trim();
        if (!url) return false;
        try {
            const body = {
                order,
                totemLabel: opts.totemLabel,
                escposLineChars: opts.escposLineChars,
            };
            const printerHost = String(opts.printerHost || '').trim();
            if (printerHost) {
                body.printerHost = printerHost;
                body.printerPort = Number(opts.printerPort) || 9100;
            }
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            return res.ok;
        } catch (err) {
            console.warn('totem-receipt bridge', err);
            return false;
        }
    };

    const bridgeHealthUrl = (printBridgeUrl) => {
        const raw = String(printBridgeUrl || '').trim();
        if (!raw) return '';
        return raw.replace(/\/print\/?$/i, '/health');
    };

    const bridgeReachable = async (printBridgeUrl, timeoutMs = 900) => {
        const healthUrl = bridgeHealthUrl(printBridgeUrl);
        if (!healthUrl) return false;
        try {
            const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timer = ctrl ? window.setTimeout(() => ctrl.abort(), timeoutMs) : null;
            const res = await fetch(healthUrl, { method: 'GET', signal: ctrl?.signal });
            if (timer) window.clearTimeout(timer);
            return res.ok;
        } catch {
            return false;
        }
    };

    /** Descobre a ponte na mesma rede da impressora (só Tablets com printerHost). */
    const discoverPrintBridgeUrl = async (printerHost, bridgePort = 8787) => {
        const host = String(printerHost || '').trim();
        const parts = host.split('.');
        if (parts.length !== 4) return '';
        const base = parts.slice(0, 3).join('.');
        const octets = [1, 2, 10, 11, 20, 50, 100, 101, 150, 200];
        const candidates = octets.map((n) => `http://${base}.${n}:${bridgePort}/print`);
        const checks = await Promise.all(
            candidates.map(async (url) => ((await bridgeReachable(url, 450)) ? url : ''))
        );
        const found = checks.find(Boolean) || '';
        if (found) {
            try {
                localStorage.setItem(BRIDGE_STORAGE_KEY, found);
            } catch {
                /* ignore */
            }
        }
        return found;
    };

    const resolveBridgeUrlForPrint = async (printOpts = {}) => {
        let url = String(printOpts.printBridgeUrl || '').trim();
        if (url) return url;
        const printerHost = String(printOpts.printerHost || '').trim();
        if (!printerHost) return '';
        return discoverPrintBridgeUrl(printerHost);
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

    /** Impressão na janela principal — fallback com Chrome --kiosk-printing. */
    const printViaKiosk = (order, opts = {}) =>
        new Promise((resolve) => {
            beginPrintScreen();
            const root = ensurePrintRoot();
            root.innerHTML = buildReceiptHtml(order, { ...opts, forPrint: true });

            const finish = (ok) => {
                if (finish.done) return;
                finish.done = true;
                window.setTimeout(() => {
                    endPrintScreen();
                    resolve(ok);
                }, 300);
            };
            finish.done = false;

            window.addEventListener('afterprint', () => finish(true), { once: true });

            window.requestAnimationFrame(() => {
                try {
                    window.focus();
                    window.print();
                    window.setTimeout(() => finish(true), 1200);
                } catch {
                    finish(false);
                }
            });
        });

    const printViaHiddenIframe = (order, opts = {}) =>
        new Promise((resolve) => {
            const html = buildReceiptHtml(order, { ...opts, forPrint: true });
            const iframe = document.createElement('iframe');
            iframe.setAttribute('aria-hidden', 'true');
            iframe.setAttribute('title', 'Comprovante');
            iframe.style.cssText =
                'position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0;visibility:hidden;pointer-events:none';
            document.body.appendChild(iframe);

            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            const win = iframe.contentWindow;
            if (!doc || !win) {
                iframe.remove();
                resolve(false);
                return;
            }

            const css = printCss(opts);

            doc.open();
            doc.write(
                `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Comprovante</title><style>${css}</style></head><body>${html}</body></html>`
            );
            doc.close();

            let settled = false;
            const finish = (ok) => {
                if (settled) return;
                settled = true;
                endPrintScreen();
                window.setTimeout(() => iframe.remove(), 800);
                resolve(ok);
            };

            beginPrintScreen();
            win.addEventListener('afterprint', () => finish(true), { once: true });

            const doPrint = () => {
                try {
                    win.focus();
                    win.print();
                    window.setTimeout(() => finish(true), 900);
                } catch {
                    finish(false);
                }
            };

            if (win.document?.readyState === 'complete') {
                window.setTimeout(doPrint, 40);
            } else {
                iframe.onload = () => window.setTimeout(doPrint, 40);
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

        const scannerCode = window.LigeirinhoTotemBarcode?.scannerTotemCode?.(order.id) || '';
        const tailStart = lines.length;

        lines.push(center(formatDateTime(order.createdAt)));
        lines.push(divider());

        const customerName = String(order.customerName || '').trim();
        const customerCpf = formatCpfReceipt(order.customerCpf || order.customer_cpf);
        const customerPhone = sanitizeReceiptPhone(
            order.customerPhone,
            order.customerCpf || order.customer_cpf,
            order.customerCnpj || order.customer_cnpj,
        );
        if (customerName) {
            lines.push(padLine('Cliente', customerName.slice(0, Math.max(8, width - 10)), width));
        }
        if (customerPhone) {
            lines.push(padLine('Telefone', customerPhone.slice(0, Math.max(8, width - 11)), width));
        }
        if (customerCpf) {
            lines.push(padLine('CPF', customerCpf, width));
        }
        if (customerName || customerPhone || customerCpf) {
            lines.push(divider());
        }

        (order.items || []).forEach((item) => {
            const qty = Number(item.qty) || 1;
            const lineTotal = formatPrice(Number(item.price) * qty);
            const name = String(item.name || '').trim();
            lines.push(`${qty}x ${name}`.slice(0, width));
            lines.push(padLine('', lineTotal, width));
        });

        lines.push(divider());
        appendEscPosPaymentLines(lines, order, width, padLine);
        lines.push(padLine('TOTAL', formatPrice(order.total), width));
        lines.push(divider());
        lines.push(center('Ligeirinho Parceiros'));
        lines.push('');

        const ESC = '\x1B';
        const GS = '\x1D';
        let out = ESC + '@';
        out += ESC + 'E' + '\x01';
        out += ESC + 'a' + '\x01';
        for (let i = 0; i < lines.length; i += 1) {
            out += lines[i] + '\n';
            if (scannerCode && i === tailStart - 1) {
                out += '\n';
                out = window.LigeirinhoTotemBarcode.appendEscPosCode128(out, scannerCode);
                out += '\n';
            }
        }
        out += ESC + 'a' + '\x00';
        out += ESC + 'E' + '\x00';
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
                printerHost: opts.printerHost || config.printerHost,
                printerPort: opts.printerPort || config.printerPort,
                printMarginLeftMm: opts.printMarginLeftMm ?? config.printMarginLeftMm,
                printMarginRightMm: opts.printMarginRightMm ?? config.printMarginRightMm,
                printPaperWidthMm: opts.printPaperWidthMm ?? config.printPaperWidthMm,
            };
            const allowBrowserFallback =
                opts.printFallbackBrowser !== undefined
                    ? opts.printFallbackBrowser === true
                    : config.printFallbackBrowser !== false;

            const sleep = (ms) => new Promise((r) => window.setTimeout(r, ms));

            const printBrowser = async () => {
                // Iframe oculto primeiro — o cliente continua vendo o totem (sem diálogo na tela principal)
                const iframeOk = await printViaWarmIframe(order, printOpts);
                if (iframeOk) return true;
                const hiddenOk = await printViaHiddenIframe(order, printOpts);
                if (hiddenOk) return true;
                // Fallback silencioso só com Chrome --kiosk-printing
                return printViaKiosk(order, printOpts);
            };

            const tryBridge = async (attempts = 2) => {
                const bridgeUrl = await resolveBridgeUrlForPrint(printOpts);
                if (!bridgeUrl) return false;
                printOpts.printBridgeUrl = bridgeUrl;
                for (let i = 0; i < attempts; i += 1) {
                    if (await bridgeReachable(bridgeUrl)) {
                        const ok = await printViaBridge(order, printOpts);
                        if (ok) return true;
                    }
                    if (i < attempts - 1) await sleep(400);
                }
                return false;
            };

            if (mode === 'browser' || mode === 'kiosk') {
                return printBrowser();
            }
            if (mode === 'escpos') {
                return printViaEscPos(order, printOpts);
            }
            if (mode === 'bridge') {
                const bridgeOk = await tryBridge();
                if (bridgeOk) return true;
                return allowBrowserFallback ? printBrowser() : false;
            }

            if (mode === 'auto' && isMobileTotem()) {
                const bridgeOk = await tryBridge();
                if (bridgeOk) return true;
                return false;
            }

            // PC totem: Chrome kiosk (sem Node/ponte) → serial USB opcional
            return printBrowser();
        };

        const execute = async () => {
            if (!force && sessionStorage.getItem(storageKey)) return false;
            const ok = await runPrint();
            if (ok) sessionStorage.setItem(storageKey, String(Date.now()));
            return ok;
        };

        if (delayMs <= 0) return execute();
        return new Promise((resolve) => {
            window.setTimeout(() => execute().then(resolve), delayMs);
        });
    };

    try {
        const params = new URLSearchParams(window.location.search);
        const bridgeFromUrl = params.get('printBridge');
        if (bridgeFromUrl) {
            localStorage.setItem(BRIDGE_STORAGE_KEY, bridgeFromUrl.trim());
            cachedConfig = null;
        }
        const marginFromUrl = params.get('printMarginLeft');
        if (marginFromUrl != null && marginFromUrl !== '' && !Number.isNaN(Number(marginFromUrl))) {
            localStorage.setItem(PRINT_MARGIN_LEFT_KEY, String(Number(marginFromUrl)));
            cachedConfig = null;
        }
        const marginRightFromUrl = params.get('printMarginRight');
        if (marginRightFromUrl != null && marginRightFromUrl !== '' && !Number.isNaN(Number(marginRightFromUrl))) {
            localStorage.setItem(PRINT_MARGIN_RIGHT_KEY, String(Number(marginRightFromUrl)));
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
        printViaKiosk,
        printViaWarmIframe,
        printViaPrintWindow,
        prewarmPrint,
        printViaHiddenIframe,
        printViaEscPos,
        pairPrinter,
        escposSupported,
        bridgeReachable,
        bridgeHealthUrl,
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
        setPrintMarginLeftMm(mm) {
            const value = Number(mm);
            if (!Number.isFinite(value)) {
                localStorage.removeItem(PRINT_MARGIN_LEFT_KEY);
                cachedConfig = null;
                return;
            }
            localStorage.setItem(PRINT_MARGIN_LEFT_KEY, String(value));
            cachedConfig = null;
        },
        getPrintMarginLeftMm: () => resolvePrintMarginLeftMm(),
        setPrintMarginRightMm(mm) {
            const value = Number(mm);
            if (!Number.isFinite(value)) {
                localStorage.removeItem(PRINT_MARGIN_RIGHT_KEY);
                cachedConfig = null;
                return;
            }
            localStorage.setItem(PRINT_MARGIN_RIGHT_KEY, String(value));
            cachedConfig = null;
        },
        getPrintMarginRightMm: () => resolvePrintMarginRightMm(),
    };

    if (document.body) {
        void prewarmPrint();
    } else {
        document.addEventListener('DOMContentLoaded', () => void prewarmPrint(), { once: true });
    }
})();
