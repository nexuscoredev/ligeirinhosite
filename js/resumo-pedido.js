(function () {
    const root = document.getElementById('resumo-app');
    if (!root) return;

    const cartApi = window.LigeirinhoCart;
    const auth = window.LigeirinhoAuth;
    if (!cartApi) return;

    const esc = (v) =>
        String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const formatPrice = (value) => cartApi.formatMoney(value);

    const onlyDocDigits = (value) => String(value || '').replace(/\D/g, '').slice(0, 14);

    const formatClienteDocInput = (value) => {
        const d = onlyDocDigits(value);
        if (d.length <= 11) {
            return window.LigeirinhoCpf?.formatCpf?.(d) || d;
        }
        return window.LigeirinhoCnpj?.formatCnpj?.(d) || d;
    };

    const validateClienteDocInput = (value) => {
        const d = onlyDocDigits(value);
        if (!d) return { ok: true, formatted: '' };
        if (d.length === 11) {
            if (window.LigeirinhoCpf?.isValidCpf && !window.LigeirinhoCpf.isValidCpf(d)) {
                return { ok: false, error: 'CPF inválido. Confira os dígitos.' };
            }
            return { ok: true, formatted: formatClienteDocInput(d), digits: d, kind: 'cpf' };
        }
        if (d.length === 14) {
            if (window.LigeirinhoCnpj?.isValidCnpj && !window.LigeirinhoCnpj.isValidCnpj(d)) {
                return { ok: false, error: 'CNPJ inválido. Confira os dígitos.' };
            }
            return { ok: true, formatted: formatClienteDocInput(d), digits: d, kind: 'cnpj' };
        }
        return { ok: false, error: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).' };
    };

    const session = () => auth?.loadSession?.() || null;

    const isHubUserUuid = (value) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            String(value || ''),
        );

    const resolveOrderHubUserId = (s) => {
        for (const candidate of [s?.hubUserId, s?.sub]) {
            const id = String(candidate || '').trim();
            if (isHubUserUuid(id)) return id;
        }
        return '';
    };

    const loadCheckoutState = () => cartApi.loadCheckout();

    const orderShortId = (id) =>
        String(id || '')
            .replace(/-/g, '')
            .slice(0, 8)
            .toUpperCase();

    const evaluateEditPolicy = (checkout) => {
        const editOrderId = String(checkout?.editOrderId || '').trim();
        if (!editOrderId) return null;
        const meta = checkout.editOrderMeta || {};
        const policyApi = window.LigeirinhoOrderEditPolicy;
        if (!policyApi?.evaluateOrderEditPolicy) return null;
        return policyApi.evaluateOrderEditPolicy(
            {
                id: editOrderId,
                deliveryDate: checkout.deliveryDate,
                deliveryType: checkout.deliveryType,
                notes: meta.notes || '',
                status: meta.status || 'pending',
                financialStatus: meta.financialStatus || '',
                channel: meta.channel || 'parceiros',
                tracking: { hubStatus: meta.hubStatus || '' },
            },
            { session: session() },
        );
    };

    const refreshEditOrderMeta = async (checkout) => {
        const editOrderId = String(checkout?.editOrderId || '').trim();
        if (!editOrderId) return checkout;
        try {
            const headers = await buildAccountHeaders();
            const res = await fetch('/api/orders/mine?limit=50', { headers });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return checkout;
            const order = (data.orders || []).find((entry) => entry.id === editOrderId);
            if (!order) return checkout;
            const next = {
                ...checkout,
                deliveryDate: order.deliveryDate || checkout.deliveryDate,
                deliveryType: order.deliveryType || checkout.deliveryType,
                editOrderMeta: {
                    notes: order.notes || '',
                    status: order.status || 'pending',
                    financialStatus: order.financialStatus || '',
                    hubStatus: order.tracking?.hubStatus || '',
                    channel: order.channel || 'parceiros',
                },
            };
            cartApi.saveCheckout(next);
            return next;
        } catch {
            return checkout;
        }
    };

    const buildAccountHeaders = async () => {
        const headers = { 'Content-Type': 'application/json' };
        const hubToken = await auth?.getHubAccessToken?.();
        if (hubToken) {
            headers.Authorization = `Bearer ${hubToken}`;
            return headers;
        }
        let accountToken = auth?.getAccountSessionToken?.();
        if (!accountToken) accountToken = await auth?.ensureAccountSession?.();
        if (accountToken) {
            headers['X-Account-Session'] = accountToken;
            return headers;
        }
        const googleCred = auth?.getGoogleCredential?.();
        if (googleCred) {
            headers['X-Google-Credential'] = googleCred;
            const s = session();
            if (s?.hubUserId) headers['X-Hub-User-Id'] = s.hubUserId;
            return headers;
        }
        const s = session();
        if (s?.provider === 'google' && s?.email) {
            headers['X-Auth-Provider'] = 'google';
            headers['X-Account-Email'] = s.email;
            if (s.sub) headers['X-Auth-Sub'] = s.sub;
            if (s.hubUserId) headers['X-Hub-User-Id'] = s.hubUserId;
        }
        return headers;
    };

    const assetUrl = (path) => {
        const value = String(path || '').trim();
        if (!value || /^https?:/i.test(value)) return value;
        return value.startsWith('/') ? value : `/${value.replace(/^\.\//, '')}`;
    };

    const PAYMENT_MARKS = {
        pix: { logo: '/img/icon-pix.svg' },
        mercado_pago: { logo: '/img/icon-pix.svg' },
        dinheiro: { icon: 'payments' },
        prazo: { icon: 'calendar_month' },
        boleto: { icon: 'description' },
    };

    const normalizePaymentUi = (method) => {
        const id = String(method?.id || '').toLowerCase();
        if (id === 'mercado_pago' || id === 'pix') {
            return {
                ...method,
                id: 'pix',
                label: 'PIX',
                hint: method.hint || 'Pagamento instantâneo',
            };
        }
        return method;
    };

    const enrichPaymentMethod = (method) => {
        const normalized = normalizePaymentUi(method);
        const mark = PAYMENT_MARKS[normalized.id] || {};
        const rawLogo = mark.logo || normalized.logo || '';
        return {
            ...normalized,
            icon: normalized.icon || mark.icon,
            logo: rawLogo ? assetUrl(rawLogo) : '',
        };
    };

    let paymentConfigCache = null;

    const loadPaymentConfig = async () => {
        if (paymentConfigCache) return paymentConfigCache;
        try {
            const res = await fetch('/api/payments/config');
            paymentConfigCache = await res.json().catch(() => ({}));
        } catch {
            paymentConfigCache = {};
        }
        return paymentConfigCache;
    };

    const paymentMethods = () => {
        const caps = paymentConfigCache?.capabilities;
        const base = [];
        if (caps?.pix || paymentConfigCache?.enabled) {
            base.push(
                enrichPaymentMethod({
                    id: 'pix',
                    label: 'PIX',
                    hint: 'Pagamento instantâneo',
                })
            );
        }
        if (!base.length) {
            base.push(
                enrichPaymentMethod({
                    id: 'pix',
                    label: 'PIX',
                    hint: 'Pagamento instantâneo',
                })
            );
        }
        base.push(
            enrichPaymentMethod({
                id: 'dinheiro',
                label: 'Dinheiro',
                hint: 'Na entrega ou retirada',
            })
        );
        const s = session();
        if (!s?.paymentMethods?.length) return base;
        const extra = s.paymentMethods
            .filter((m) => !['pix', 'cartao', 'mercado_pago', 'dinheiro'].includes(m.id))
            .map((m) => enrichPaymentMethod(m));
        return extra.length ? [...base, ...extra] : base;
    };

    const paymentMethodIconHtml = (opt, opts = {}) => {
        const compact = Boolean(opts.compact);
        const enriched = enrichPaymentMethod(opt);
        const logo = enriched.logo;
        if (logo) {
            const logoMod = enriched.id === 'pix' ? ' resumo-option__logo--pix' : '';
            const compactMod = compact ? ' resumo-option__logo--compact' : '';
            const w = compact ? 32 : 44;
            const h = compact ? 18 : 24;
            return `<img src="${esc(logo)}" alt="" class="resumo-option__logo${logoMod}${compactMod}" width="${w}" height="${h}" loading="lazy" decoding="async">`;
        }
        const icon =
            enriched.icon ||
            (enriched.id === 'dinheiro' ? 'payments' : enriched.id === 'prazo' ? 'calendar_month' : 'credit_card');
        const iconClass = compact ? ' resumo-option__icon--compact' : '';
        return `<span class="material-symbols-outlined resumo-option__icon${iconClass}" aria-hidden="true">${icon}</span>`;
    };

    const paymentPickerRowHtml = (opt, active) => `<button type="button" class="resumo-date-row resumo-payment-row${active ? ' resumo-date-row--active' : ''}" data-toggle-payment="${esc(opt.id)}" aria-pressed="${active ? 'true' : 'false'}">
<span class="resumo-date-row__radio" aria-hidden="true"></span>
<span class="resumo-date-row__main">
<span class="resumo-payment-row__copy">
<span class="resumo-payment-row__icon">${paymentMethodIconHtml(opt, { compact: true })}</span>
<span class="resumo-date-row__copy">
<strong class="resumo-date-row__date">${esc(opt.label)}</strong>
${opt.hint ? `<span class="resumo-date-row__weekday">${esc(opt.hint)}</span>` : ''}
</span>
</span>
</span>
</button>`;

    const resolvePaymentMethodForOrder = (method) => {
        const key = String(method || '').toLowerCase();
        if (!key || key === 'mercado_pago') return 'pix';
        return method;
    };

    const paymentMethodSelectHtml = (checkout, orderTotal = null) => {
        const api = splitsApi();
        if (api?.isMultiPayment?.(checkout)) {
            const summary = api.formatSplitSummary(
                checkout.paymentSplits,
                paymentLabelFor,
                formatPrice,
            );
            return `<span class="resumo-select-btn__payment resumo-select-btn__payment--multi"><span>${esc(summary)}</span></span>`;
        }
        const methodId = checkout.paymentMethod || checkout.payment;
        if (!methodId) return esc('Selecionar método');
        const resolvedId = resolvePaymentMethodForOrder(methodId);
        const opt = paymentMethods().find((m) => m.id === resolvedId);
        if (!opt) return esc('Selecionar método');
        return `<span class="resumo-select-btn__payment">${paymentMethodIconHtml(opt)}<span>${esc(opt.label)}</span></span>`;
    };

    const deliveryApi = window.LigeirinhoParceiroDelivery;
    const feeApi = () => window.LigeirinhoDeliveryFee;

    const isDistribuidoraAccount = () => {
        const s = session();
        const digits = String(s?.cnpj || s?.login || '').replace(/\D/g, '');
        return deliveryApi?.isDistribuidoraCnpj?.(digits) ?? false;
    };

    const parseMoneyInput = (raw) => {
        const api = splitsApi();
        if (api?.parseMoneyInput) return api.parseMoneyInput(raw);
        const cleaned = String(raw || '')
            .replace(/[^\d,.-]/g, '')
            .replace(/\./g, '')
            .replace(',', '.');
        const n = Number(cleaned);
        return Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0;
    };

    const formatMoneyInput = (value) => {
        const api = splitsApi();
        if (api?.formatMoneyInput) return api.formatMoneyInput(value);
        const n = Number(value);
        if (!Number.isFinite(n)) return '';
        return n.toFixed(2).replace('.', ',');
    };

    let priceTablesCache = null;
    let priceTablesLoading = false;
    let pickerCondicaoTabelaId = '';
    let pickerCondicaoTaxa = '';
    let pickerCondicaoError = '';
    let pickerCondicaoInitialized = false;
    let pickerCondicaoApplying = false;

    const loadPriceTables = async () => {
        if (priceTablesCache) return priceTablesCache;
        if (priceTablesLoading) return priceTablesCache || [];
        priceTablesLoading = true;
        try {
            const headers = await auth?.buildAccountHeaders?.();
            const res = await fetch('/api/catalog/tabelas', { headers: headers || {} });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Não foi possível carregar tabelas de preço.');
            priceTablesCache = Array.isArray(data.tabelas) ? data.tabelas : [];
            return priceTablesCache;
        } catch (err) {
            pickerCondicaoError = err.message || 'Erro ao carregar tabelas.';
            return [];
        } finally {
            priceTablesLoading = false;
        }
    };

    const buildCatalogPriceLookup = (catalog) => {
        const map = new Map();
        for (const cat of catalog?.categories || []) {
            for (const product of cat.products || []) {
                if (product.id) map.set(String(product.id), Number(product.price));
                if (product.hubId) map.set(String(product.hubId), Number(product.price));
            }
        }
        return map;
    };

    const applyOrderPriceTable = async (tabelaPrecoId) => {
        if (!tabelaPrecoId) return;
        const headers = await auth?.buildAccountHeaders?.();
        const url = `/api/catalog/by-table?tabelaPrecoId=${encodeURIComponent(tabelaPrecoId)}&sync=${Date.now()}`;
        const res = await fetch(url, { headers: headers || {} });
        const catalog = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(catalog.error || 'Falha ao aplicar tabela de preço.');
        const lookup = buildCatalogPriceLookup(catalog);
        const cart = cartApi.loadCart();
        let updated = false;
        Object.keys(cart).forEach((key) => {
            const item = cart[key];
            if (!item || item.isDeliveryFee) return;
            const next =
                lookup.get(String(item.id)) ??
                lookup.get(String(item.hubId)) ??
                lookup.get(String(item.cartKey));
            if (next != null && Number.isFinite(next) && next > 0) {
                cart[key] = { ...item, price: next };
                updated = true;
            }
        });
        if (updated) cartApi.saveCart(cart);
    };

    const condicaoPagamentoLabel = (checkout) => {
        const tableLabel =
            checkout.orderTabelaPrecoLabel ||
            checkout.orderTabelaPrecoCodigo ||
            (checkout.orderTabelaPrecoId ? 'Tabela personalizada' : '');
        const hasTaxa =
            checkout.orderTaxaEntrega !== undefined &&
            checkout.orderTaxaEntrega !== null &&
            checkout.orderTaxaEntrega !== '';
        const taxa = hasTaxa ? Number(checkout.orderTaxaEntrega) : null;
        if (!tableLabel && !hasTaxa) return 'Definir tabela e taxa de entrega';
        const parts = [];
        if (tableLabel) parts.push(`Tabela ${tableLabel}`);
        if (hasTaxa) {
            parts.push(`Taxa ${taxa > 0 ? formatPrice(taxa) : 'Grátis'}`);
        }
        return parts.join(' · ');
    };

    const initPickerCondicaoState = (checkout) => {
        pickerCondicaoTabelaId = checkout.orderTabelaPrecoId || '';
        const hasTaxa =
            checkout.orderTaxaEntrega !== undefined &&
            checkout.orderTaxaEntrega !== null &&
            checkout.orderTaxaEntrega !== '';
        pickerCondicaoTaxa = hasTaxa ? formatMoneyInput(checkout.orderTaxaEntrega) : '';
        pickerCondicaoError = '';
    };

    const orderTotals = (cart, checkout) => {
        const { units, subtotal } = cartApi.cartSummary(cart);
        const deliveryFee = feeApi()?.resolveFee?.(session(), checkout) ?? 0;
        const total = feeApi()?.orderTotal?.(subtotal, deliveryFee) ?? subtotal;
        return { units: Number(units) || 0, subtotal, deliveryFee, total };
    };

    const deliveryDateOpts = () => {
        const s = session();
        const cnpj = String(s?.cnpj || s?.login || '').replace(/\D/g, '');
        return { allowSameDay: deliveryApi?.isDistribuidoraCnpj?.(cnpj) ?? false };
    };

    const deliveryOptions = () => {
        const dias = session()?.datasEntrega || [];
        const checkout = loadCheckoutState();
        const fee = feeApi()?.resolveFee?.(session(), checkout) ?? 0;
        const priceLabel = feeApi()?.feeLabel?.(fee, formatPrice) ?? 'Grátis';
        const base =
            deliveryApi?.deliveryDateOptions?.(dias, deliveryDateOpts()) ||
            [];
        return base.map((opt) => ({ ...opt, priceLabel }));
    };

    const syncDeliveryDateWithHub = () => {
        const checkout = cartApi.loadCheckout();
        if (!checkout.deliveryDate) return;
        const dias = session()?.datasEntrega || [];
        const opts = deliveryDateOpts();
        if (deliveryApi?.isDeliveryDateAllowed && !deliveryApi.isDeliveryDateAllowed(checkout.deliveryDate, dias, opts)) {
            cartApi.saveCheckout({ deliveryDate: '' });
        }
    };

    const refreshParceiroProfile = async () => {
        const token = await auth?.getHubAccessToken?.();
        if (!token) return;
        try {
            const res = await fetch('/api/account/profile', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok && data.profile) auth.applyProfile(data.profile);
        } catch {
            /* mantém sessão local */
        }
    };

    let step = 'resumo';
    let pickerMode = null;
    let pickerPaymentIds = [];
    let pickerPaymentAmounts = {};
    let pickerPaymentError = '';
    let pickerPaymentInitialized = false;
    let pickerSelectedDate = '';
    let pickerDateError = '';
    let pickerDateInitialized = false;

    const splitsApi = () => window.LigeirinhoPaymentSplits;

    const paymentLabelFor = (id) => {
        const resolved = resolvePaymentMethodForOrder(id);
        const opt = paymentMethods().find((m) => m.id === resolved);
        return opt?.label || id || '';
    };

    const syncCheckoutFromSession = () => {
        const s = session();
        const patch = {};
        if (s?.condicaoPagamento) patch.condicaoPagamento = s.condicaoPagamento;
        if (Object.keys(patch).length) cartApi.saveCheckout(patch);
    };

    const validateCheckout = (checkout, orderTotal = null) => {
        const errors = {};
        if (checkout.deliveryType === 'entrega' && !checkout.address?.trim()) {
            errors.address = 'Informe o endereço para entrega.';
        }
        const opts = deliveryOptions();
        if (!checkout.deliveryDate) {
            errors.deliveryDate = 'Selecione a data de entrega.';
        } else if (!opts.some((d) => d.value === checkout.deliveryDate)) {
            errors.deliveryDate = 'Selecione uma data de entrega válida.';
        }
        if (!checkout.paymentMethod && !(checkout.paymentSplits || []).length) {
            errors.paymentMethod = 'Selecione o método de pagamento.';
        } else if (orderTotal != null && splitsApi()?.isMultiPayment?.(checkout)) {
            const check = splitsApi().validateCheckoutPayment(checkout, orderTotal, paymentLabelFor);
            if (!check.ok) errors.paymentMethod = check.error;
        } else if (resolvePaymentMethodForOrder(checkout.paymentMethod) === 'cartao') {
            errors.paymentMethod = 'Cartão não está disponível. Escolha PIX ou dinheiro.';
        }
        return errors;
    };

    const initPickerPaymentState = (checkout, total) => {
        const api = splitsApi();
        pickerPaymentError = '';
        pickerPaymentIds = api?.selectedMethodIds?.(checkout) || [];
        pickerPaymentAmounts = {};
        (checkout.paymentSplits || []).forEach((entry) => {
            const method = resolvePaymentMethodForOrder(entry.method);
            if (method) pickerPaymentAmounts[method] = api.formatMoneyInput(entry.amount);
        });
        if (pickerPaymentIds.length === 1 && !pickerPaymentAmounts[pickerPaymentIds[0]]) {
            pickerPaymentAmounts[pickerPaymentIds[0]] = api.formatMoneyInput(total);
        }
    };

    const togglePickerPayment = (id, total) => {
        const api = splitsApi();
        const method = resolvePaymentMethodForOrder(id);
        if (!method) return;
        pickerPaymentError = '';
        if (pickerPaymentIds.includes(method)) {
            pickerPaymentIds = pickerPaymentIds.filter((item) => item !== method);
            delete pickerPaymentAmounts[method];
            return;
        }
        pickerPaymentIds.push(method);
        if (pickerPaymentIds.length === 1) {
            pickerPaymentAmounts[method] = api.formatMoneyInput(total);
            return;
        }
        const first = pickerPaymentIds[0];
        const firstAmount = api.parseMoneyInput(pickerPaymentAmounts[first]);
        pickerPaymentAmounts[method] = api.formatMoneyInput(Math.max(0, total - firstAmount));
    };

    const pickerPaymentAmountsHtml = (total) => {
        if (pickerPaymentIds.length < 2) return '';
        const api = splitsApi();
        const splits = pickerPaymentIds.map((method) => ({
            method,
            amount: api.parseMoneyInput(pickerPaymentAmounts[method]),
        }));
        const meta = api.formatAmountsSumMeta(splits, total, {
            labelFn: paymentLabelFor,
            formatMoney: formatPrice,
        });
        const sumClass =
            meta.state === 'ok'
                ? ' resumo-payment-amounts__sum--ok'
                : meta.state === 'high'
                  ? ' resumo-payment-amounts__sum--high'
                  : ' resumo-payment-amounts__sum--low';
        return `<div class="resumo-payment-amounts">
<p class="resumo-payment-amounts__title">Quanto em cada forma?</p>
${pickerPaymentIds
    .map((id) => {
        const opt = paymentMethods().find((m) => m.id === id);
        const label = opt?.label || id;
        return `<label class="resumo-payment-amounts__row">
<span class="resumo-payment-amounts__label">${esc(label)}</span>
<span class="resumo-payment-amounts__field">
<span class="resumo-payment-amounts__prefix">R$</span>
<input type="text" inputmode="decimal" class="resumo-payment-amounts__input" data-payment-amount="${esc(id)}" value="${esc(pickerPaymentAmounts[id] || '')}" placeholder="0,00" autocomplete="off">
</span>
</label>`;
    })
    .join('')}
<p class="resumo-payment-amounts__sum${sumClass}">${meta.html}</p>
</div>`;
    };

    const savePickerPayment = (total) => {
        const api = splitsApi();
        if (!pickerPaymentIds.length) {
            pickerPaymentError = 'Selecione pelo menos uma forma de pagamento.';
            return false;
        }
        if (pickerPaymentIds.length === 1) {
            const method = pickerPaymentIds[0];
            cartApi.saveCheckout({
                paymentMethod: method,
                payment: method,
                paymentSplits: [],
            });
            return true;
        }
        const splits = pickerPaymentIds.map((method) => ({
            method,
            amount: api.parseMoneyInput(pickerPaymentAmounts[method]),
        }));
        const check = api.validateSplits(splits, total, paymentLabelFor);
        if (!check.ok) {
            pickerPaymentError = check.error;
            return false;
        }
        cartApi.saveCheckout({
            paymentMethod: splits[0].method,
            payment: splits[0].method,
            paymentSplits: check.splits,
        });
        return true;
    };

    const headerHtml = (title, subtitle) => {
        const sub =
            subtitle ||
            String(session()?.razaoSocial || session()?.name || 'Ligeirinho Parceiros').toUpperCase();
        return `<header class="resumo-header">
<button type="button" class="resumo-header__back" id="resumo-back" aria-label="Voltar">
<span class="material-symbols-outlined">arrow_back</span>
</button>
<div class="resumo-header__main">
<h1 class="resumo-header__title">${esc(title)}</h1>
<p class="resumo-header__sub">${esc(sub)}</p>
</div>
</header>`;
    };

    const productThumbHtml = (item) => {
        const src = item.image ? assetUrl(item.image) : '';
        if (src) {
            return `<span class="resumo-product__thumb-box"><img src="${esc(src)}" alt="" class="resumo-product__thumb" loading="lazy" width="56" height="56" decoding="async"></span>`;
        }
        return `<span class="resumo-product__thumb-box resumo-product__thumb--placeholder" aria-hidden="true"><span class="material-symbols-outlined">liquor</span></span>`;
    };

    const productPackDetail = (item) => {
        if (item?.isDeliveryFee) return 'Taxa de entrega';
        const pack = cartApi.packTypeLabel(item.packType);
        const boxMatch = String(item.name || '').match(/\(Caixa c\/\s*(\d+)\)/i);
        if (boxMatch) return `1 Unidade · Caixa contém ${boxMatch[1]} unidades`;
        if (item.packType === 'caixa') return `1 Caixa · preço por embalagem`;
        return `1 ${pack} · ${formatPrice(item.price)}`;
    };

    const vendorCardHtml = () => {
        const s = session();
        const vendorName = s?.razaoSocial || s?.name || 'Parceiro';
        const initials = vendorName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0])
            .join('')
            .toUpperCase();
        return `<section class="resumo-vendor-card" aria-label="Distribuidor">
<span class="resumo-vendor-card__logo" aria-hidden="true">${esc(initials || 'LG')}</span>
<div class="resumo-vendor-card__body">
<p class="resumo-vendor-card__name">${esc(vendorName)}</p>
<p class="resumo-vendor-card__meta">Ligeirinho Distribuição</p>
</div>
</section>`;
    };

    const productLineHtml = (item) => {
        const lineTotal = formatPrice((item.price || 0) * item.qty);
        const unitPrice = formatPrice(item.price || 0);
        return `<article class="resumo-product resumo-product--rich">
${productThumbHtml(item)}
<div class="resumo-product__main">
<p class="resumo-product__name">${esc(item.name)}</p>
<p class="resumo-product__detail">${esc(productPackDetail(item))}</p>
<p class="resumo-product__unit-price">${unitPrice}</p>
</div>
<div class="resumo-product__side">
<span class="resumo-product__qty">x${item.qty}</span>
<strong class="resumo-product__total">${lineTotal}</strong>
</div>
</article>`;
    };

    const cardHtml = (title, body, badge = '') => `<section class="resumo-card">
<div class="resumo-card__head">
<h2 class="resumo-card__title">${esc(title)}</h2>
${badge ? `<span class="resumo-card__badge">${esc(badge)}</span>` : ''}
</div>
${body}
</section>`;

    const renderResumo = () => {
        syncCheckoutFromSession();
        const cart = cartApi.loadCart();
        const items = cartApi.cartEntries(cart);
        if (!items.length) {
            root.innerHTML = `${headerHtml('Resumo do pedido')}
<div class="resumo-empty"><p>Carrinho vazio.</p><a href="pedidos.html" class="conta-btn conta-btn--primary">Ver catálogo</a></div>`;
            bindBack('caminhao.html');
            return;
        }

        const checkout = loadCheckoutState();
        const editOrderId = String(checkout.editOrderId || '').trim();
        const isEditing = Boolean(editOrderId);
        const editPolicy = isEditing ? evaluateEditPolicy(checkout) : null;
        const editBlocked = Boolean(editPolicy && !editPolicy.canEdit);
        const editBlockedMessage =
            editPolicy?.editBlockedReason === 'delivery_day'
                ? 'Hoje é o dia de entrega ou retirada. Volte em Meus pedidos e solicite permissão para editar.'
                : editPolicy?.editPermissionRequested
                  ? 'Solicitação de edição enviada. Aguarde a liberação da loja.'
                  : 'Este pedido não pode ser editado.';
        const { units, subtotal, deliveryFee, total } = orderTotals(cart, checkout);
        const s = session();
        const errors = validateCheckout(checkout, total);
        const dateLabel =
            deliveryOptions().find((d) => d.value === checkout.deliveryDate)?.label || 'Selecionar data';
        const diasLabel = s?.datasEntrega?.length
            ? s?.diasEntregaLabel || deliveryApi?.rotuloDiasEntrega?.(s?.datasEntrega) || ''
            : '';
        const payLabel = paymentMethodSelectHtml(checkout, total);
        const condicaoCard = isDistribuidoraAccount()
            ? cardHtml(
                  'Condição de pagamento',
                  `<p class="resumo-field-hint">Tabela de preço e taxa de entrega deste pedido</p>
<button type="button" class="resumo-select-btn" data-open-picker="condicao">${esc(condicaoPagamentoLabel(checkout))}</button>`,
              )
            : '';
        const clienteNomeCard = isDistribuidoraAccount()
            ? cardHtml(
                  'Nome do cliente',
                  `<p class="resumo-field-hint">Cliente final deste pedido (aparece no Hub e no DAV)</p>
<label class="resumo-payment-amounts__row resumo-cliente-nome-row">
<span class="resumo-payment-amounts__label">Nome</span>
<span class="resumo-payment-amounts__field">
<input type="text" class="resumo-payment-amounts__input resumo-cliente-nome-input" id="resumo-cliente-nome" value="${esc(checkout.orderClienteNome || '')}" placeholder="Ex.: ADEGA DO JOÃO" autocomplete="name" maxlength="120">
</span>
</label>
<label class="resumo-payment-amounts__row resumo-cliente-doc-row">
<span class="resumo-payment-amounts__label">CPF/CNPJ</span>
<span class="resumo-payment-amounts__field">
<input type="text" class="resumo-payment-amounts__input resumo-cliente-doc-input" id="resumo-cliente-doc" value="${esc(checkout.orderClienteDoc || '')}" placeholder="000.000.000-00 ou 00.000.000/0000-00" inputmode="numeric" autocomplete="off" maxlength="18">
</span>
</label>
<p class="resumo-field-hint resumo-cliente-doc-hint">O documento entra na identificação do destinatário na DAV.</p>`,
              )
            : '';

        const feeDisplayItem = deliveryFee > 0 ? feeApi()?.buildDisplayItem?.(deliveryFee) : null;
        const listItems = feeDisplayItem ? [feeDisplayItem, ...items] : items;
        const productsBody = `<div class="resumo-products-list">${listItems.map(productLineHtml).join('')}</div>`;

        root.innerHTML = `<div class="resumo-shell">
${headerHtml(isEditing ? 'Editar pedido' : 'Resumo do pedido', 'LIGEIRINHO DISTRIBUI')}
<div class="resumo-content">
${isEditing ? `<p class="resumo-edit-banner" role="status">Alterando pedido <strong>#${esc(orderShortId(editOrderId))}</strong>. Salve para atualizar no Hub.</p>` : ''}
${editBlocked ? `<p class="resumo-edit-banner resumo-edit-banner--blocked" role="alert">${esc(editBlockedMessage)}</p>` : ''}
${vendorCardHtml()}
${cardHtml(
    'Data de entrega',
    `${diasLabel ? `<p class="resumo-field-hint">Dias de entrega: ${esc(diasLabel)}</p>` : '<p class="resumo-field-hint">Campo obrigatório</p>'}
<button type="button" class="resumo-select-btn${errors.deliveryDate ? ' resumo-select-btn--error' : ''}" data-open-picker="date">${esc(dateLabel)}</button>
${errors.deliveryDate ? `<p class="resumo-error">${esc(errors.deliveryDate)}</p>` : ''}`
)}
${cardHtml(
    'Método de pagamento',
    `<p class="resumo-field-hint">Campo obrigatório</p>
<button type="button" class="resumo-select-btn resumo-select-btn--payment${errors.paymentMethod ? ' resumo-select-btn--error' : ''}" data-open-picker="payment">${payLabel}</button>
${errors.paymentMethod ? `<p class="resumo-error">${esc(errors.paymentMethod)}</p>` : ''}`
)}
${condicaoCard}
${clienteNomeCard}
${cardHtml('Produtos', productsBody, String(units))}
${cardHtml(
    'Resumo do pedido',
    `<div class="resumo-total-row resumo-total-row--final"><span>Subtotal (${units} ${units === 1 ? 'produto' : 'produtos'})</span><strong>${formatPrice(subtotal)}</strong></div>
<div class="resumo-total-row"><span>Taxa de entrega</span><span class="${deliveryFee > 0 ? '' : 'resumo-free'}">${esc(feeApi()?.feeLabel?.(deliveryFee, formatPrice) || 'Grátis')}</span></div>
<div class="resumo-total-row resumo-total-row--final"><span>Total</span><strong>${formatPrice(total)}</strong></div>`
)}
</div>
<div class="resumo-footer resumo-footer--action">
<button type="button" class="resumo-confirm-btn" id="resumo-confirm" ${Object.keys(errors).length || editBlocked ? 'disabled' : ''}>
<span>${isEditing ? 'Salvar alterações' : 'Confirmar pedido'}</span>
<span class="resumo-confirm-btn__icon material-symbols-outlined">arrow_forward</span>
</button>
</div>
</div>`;

        bindBack('caminhao.html');
        root.querySelectorAll('[data-open-picker]').forEach((btn) => {
            btn.addEventListener('click', () => {
                pickerMode = btn.dataset.openPicker;
                if (pickerMode === 'payment') pickerPaymentInitialized = false;
                if (pickerMode === 'condicao') pickerCondicaoInitialized = false;
                step = 'picker';
                render();
            });
        });
        root.querySelector('#resumo-cliente-nome')?.addEventListener('input', (event) => {
            cartApi.saveCheckout({ orderClienteNome: event.target.value });
        });
        const docInput = root.querySelector('#resumo-cliente-doc');
        docInput?.addEventListener('input', (event) => {
            const formatted = formatClienteDocInput(event.target.value);
            event.target.value = formatted;
            cartApi.saveCheckout({ orderClienteDoc: formatted });
        });
        docInput?.addEventListener('blur', (event) => {
            const check = validateClienteDocInput(event.target.value);
            if (check.ok && check.formatted) {
                event.target.value = check.formatted;
                cartApi.saveCheckout({ orderClienteDoc: check.formatted });
            }
        });
        root.querySelector('#resumo-confirm')?.addEventListener('click', () => confirmOrder());
    };

    const renderCondicaoPickerBody = (tables) => {
        const tableRows = (tables || [])
            .map((table) => {
                const active = pickerCondicaoTabelaId === table.id;
                const label = table.padrao
                    ? `${table.codigo || table.nome} (padrão)`
                    : table.nome || table.codigo || 'Tabela';
                return `<button type="button" class="resumo-option resumo-option--payment${active ? ' resumo-option--active' : ''}" data-pick-tabela="${esc(table.id)}" aria-pressed="${active ? 'true' : 'false'}">
<span class="material-symbols-outlined resumo-option__check" aria-hidden="true">${active ? 'check_circle' : 'radio_button_unchecked'}</span>
<div class="resumo-option__body">
<strong>${esc(label)}</strong>
<span>${esc(table.codigo || '')}</span>
</div>
</button>`;
            })
            .join('');

        return `<div class="resumo-picker-stack">
<div class="resumo-picker-stack__methods resumo-picker-stack__methods--condicao">
${tables?.length ? tableRows : `<p class="resumo-field-hint">${priceTablesLoading ? 'Carregando tabelas…' : 'Nenhuma tabela disponível.'}</p>`}
</div>
<div class="resumo-payment-amounts resumo-payment-amounts--condicao">
<p class="resumo-payment-amounts__title">Taxa de entrega deste pedido</p>
<label class="resumo-payment-amounts__row">
<span class="resumo-payment-amounts__label">Valor (R$)</span>
<span class="resumo-payment-amounts__field">
<span class="resumo-payment-amounts__prefix">R$</span>
<input type="text" inputmode="decimal" class="resumo-payment-amounts__input" id="resumo-condicao-taxa" value="${esc(pickerCondicaoTaxa)}" placeholder="100,00" autocomplete="off">
</span>
</label>
<p class="resumo-field-hint">Deixe em branco para usar a taxa padrão da conta. Use 0 para entrega grátis.</p>
</div>
${pickerCondicaoError ? `<p class="resumo-error resumo-picker-error">${esc(pickerCondicaoError)}</p>` : ''}
<div class="resumo-picker-stack__footer">
<button type="button" class="resumo-confirm-btn resumo-payment-confirm" id="resumo-condicao-confirm"${pickerCondicaoApplying ? ' disabled' : ''}>
<span>${pickerCondicaoApplying ? 'Aplicando…' : 'Confirmar condição'}</span>
<span class="resumo-confirm-btn__icon material-symbols-outlined">arrow_forward</span>
</button>
</div>
</div>`;
    };

    const renderPicker = () => {
        const checkout = loadCheckoutState();
        const cart = cartApi.loadCart();
        const { total } = orderTotals(cart, loadCheckoutState());
        const title =
            pickerMode === 'date'
                ? 'Data de entrega'
                : pickerMode === 'condicao'
                  ? 'Condição de pagamento'
                  : 'Condições de pagamento';

        let body = '';
        const options = deliveryOptions();
        if (pickerMode === 'date') {
            if (!pickerDateInitialized) {
                pickerSelectedDate = checkout.deliveryDate || options[0]?.value || '';
                pickerDateError = '';
                pickerDateInitialized = true;
            }
            const formatDateLabel = (iso, fallback) => {
                const [y, m, d] = String(iso || '').split('-').map(Number);
                if (!y || !m || !d) return fallback || '';
                const date = new Date(y, m - 1, d, 12);
                return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
            };
            const isFreeLabel = (label) => /^gr[aá]tis$/i.test(String(label || '').trim());
            const dateRows = options
                .map(
                    (opt) => {
                        const feeFree = isFreeLabel(opt.priceLabel);
                        const active = pickerSelectedDate === opt.value;
                        const feeLabel = opt.priceLabel || 'Grátis';
                        return `<button type="button" class="resumo-date-row${active ? ' resumo-date-row--active' : ''}" data-pick-date="${esc(opt.value)}" aria-pressed="${active ? 'true' : 'false'}">
<span class="resumo-date-row__radio" aria-hidden="true"></span>
<span class="resumo-date-row__main">
<span class="resumo-date-row__copy">
<strong class="resumo-date-row__date">${esc(formatDateLabel(opt.value, opt.label))}</strong>
<span class="resumo-date-row__weekday">${esc(opt.weekday)}</span>
</span>
<span class="resumo-date-row__fee${feeFree ? ' resumo-date-row__fee--free' : ''}">${esc(feeLabel)}</span>
</span>
</button>`;
                    },
                )
                .join('');
            body = `<div class="resumo-picker-stack resumo-picker-stack--date">
<div class="resumo-date-list" role="listbox" aria-label="Datas de entrega">${dateRows}</div>
${pickerDateError ? `<p class="resumo-error resumo-picker-error">${esc(pickerDateError)}</p>` : ''}
<div class="resumo-picker-stack__footer">
<button type="button" class="resumo-confirm-btn resumo-date-confirm" id="resumo-date-confirm"${pickerSelectedDate ? '' : ' disabled'}>
<span>Continuar</span>
<span class="resumo-confirm-btn__icon material-symbols-outlined">arrow_forward</span>
</button>
</div>
</div>`;
        } else if (pickerMode === 'condicao') {
            if (!pickerCondicaoInitialized) {
                initPickerCondicaoState(checkout);
                pickerCondicaoInitialized = true;
                if (!priceTablesCache && !priceTablesLoading) {
                    void loadPriceTables().then((tables) => {
                        if (!pickerCondicaoTabelaId && tables?.length) {
                            const padrao = tables.find((row) => row.padrao) || tables[0];
                            pickerCondicaoTabelaId = padrao?.id || '';
                        }
                        renderPicker();
                    });
                }
            }
            body = renderCondicaoPickerBody(priceTablesCache || []);
        } else {
            if (!pickerPaymentInitialized) {
                initPickerPaymentState(checkout, total);
                pickerPaymentInitialized = true;
            }
            body = `<div class="resumo-picker-stack resumo-picker-stack--payment">
<div class="resumo-date-list" role="listbox" aria-label="Formas de pagamento">${paymentMethods()
                .map((opt) => paymentPickerRowHtml(opt, pickerPaymentIds.includes(opt.id)))
                .join('')}</div>
${pickerPaymentAmountsHtml(total)}
${pickerPaymentError ? `<p class="resumo-error resumo-picker-error">${esc(pickerPaymentError)}</p>` : ''}
<div class="resumo-picker-stack__footer">
<button type="button" class="resumo-confirm-btn resumo-payment-confirm" id="resumo-payment-confirm">
<span>Confirmar pagamento</span>
<span class="resumo-confirm-btn__icon material-symbols-outlined">arrow_forward</span>
</button>
</div>
</div>`;
        }

        const pickerLead =
            pickerMode === 'date'
                ? (() => {
                      const diasLabel =
                          session()?.datasEntrega?.length
                              ? session()?.diasEntregaLabel || ''
                              : '';
                      const isFreeLabel = (label) => /^gr[aá]tis$/i.test(String(label || '').trim());
                      const allFree = options.length && options.every((o) => isFreeLabel(o.priceLabel));
                      const feeHint = allFree
                          ? ' Entrega grátis.'
                          : options[0]?.priceLabel
                            ? ` Taxa: ${options[0].priceLabel}.`
                            : '';
                      return diasLabel
                          ? `Entrega: ${diasLabel}.${feeHint}`
                          : `Escolha a data de entrega.${feeHint}`;
                  })()
                : pickerMode === 'condicao'
                  ? 'Escolha a tabela de preço e a taxa de entrega aplicadas somente a este pedido.'
                  : 'Selecione uma ou mais formas. Com mais de uma, informe o valor de cada.';

        root.innerHTML = `<div class="resumo-shell resumo-shell--picker${pickerMode === 'date' ? ' resumo-shell--picker-date' : pickerMode === 'payment' ? ' resumo-shell--picker-payment' : ''}">
${headerHtml(title)}
<div class="resumo-content resumo-content--picker${pickerMode === 'date' ? ' resumo-content--picker-date' : pickerMode === 'payment' ? ' resumo-content--picker-payment' : ''}">
<p class="resumo-picker-lead">${esc(pickerLead)}</p>
${body}
</div>
</div>`;

        bindBack('resumo');
        root.querySelectorAll('[data-pick-date]').forEach((btn) => {
            btn.addEventListener('click', () => {
                pickerSelectedDate = btn.dataset.pickDate || '';
                pickerDateError = '';
                renderPicker();
            });
        });
        root.querySelector('#resumo-date-confirm')?.addEventListener('click', () => {
            if (!pickerSelectedDate) {
                pickerDateError = 'Selecione uma data de entrega.';
                renderPicker();
                return;
            }
            if (!options.some((opt) => opt.value === pickerSelectedDate)) {
                pickerDateError = 'Selecione uma data de entrega válida.';
                renderPicker();
                return;
            }
            cartApi.saveCheckout({ deliveryDate: pickerSelectedDate });
            pickerDateError = '';
            pickerDateInitialized = false;
            step = 'picker';
            pickerMode = 'payment';
            pickerPaymentInitialized = false;
            render();
        });
        root.querySelectorAll('[data-toggle-payment]').forEach((btn) => {
            btn.addEventListener('click', () => {
                togglePickerPayment(btn.dataset.togglePayment, total);
                renderPicker();
            });
        });
        const refreshPickerPaymentSum = (totalValue) => {
            const api = splitsApi();
            const amounts = root.querySelector('.resumo-payment-amounts');
            if (!amounts || !api?.refreshAmountsSumEl) return;
            const splits = pickerPaymentIds.map((method) => ({
                method,
                amount: api.parseMoneyInput(pickerPaymentAmounts[method]),
            }));
            api.refreshAmountsSumEl(amounts, splits, totalValue, {
                labelFn: paymentLabelFor,
                formatMoney: formatPrice,
                sumClassBase: 'resumo-payment-amounts__sum',
            });
        };

        root.querySelectorAll('[data-payment-amount]').forEach((input) => {
            input.addEventListener('input', () => {
                pickerPaymentAmounts[input.dataset.paymentAmount] = input.value;
                refreshPickerPaymentSum(total);
            });
            input.addEventListener('blur', () => {
                const api = splitsApi();
                const id = input.dataset.paymentAmount;
                const formatted = api.formatMoneyInput(api.parseMoneyInput(input.value));
                pickerPaymentAmounts[id] = formatted;
                input.value = formatted;
                refreshPickerPaymentSum(total);
            });
        });
        root.querySelector('#resumo-payment-confirm')?.addEventListener('click', () => {
            if (!savePickerPayment(total)) {
                renderPicker();
                return;
            }
            step = 'resumo';
            pickerMode = null;
            pickerPaymentInitialized = false;
            render();
        });
        root.querySelectorAll('[data-pick-tabela]').forEach((btn) => {
            btn.addEventListener('click', () => {
                pickerCondicaoTabelaId = btn.dataset.pickTabela || '';
                pickerCondicaoError = '';
                renderPicker();
            });
        });
        root.querySelector('#resumo-condicao-taxa')?.addEventListener('input', (event) => {
            pickerCondicaoTaxa = event.target.value;
        });
        root.querySelector('#resumo-condicao-taxa')?.addEventListener('blur', (event) => {
            pickerCondicaoTaxa = formatMoneyInput(parseMoneyInput(event.target.value));
            renderPicker();
        });
        root.querySelector('#resumo-condicao-confirm')?.addEventListener('click', async () => {
            if (pickerCondicaoApplying) return;
            pickerCondicaoError = '';
            if (!pickerCondicaoTabelaId) {
                pickerCondicaoError = 'Selecione uma tabela de preço.';
                renderPicker();
                return;
            }
            const tables = priceTablesCache || [];
            const selected = tables.find((row) => row.id === pickerCondicaoTabelaId);
            if (!selected) {
                pickerCondicaoError = 'Tabela de preço inválida.';
                renderPicker();
                return;
            }
            const taxaRaw = String(pickerCondicaoTaxa || '').trim();
            const patch = {
                orderTabelaPrecoId: selected.id,
                orderTabelaPrecoCodigo: selected.codigo || '',
                orderTabelaPrecoLabel: selected.nome || selected.codigo || '',
                orderTaxaEntrega: taxaRaw ? parseMoneyInput(taxaRaw) : null,
            };
            pickerCondicaoApplying = true;
            renderPicker();
            try {
                await applyOrderPriceTable(selected.id);
                cartApi.saveCheckout(patch);
                step = 'resumo';
                pickerMode = null;
                pickerCondicaoInitialized = false;
                render();
            } catch (err) {
                pickerCondicaoError = err.message || 'Não foi possível aplicar a tabela.';
                renderPicker();
            } finally {
                pickerCondicaoApplying = false;
            }
        });
    };

    const confirmOrder = async () => {
        const cart = cartApi.loadCart();
        let checkout = loadCheckoutState();
        const errors = validateCheckout(checkout, orderTotals(cart, checkout).total);
        if (Object.keys(errors).length) {
            step = 'resumo';
            render();
            return;
        }

        const editOrderId = String(checkout.editOrderId || '').trim();
        if (editOrderId) {
            checkout = await refreshEditOrderMeta(checkout);
            const editPolicy = evaluateEditPolicy(checkout);
            if (editPolicy && !editPolicy.canEdit) {
                const message =
                    editPolicy.editBlockedReason === 'delivery_day'
                        ? 'Hoje é o dia de entrega ou retirada. Solicite permissão em Meus pedidos.'
                        : editPolicy.editPermissionRequested
                          ? 'Solicitação de edição enviada. Aguarde a liberação da loja.'
                          : 'Este pedido não pode ser editado.';
                window.alert(message);
                render();
                return;
            }
        }

        const btn = root.querySelector('#resumo-confirm');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Processando…';
        }

        await auth?.ensureAccountSession?.();
        const s = session();
        const hubUserId = resolveOrderHubUserId(s);
        const items = cartApi.cartEntries(cart).map((item) => ({
            id: item.id,
            hubId: item.hubId || '',
            sku: item.sku || '',
            cartKey: item.cartKey || item.id,
            name: item.name,
            price: item.price,
            qty: item.qty,
            packType: item.packType,
        }));

        const paymentMethod = resolvePaymentMethodForOrder(checkout.paymentMethod);
        const paymentSplits = splitsApi()?.normalizeSplits?.(checkout.paymentSplits || []) || [];
        const notesParts = [
            checkout.notes,
            checkout.deliveryDate ? `Entrega: ${checkout.deliveryDate}` : '',
            checkout.condicaoPagamento ? `Condição: ${checkout.condicaoPagamento}` : '',
        ].filter(Boolean);
        let notes = notesParts.join(' · ');
        if (paymentSplits.length >= 2) {
            notes = splitsApi().encodeSplitsInNotes(notes, paymentSplits) || notes;
        }

        try {
            const payload = {
                    items,
                    deliveryType: checkout.deliveryType,
                    address: checkout.address,
                    notes,
                    paymentMethod,
                    paymentSplits: paymentSplits.length >= 2 ? paymentSplits : undefined,
                    condicaoPagamento: checkout.condicaoPagamento || s?.condicaoPagamento || '',
                    deliveryDate: checkout.deliveryDate,
                    hubUserId,
                    customer: {
                        name: s?.name || s?.razaoSocial || '',
                        phone: s?.phone || '',
                        email: s?.email || '',
                        hubUserId,
                        cnpj: s?.cnpj || '',
                    },
                };
            if (isDistribuidoraAccount()) {
                if (checkout.orderTabelaPrecoId) {
                    payload.orderTabelaPrecoId = checkout.orderTabelaPrecoId;
                    payload.orderTabelaPrecoCodigo = checkout.orderTabelaPrecoCodigo || '';
                }
                if (
                    checkout.orderTaxaEntrega !== undefined &&
                    checkout.orderTaxaEntrega !== null &&
                    checkout.orderTaxaEntrega !== ''
                ) {
                    payload.orderTaxaEntrega = checkout.orderTaxaEntrega;
                }
                const orderClienteNome = String(checkout.orderClienteNome || '').trim();
                if (orderClienteNome) {
                    payload.orderClienteNome = orderClienteNome;
                    payload.customer.name = orderClienteNome;
                }
                const docCheck = validateClienteDocInput(checkout.orderClienteDoc || '');
                if (!docCheck.ok) {
                    window.alert(docCheck.error);
                    if (btn) {
                        btn.disabled = false;
                        const editing = Boolean(String(loadCheckoutState().editOrderId || '').trim());
                        btn.innerHTML = editing
                            ? '<span>Salvar alterações</span><span class="resumo-confirm-btn__icon material-symbols-outlined">arrow_forward</span>'
                            : '<span>Confirmar pedido</span><span class="resumo-confirm-btn__icon material-symbols-outlined">arrow_forward</span>';
                    }
                    return;
                }
                if (docCheck.formatted) {
                    payload.orderClienteDoc = docCheck.formatted;
                    if (docCheck.kind === 'cpf') {
                        payload.customer.cpf = docCheck.digits;
                    }
                }
            }

            const editOrderId = String(checkout.editOrderId || '').trim();
            const isEditing = Boolean(editOrderId);
            let res;
            if (isEditing) {
                payload.orderId = editOrderId;
                const headers = await buildAccountHeaders();
                if (s?.sub) headers['X-Auth-Sub'] = s.sub;
                if (s?.email) headers['X-Account-Email'] = s.email;
                res = await fetch('/api/orders/update', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload),
                });
            } else {
                res = await fetch('/api/orders/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            }
            const data = await res.json();
            if (!res.ok) {
                throw new Error(
                    data.error || (isEditing ? 'Não foi possível atualizar o pedido.' : 'Não foi possível criar o pedido.'),
                );
            }

            const savedOrderId = isEditing ? editOrderId : data.orderId;
            cartApi.saveLastOrder(cart, checkout, savedOrderId);
            // Próximo pedido não herda divisão/pagamento (nem id de edição).
            cartApi.saveCheckout({
                editOrderId: '',
                editOrderMeta: undefined,
                payment: '',
                paymentMethod: '',
                paymentSplits: [],
                orderClienteNome: '',
                orderClienteDoc: '',
            });
            if (checkout.deliveryType === 'entrega' && checkout.address?.trim()) {
                cartApi.saveAddressToHistory?.({
                    address: checkout.address,
                    addressParts: checkout.addressParts || {},
                    label: checkout.addressParts?.label || '',
                });
            }
            cartApi.saveCart({});
            window.location.href = `pedido-confirmado.html?order=${encodeURIComponent(savedOrderId)}`;
        } catch (err) {
            alert(err.message || 'Erro ao confirmar pedido.');
            if (btn) {
                btn.disabled = false;
                const isEditing = Boolean(String(loadCheckoutState().editOrderId || '').trim());
                btn.innerHTML = isEditing
                    ? '<span>Salvar alterações</span><span class="resumo-confirm-btn__icon material-symbols-outlined">arrow_forward</span>'
                    : '<span>Confirmar pedido</span><span class="resumo-confirm-btn__icon material-symbols-outlined">arrow_forward</span>';
            }
        }
    };

    const bindBack = (fallback) => {
        root.querySelector('#resumo-back')?.addEventListener('click', () => {
            if (step === 'picker') {
                step = 'resumo';
                pickerMode = null;
                pickerPaymentInitialized = false;
                pickerDateInitialized = false;
                pickerSelectedDate = '';
                pickerDateError = '';
                pickerCondicaoInitialized = false;
                pickerCondicaoError = '';
                render();
                return;
            }
            window.location.href = fallback;
        });
    };

    const render = () => {
        if (step === 'picker') renderPicker();
        else renderResumo();
    };

    const params = new URLSearchParams(window.location.search);
    if (params.get('picker') === 'date') {
        step = 'picker';
        pickerMode = 'date';
    } else if (params.get('picker') === 'payment') {
        step = 'picker';
        pickerMode = 'payment';
    } else if (params.get('picker') === 'condicao' && isDistribuidoraAccount()) {
        step = 'picker';
        pickerMode = 'condicao';
    }

    const boot = async () => {
        await loadPaymentConfig();
        await refreshParceiroProfile();
        syncDeliveryDateWithHub();
        const checkout = loadCheckoutState();
        if (String(checkout.editOrderId || '').trim()) {
            await refreshEditOrderMeta(checkout);
        }
        render();
    };

    boot();
})();
