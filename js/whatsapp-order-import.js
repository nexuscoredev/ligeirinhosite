(function () {
    const MIN_MATCH_SCORE = 22;
    const AMBIGUOUS_SCORE = 45;

    const TYPO_FIX = {
        amistel: 'amstel',
        amstel: 'amstel',
        beefeter: 'beefeater',
        beefeater: 'beefeater',
        heineken: 'heineken',
        absolut: 'absolut',
        h20: 'h2o',
        h2oh: 'h2o',
        agua: 'agua',
        buchanas: 'buchanans',
        buchanans: 'buchanans',
        buchannan: 'buchanans',
        blacklabel: 'black label',
        'black label': 'black label',
        's/gas': 'sem gas',
        'c/gas': 'com gas',
    };

    const DESCRIPTOR_WORDS = new Set([
        'tradicional',
        'original',
        'special',
        'reserve',
        'reserva',
        'premium',
        'gold',
        'black',
        'red',
        'zero',
        'diet',
        'light',
        'retornavel',
        'lata',
        'long',
        'neck',
        'garrafa',
        'anos',
        '12',
        '18',
    ]);

    let deps = {};
    let step = 'paste';
    let rows = [];
    let displayItems = [];
    let catalogReady = null;

    const esc = (value) =>
        String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const formatPrice = (value) =>
        Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const DISTRIBUIDORA_CNPJ = '45028186000125';

    const accountDigits = (session) =>
        String(session?.cnpj || session?.login || '').replace(/\D/g, '');

    const isEnabled = () => {
        const s = window.LigeirinhoAuth?.loadSession?.();
        if (!s) return false;
        if (window.LigeirinhoOrderDavPrint?.isDistribuidoraAccount?.(s)) return true;
        const digits = accountDigits(s);
        if (window.LigeirinhoParceiroDelivery?.isDistribuidoraCnpj?.(digits)) return true;
        return digits === DISTRIBUIDORA_CNPJ;
    };

    const modal = () => document.getElementById('lig-wa-import-modal');
    const textarea = () => document.getElementById('lig-wa-import-text');
    const pasteStep = () => document.getElementById('lig-wa-import-step-paste');
    const reviewStep = () => document.getElementById('lig-wa-import-step-review');
    const reviewList = () => document.getElementById('lig-wa-import-review-list');
    const summaryEl = () => document.getElementById('lig-wa-import-summary');
    const summaryCountEl = () => document.getElementById('lig-wa-import-summary-count');
    const summaryUnitsEl = () => document.getElementById('lig-wa-import-summary-units');
    const errorEl = () => document.getElementById('lig-wa-import-error');
    const mergeHintEl = () => document.getElementById('lig-wa-import-merge-hint');
    const confirmBtn = () => document.getElementById('lig-wa-import-confirm');
    const replaceBtn = () => document.getElementById('lig-wa-import-replace');
    const mergeBtn = () => document.getElementById('lig-wa-import-merge');
    const selectAllBtn = () => document.getElementById('lig-wa-import-select-all');
    const selectNoneBtn = () => document.getElementById('lig-wa-import-select-none');

    const isSelectableRow = (row) => row.status !== 'error' && row.status !== 'unmatched';

    const normalizeText = (value) =>
        String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{M}/gu, '')
            .replace(/\s+/g, ' ')
            .trim();

    const parsePackToken = (token) => {
        const t = normalizeText(token).replace(/\./g, '');
        if (/^(cx|caixas?|cxa|fd|fardos?|pc)$/.test(t)) return 'caixa';
        if (/^(pl|pallets?)$/.test(t)) return 'pallet';
        if (/^(un|unidades?|uni)$/.test(t)) return 'unidade';
        return null;
    };

    const stripLinePrefix = (line) =>
        String(line || '')
            .replace(/^[\s\-–—•*]+/, '')
            .replace(/^\d+[\.\)\-]\s*/, '')
            .trim();

    const inferPackFromText = (text) => {
        const t = normalizeText(text);
        if (/\b(pallets?|pl)\b/.test(t)) return 'pallet';
        if (/\b(unidades?|uni)\b/.test(t) && !/\b(caixas?|cx|fardos?)\b/.test(t)) return 'unidade';
        if (/\b(caixas?|cx|cxa|fardos?|fd|pc)\b/.test(t)) return 'caixa';
        return null;
    };

    const packTypeLabel = (packType) => {
        const labels = window.LigeirinhoPricing?.TIER_LABELS || {
            unidade: 'Unidade',
            caixa: 'Caixa',
            pallet: 'Pallet',
        };
        return labels[packType] || packType;
    };

    const cleanProductQuery = (raw) => {
        let text = String(raw || '')
            .replace(/\(\s*$/g, '')
            .replace(/\bs\/\b/gi, ' sem ')
            .replace(/\bc\/\b/gi, ' com ')
            .replace(/\bde\b/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        text = normalizeText(text);
        text = text
            .split(/\s+/)
            .map((word) => TYPO_FIX[word] || word)
            .join(' ');
        return text.trim();
    };

    const queryVariants = (query) => {
        const variants = new Set();
        const cleaned = cleanProductQuery(query);
        if (cleaned) variants.add(cleaned);
        if (query) variants.add(normalizeText(query));

        cleaned.split(/\s+/).forEach((word) => {
            const search = window.LigeirinhoSearch;
            (search?.expandWordVariants?.(word) || [word]).forEach((variant) => {
                variants.add(cleaned.replace(word, variant));
            });
        });

        return [...variants].filter(Boolean);
    };

    const parseLine = (raw) => {
        const original = String(raw || '').trim();
        const line = stripLinePrefix(original);
        if (!line) return null;

        let match = line.match(
            /^(\d+)\s*(?:x\s*)?(?:(cx|caixas?|cxa|fd|fardos?|pl|pallets?|un|unidades?|uni)\.?\s*)?(?:de\s+)?(.+)$/i,
        );
        if (!match) {
            match = line.match(/^(\d+)\s+(fardos?|caixas?|cx|unidades?|un|uni|pl)\s+(?:de\s+)?(.+)$/i);
        }
        if (!match) {
            match = line.match(/^(.+?)\s+(\d+)\s*(unidades?|un|uni|caixas?|cx|fardos?|fd|pl|pallets?)\.?$/i);
            if (match) {
                const qty = Math.min(99, Math.max(1, parseInt(match[2], 10) || 1));
                const packType = parsePackToken(match[3]) || inferPackFromText(line) || 'caixa';
                const query = cleanProductQuery(match[1]);
                if (!query) return { raw: original, error: 'Informe o nome do produto.' };
                return {
                    raw: original,
                    qty,
                    packType,
                    packExplicit: Boolean(parsePackToken(match[3])),
                    query,
                    error: '',
                };
            }
        }
        if (!match) return { raw: original, error: 'Formato não reconhecido. Use ex.: 10 cx Heineken' };

        const qty = Math.min(99, Math.max(1, parseInt(match[1], 10) || 1));
        const explicitPack = parsePackToken(match[2]);
        const packType = explicitPack || inferPackFromText(line) || 'caixa';
        const query = cleanProductQuery(match[3]);
        if (!query) return { raw: original, error: 'Informe o nome do produto.' };

        return {
            raw: original,
            qty,
            packType,
            packExplicit: Boolean(explicitPack),
            query,
            error: '',
        };
    };

    const parseText = (text) => {
        const lines = String(text || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
        return lines.map(parseLine).filter(Boolean);
    };

    const itemHaystack = (item) =>
        `${item.product.id} ${item.product.name} ${item.product.description || ''} ${item.categoryName}`;

    const attachSearchIndex = (items) => {
        const search = window.LigeirinhoSearch;
        if (!search?.buildHaystack) return items;
        items.forEach((item) => {
            item._searchHaystack = search.buildHaystack(itemHaystack(item));
        });
        return items;
    };

    const loadCatalogItems = async () => {
        if (catalogReady) return catalogReady;
        catalogReady = (async () => {
            const loader = window.LigeirinhoCatalogLoader;
            const pricing = window.LigeirinhoPricing;
            if (!loader?.load || !pricing?.buildGroups) {
                throw new Error('Catálogo indisponível. Recarregue a página.');
            }
            const catalog = await loader.load();
            const groups = pricing.buildGroups(catalog);
            return attachSearchIndex(pricing.getDisplayProducts(catalog, groups));
        })();
        return catalogReady;
    };

    const matchKey = (displayItem, tier) => `${displayItem.product.id}::${tier}`;

    const buildLineFromDisplayItem = (displayItem, packType, qty) => {
        const pricing = window.LigeirinhoPricing;
        const catalog = window.LigeirinhoCatalog;
        if (!pricing || !catalog || !displayItem?.group) return null;

        const tier = pricing.resolveActiveTier(displayItem.group, packType);
        const variant = pricing.getVariant(displayItem.group, tier);
        if (!variant) return null;

        const cartKey = catalog.cartKeyFor(variant);
        const fields = catalog.buildCartLineFields(
            { variant, group: displayItem.group, cartKey, tier },
            pricing,
        );
        if (!fields) return null;

        const price =
            window.LigeirinhoCartPrice?.resolveAddToCartPrice?.(fields) ?? Number(fields.price);
        return {
            ...fields,
            price,
            qty: Math.min(99, Math.max(1, Number(qty) || 1)),
        };
    };

    const boostMatchScore = (query, item, baseScore) => {
        let score = baseScore;
        const productText = normalizeText(
            `${item.product.name} ${item.product.description || ''} ${item.categoryName || ''}`,
        );
        const queryWords = cleanProductQuery(query).split(/\s+/).filter((w) => w.length >= 2);

        queryWords.forEach((word) => {
            if (productText.includes(word)) {
                score += DESCRIPTOR_WORDS.has(word) ? 16 : 10;
            } else if (DESCRIPTOR_WORDS.has(word)) {
                score -= 10;
            }
        });

        if (queryWords.length > 1) {
            const phrase = queryWords.join(' ');
            if (productText.includes(phrase)) score += 22;
        }

        return score;
    };

    const findMatches = (query, packType) => {
        const search = window.LigeirinhoSearch;
        const variants = queryVariants(query);
        const bestByItem = new Map();

        variants.forEach((variant) => {
            const queryInfo = search?.expandSearchQuery
                ? search.expandSearchQuery(variant)
                : { raw: variant, words: variant.split(/\s+/), volumes: [] };

            displayItems.forEach((item) => {
                const haystack = item._searchHaystack || search?.buildHaystack?.(itemHaystack(item));
                let score = haystack && search?.scoreHaystack
                    ? search.scoreHaystack(haystack, queryInfo)
                    : search?.scoreSearch?.(itemHaystack(item), queryInfo) || 0;
                if (score < MIN_MATCH_SCORE) return;

                score = boostMatchScore(query, item, score);

                const pricing = window.LigeirinhoPricing;
                const tiers = pricing?.getAvailableTiers?.(item.group) || [];
                if (packType && tiers.includes(packType)) score += 8;
                else if (packType && tiers.length) score -= 4;

                const key = item.product.id;
                const prev = bestByItem.get(key);
                if (!prev || score > prev.score) {
                    bestByItem.set(key, { item, score });
                }
            });
        });

        return [...bestByItem.values()].sort((a, b) => b.score - a.score).slice(0, 6);
    };

    const resolveRowStatus = (matches) => {
        if (!matches.length) return 'unmatched';
        const best = matches[0];
        const second = matches[1];
        if (best.score >= 72) return 'matched';
        if (best.score >= AMBIGUOUS_SCORE && (!second || best.score >= second.score * 1.3)) return 'matched';
        if (best.score < MIN_MATCH_SCORE) return 'unmatched';
        return 'review';
    };

    const resolvedTierForItem = (displayItem, packType) => {
        const pricing = window.LigeirinhoPricing;
        if (!pricing?.resolveActiveTier || !displayItem?.group) return packType || 'caixa';
        return pricing.resolveActiveTier(displayItem.group, packType);
    };

    const availableTiersForItem = (displayItem) => {
        const pricing = window.LigeirinhoPricing;
        return pricing?.getAvailableTiers?.(displayItem?.group) || ['caixa', 'unidade'];
    };

    const previewMeta = (displayItem, packType, qty) => {
        const pricing = window.LigeirinhoPricing;
        if (!pricing || !displayItem?.group) return null;

        const tier = resolvedTierForItem(displayItem, packType);
        const variant = pricing.getVariant(displayItem.group, tier);
        const line = buildLineFromDisplayItem(displayItem, packType, qty);
        if (!variant || !line) return null;

        const meta = pricing.pricePackMeta?.(variant) || {};
        const cartName = pricing.cartItemName?.(variant, displayItem.group) || line.name;
        const packPriceLabel =
            tier === 'pallet' ? 'por pallet' : tier === 'caixa' ? 'por caixa' : 'por unidade';

        return { line, variant, meta, cartName, tier, packPriceLabel };
    };

    const matchContextNote = (row, matchEntry) => {
        const parts = [];
        const match = matchEntry || selectedMatchForRow(row);
        if (!match) return '';

        if (row.matches.length > 1) {
            parts.push(`${row.matches.length} opções parecidas no catálogo`);
        }
        if (match.score < AMBIGUOUS_SCORE) {
            parts.push('correspondência parcial');
        }

        const tier = resolvedTierForItem(match.item, row.packType);
        if (tier !== row.packType) {
            parts.push(`usando ${packTypeLabel(tier).toLowerCase()} (única embalagem disponível)`);
        } else if (!row.packExplicit) {
            parts.push(`embalagem inferida: ${packTypeLabel(row.packType).toLowerCase()}`);
        }

        const meta = previewMeta(match.item, row.packType, row.qty);
        if (meta?.meta?.detail && meta.meta.detail !== 'Venda por unidade') {
            parts.push(meta.meta.detail);
        }

        return parts.join(' · ');
    };

    const parsedContextLabel = (row) => {
        const qty = Number(row.qty) || 1;
        const pack = packTypeLabel(row.packType).toLowerCase();
        const packWord = qty === 1 ? pack : `${pack}s`;
        const query = row.query || cleanProductQuery(row.raw);
        return `${qty} ${packWord} · «${query}»`;
    };

    const analyzeRows = (parsedRows) =>
        parsedRows.map((parsed, index) => {
            if (parsed.error) {
                return {
                    id: `row-${index}`,
                    raw: parsed.raw,
                    qty: parsed.qty || 1,
                    packType: parsed.packType || 'caixa',
                    packExplicit: Boolean(parsed.packExplicit),
                    query: parsed.query || '',
                    error: parsed.error,
                    status: 'error',
                    included: false,
                    matches: [],
                    selectedKey: '',
                };
            }

            const matches = findMatches(parsed.query, parsed.packType);
            const best = matches[0];
            const status = resolveRowStatus(matches);

            return {
                id: `row-${index}`,
                raw: parsed.raw,
                qty: parsed.qty,
                packType: parsed.packType,
                packExplicit: Boolean(parsed.packExplicit),
                query: parsed.query,
                error: '',
                status,
                included: Boolean(best),
                matches,
                selectedKey: best ? matchKey(best.item, parsed.packType) : '',
            };
        });

    const selectedMatchForRow = (row) => {
        if (!row?.matches?.length) return null;
        const found = row.matches.find((entry) => matchKey(entry.item, row.packType) === row.selectedKey);
        return found || row.matches[0];
    };

    const showError = (message) => {
        const el = errorEl();
        if (!el) return;
        const text = String(message || '').trim();
        el.hidden = !text;
        el.textContent = text;
    };

    const cartHasItems = () => {
        const cartApi = deps.cartApi || window.LigeirinhoCart;
        return Boolean(cartApi?.cartItemCount?.(cartApi.loadCart?.() || {}));
    };

    const setStep = (next) => {
        step = next;
        pasteStep()?.toggleAttribute('hidden', step !== 'paste');
        reviewStep()?.toggleAttribute('hidden', step !== 'review');
    };

    const closeModal = () => {
        const el = modal();
        if (!el) return;
        el.classList.remove('lig-wa-import--open');
        el.setAttribute('aria-hidden', 'true');
        rows = [];
        step = 'paste';
        setStep('paste');
        showError('');
        if (textarea()) textarea().value = '';
    };

    const openModal = (initialText = '') => {
        if (!isEnabled()) return;
        ensureModal();
        const el = modal();
        if (!el) return;
        rows = [];
        step = 'paste';
        setStep('paste');
        showError('');
        if (textarea()) textarea().value = String(initialText || '');
        el.classList.add('lig-wa-import--open');
        el.setAttribute('aria-hidden', 'false');
        window.setTimeout(() => textarea()?.focus(), 40);
    };

    const packLabel = (packType) => {
        if (packType === 'pallet') return 'PL';
        if (packType === 'unidade') return 'UN';
        return 'CX';
    };

    const rowStatusMeta = (row) => {
        if (row.status === 'error') {
            return { label: 'Erro', icon: 'error', className: 'lig-wa-import-row__badge--bad' };
        }
        if (row.status === 'unmatched') {
            return { label: 'Não encontrado', icon: 'search_off', className: 'lig-wa-import-row__badge--bad' };
        }
        if (row.status === 'review') {
            return { label: 'Confira', icon: 'fact_check', className: 'lig-wa-import-row__badge--review' };
        }
        return { label: 'Reconhecido', icon: 'check_circle', className: 'lig-wa-import-row__badge--ok' };
    };

    const reviewStats = () => {
        const selectable = rows.filter(isSelectableRow);
        const selected = selectable.filter((row) => row.included);
        const units = selected.reduce((sum, row) => sum + (Number(row.qty) || 0), 0);
        const skipped = rows.length - selectable.length;
        return { selectable, selected, units, skipped, total: rows.length };
    };

    const addLabel = (count) => {
        const n = Number(count) || 0;
        return `${n} ${n === 1 ? 'item' : 'itens'}`;
    };

    const formatPriceBlock = (metaBundle, qty) => {
        if (!metaBundle?.line) return '';
        const { line, meta, packPriceLabel, cartName, tier } = metaBundle;
        const total = line.price * qty;
        const unitInside =
            tier === 'caixa' && meta.unitPrice
                ? `<span class="lig-wa-import-row__price-detail">${esc(formatPrice(meta.unitPrice))}/un dentro da caixa</span>`
                : tier === 'pallet' && meta.unitPrice
                  ? `<span class="lig-wa-import-row__price-detail">${esc(formatPrice(meta.unitPrice))}/un no pallet</span>`
                  : '';

        return `<div class="lig-wa-import-row__price-box">
<p class="lig-wa-import-row__cart-preview"><span class="material-symbols-outlined" aria-hidden="true">shopping_cart</span> ${esc(qty)}× ${esc(cartName)}</p>
<p class="lig-wa-import-row__price">${esc(formatPrice(line.price))} <span class="lig-wa-import-row__price-tier">${esc(packPriceLabel)}</span>${qty > 1 ? ` · Total ${esc(formatPrice(total))}` : ''}</p>
${unitInside}
</div>`;
    };

    const renderPackSelect = (row, displayItem) => {
        const tiers = availableTiersForItem(displayItem);
        const short = window.LigeirinhoPricing?.TIER_SHORT || { unidade: 'UN', caixa: 'CX', pallet: 'PL' };
        if (tiers.length <= 1) {
            return `<span class="lig-wa-import-row__pack lig-wa-import-row__pack--static">${esc(packLabel(row.packType))}</span>`;
        }
        return `<select class="lig-wa-import-row__pack-select" data-wa-row-pack="${esc(row.id)}" aria-label="Embalagem">
${tiers
    .map((tier) => {
        const label = packTypeLabel(tier);
        const code = short[tier] || tier.slice(0, 2).toUpperCase();
        return `<option value="${esc(tier)}"${tier === row.packType ? ' selected' : ''}>${esc(code)} · ${esc(label)}</option>`;
    })
    .join('')}
</select>`;
    };

    const renderMatchOptions = (row) => {
        if (!row.matches.length) {
            return `<div class="lig-wa-import-row__match-box lig-wa-import-row__match-box--empty">
<p class="lig-wa-import-row__product lig-wa-import-row__product--missing">Nenhuma sugestão</p>
<p class="lig-wa-import-row__hint">Tente corrigir o nome (ex.: h2o em vez de h20, buchanans em vez de buchanas).</p>
</div>`;
        }

        if (row.matches.length > 1) {
            return `<div class="lig-wa-import-row__match-box">
<label class="lig-wa-import-row__match-label">Produto sugerido (${row.matches.length} opções)</label>
<select class="lig-wa-import-row__select" data-wa-row-select="${esc(row.id)}">
${row.matches
    .map((entry) => {
        const key = matchKey(entry.item, row.packType);
        const metaBundle = previewMeta(entry.item, row.packType, 1);
        const label = metaBundle?.cartName || entry.item.product.name;
        const priceHint = metaBundle ? ` — ${formatPrice(metaBundle.line.price)}` : '';
        const scoreHint = entry.score >= 72 ? '' : ' · confira';
        return `<option value="${esc(key)}"${key === row.selectedKey ? ' selected' : ''}>${esc(label)}${esc(priceHint)}${esc(scoreHint)}</option>`;
    })
    .join('')}
</select>
</div>`;
        }

        const match = row.matches[0];
        const metaBundle = previewMeta(match.item, row.packType, row.qty);
        const label = metaBundle?.cartName || match.item.product.name;
        return `<div class="lig-wa-import-row__match-box">
<p class="lig-wa-import-row__match-label">Produto sugerido</p>
<p class="lig-wa-import-row__product">${esc(label)}</p>
${match.item.categoryName ? `<p class="lig-wa-import-row__category">${esc(match.item.categoryName)}</p>` : ''}
</div>`;
    };

    const renderReview = () => {
        const list = reviewList();
        if (!list) return;

        const { selectable, selected, units, skipped, total } = reviewStats();
        const selectedCount = selected.length;
        const selectableCount = selectable.length;

        list.innerHTML = rows
            .map((row) => {
                const match = selectedMatchForRow(row);
                const metaBundle = match ? previewMeta(match.item, row.packType, row.qty) : null;
                const statusClass =
                    row.status === 'matched'
                        ? 'lig-wa-import-row--ok'
                        : row.status === 'review'
                          ? 'lig-wa-import-row--review'
                          : 'lig-wa-import-row--bad';
                const status = rowStatusMeta(row);

                const options = renderMatchOptions(row);

                const contextNote = matchContextNote(row, match);
                const note =
                    row.error ||
                    (row.status === 'unmatched' ? 'Produto não encontrado no catálogo.' : '') ||
                    contextNote ||
                    (row.status === 'review' ? 'Confira a sugestão antes de importar.' : '');

                const priceHtml = metaBundle ? formatPriceBlock(metaBundle, row.qty) : '';

                const offClass = row.included ? '' : ' lig-wa-import-row--off';
                const parsedContext = row.query ? parsedContextLabel(row) : '';

                return `<article class="lig-wa-import-row ${statusClass}${offClass}" data-wa-row="${esc(row.id)}">
<div class="lig-wa-import-row__top">
<label class="lig-wa-import-row__check">
<input type="checkbox" data-wa-row-include="${esc(row.id)}"${row.included ? ' checked' : ''}${row.status === 'error' || row.status === 'unmatched' ? ' disabled' : ''}>
<span class="lig-wa-import-row__raw">${esc(row.raw)}</span>
</label>
<span class="lig-wa-import-row__badge ${status.className}">
<span class="material-symbols-outlined" aria-hidden="true">${status.icon}</span>
${esc(status.label)}
</span>
</div>
${parsedContext ? `<p class="lig-wa-import-row__parsed"><span class="lig-wa-import-row__parsed-label">Entendi:</span> ${esc(parsedContext)}</p>` : ''}
<div class="lig-wa-import-row__body">
<div class="lig-wa-import-row__meta">
<label class="lig-wa-import-row__qty-wrap">Qtd
<input type="number" min="1" max="99" class="lig-wa-import-row__qty" data-wa-row-qty="${esc(row.id)}" value="${esc(row.qty)}">
${match ? renderPackSelect(row, match.item) : `<span class="lig-wa-import-row__pack">${esc(packLabel(row.packType))}</span>`}
</label>
</div>
${options}
${priceHtml}
${note ? `<p class="lig-wa-import-row__note">${esc(note)}</p>` : ''}
</div>
</article>`;
            })
            .join('');

        if (summaryCountEl()) {
            summaryCountEl().textContent =
                selectableCount === total
                    ? `${selectedCount} de ${selectableCount} selecionados`
                    : `${selectedCount} de ${selectableCount} selecionados · ${skipped} ignorados`;
        }
        if (summaryUnitsEl()) {
            summaryUnitsEl().textContent = `${units} ${units === 1 ? 'embalagem' : 'embalagens'}`;
        }
        if (summaryEl()) {
            summaryEl().textContent =
                selectedCount === 0
                    ? 'Nenhum item selecionado — marque os que deseja importar.'
                    : 'Confira as sugestões antes de adicionar ao caminhão.';
        }

        if (selectAllBtn()) {
            selectAllBtn().disabled = !selectableCount || selectedCount === selectableCount;
        }
        if (selectNoneBtn()) {
            selectNoneBtn().disabled = !selectedCount;
        }

        const hasCart = cartHasItems();
        const actionLabel = selectedCount ? `Adicionar ${addLabel(selectedCount)} ao caminhão` : 'Adicionar ao caminhão';
        if (mergeHintEl()) {
            mergeHintEl().hidden = !hasCart;
            mergeHintEl().textContent = hasCart
                ? 'Seu caminhão já tem itens. Escolha como aplicar a importação.'
                : '';
        }
        if (confirmBtn()) {
            confirmBtn().hidden = hasCart || !selectedCount;
            confirmBtn().textContent = actionLabel;
            confirmBtn().disabled = !selectedCount;
        }
        if (replaceBtn()) {
            replaceBtn().hidden = !hasCart || !selectedCount;
            replaceBtn().textContent = selectedCount ? `Substituir caminhão (${addLabel(selectedCount)})` : 'Substituir caminhão';
            replaceBtn().disabled = !selectedCount;
        }
        if (mergeBtn()) {
            mergeBtn().hidden = !hasCart || !selectedCount;
            mergeBtn().textContent = selectedCount ? `Somar ao caminhão (${addLabel(selectedCount)})` : 'Somar ao caminhão';
            mergeBtn().disabled = !selectedCount;
        }
    };

    const collectLines = () => {
        const lines = [];
        rows.forEach((row) => {
            if (!row.included || row.status === 'error' || row.status === 'unmatched') return;
            const match = selectedMatchForRow(row);
            if (!match) return;
            const line = buildLineFromDisplayItem(match.item, row.packType, row.qty);
            if (line) lines.push(line);
        });
        return lines;
    };

    const applyLines = (mode) => {
        const cartApi = deps.cartApi || window.LigeirinhoCart;
        const lines = collectLines();
        if (!lines.length || !cartApi?.saveCart) {
            showError('Selecione ao menos um item reconhecido.');
            return false;
        }

        if (mode === 'merge' && cartHasItems()) {
            const ok = window.confirm(
                'Somar estes itens ao caminhão atual?\n\nProdutos que já estão no caminhão permanecerão — confira se não há itens de outro cliente antes de confirmar o pedido.',
            );
            if (!ok) return false;
        }

        const next = mode === 'merge' ? { ...cartApi.loadCart() } : {};
        lines.forEach((line) => {
            const key = line.cartKey || line.key;
            if (!key) return;
            if (next[key]) {
                next[key].qty = Math.min(99, (Number(next[key].qty) || 0) + line.qty);
                next[key].price = line.price;
            } else {
                next[key] = { ...line, key };
            }
        });

        cartApi.saveCart(next);
        window.dispatchEvent(new CustomEvent('ligeirinho-cart-changed'));
        deps.onApplied?.();
        closeModal();
        deps.openCart?.();
        window.LigeirinhoCartUI?.showAddedFeedback?.(
            `${lines.length} ${lines.length === 1 ? 'item importado' : 'itens importados'}`,
        );
        return true;
    };

    const analyze = async () => {
        showError('');
        const text = textarea()?.value || '';
        const parsed = parseText(text);
        if (!parsed.length) {
            showError('Cole ao menos uma linha do pedido.');
            return;
        }

        try {
            displayItems = await loadCatalogItems();
            rows = analyzeRows(parsed);
            if (!rows.some((row) => row.matches.length)) {
                showError('Nenhum produto reconhecido. Confira os nomes ou atualize o catálogo.');
                return;
            }
            setStep('review');
            renderReview();
        } catch (err) {
            showError(err.message || 'Não foi possível analisar o pedido.');
        }
    };

    const bindReviewEvents = () => {
        const list = reviewList();
        if (!list || list.dataset.bound) return;
        list.dataset.bound = '1';

        list.addEventListener('change', (event) => {
            const include = event.target.closest('[data-wa-row-include]');
            if (include) {
                const row = rows.find((entry) => entry.id === include.dataset.waRowInclude);
                if (row && !include.disabled) row.included = include.checked;
                renderReview();
                return;
            }
            const select = event.target.closest('[data-wa-row-select]');
            if (select) {
                const row = rows.find((entry) => entry.id === select.dataset.waRowSelect);
                if (row) {
                    row.selectedKey = select.value;
                    row.included = true;
                    renderReview();
                }
                return;
            }
            const pack = event.target.closest('[data-wa-row-pack]');
            if (pack) {
                const row = rows.find((entry) => entry.id === pack.dataset.waRowPack);
                if (row) {
                    row.packType = pack.value;
                    row.packExplicit = true;
                    const productId = row.selectedKey?.split('::')[0];
                    const match =
                        row.matches.find((entry) => entry.item.product.id === productId) || row.matches[0];
                    if (match) row.selectedKey = matchKey(match.item, row.packType);
                    renderReview();
                }
                return;
            }
            const qty = event.target.closest('[data-wa-row-qty]');
            if (qty) {
                const row = rows.find((entry) => entry.id === qty.dataset.waRowQty);
                if (row) {
                    row.qty = Math.min(99, Math.max(1, Number(qty.value) || 1));
                    renderReview();
                }
            }
        });
    };

    const ensureModal = () => {
        if (document.getElementById('lig-wa-import-modal')) return;

        const wrap = document.createElement('div');
        wrap.innerHTML = `<div id="lig-wa-import-modal" class="lig-wa-import" aria-hidden="true">
<div class="lig-wa-import__backdrop" data-wa-import-close aria-hidden="true"></div>
<div class="lig-wa-import__sheet" role="dialog" aria-modal="true" aria-labelledby="lig-wa-import-title">
<div class="lig-wa-import__head">
<h2 id="lig-wa-import-title" class="lig-wa-import__title">Importar pedido do WhatsApp</h2>
<button type="button" class="lig-wa-import__close" data-wa-import-close aria-label="Fechar">
<span class="material-symbols-outlined" aria-hidden="true">close</span>
</button>
</div>
<div id="lig-wa-import-step-paste" class="lig-wa-import__body">
<p class="lig-wa-import__lead">Cole a mensagem do cliente. O sistema sugere produtos do catálogo — confira tudo antes de colocar no caminhão.</p>
<textarea id="lig-wa-import-text" class="lig-wa-import__textarea" rows="10" placeholder="Ex.:&#10;16 unidades Beefeater tradicional&#10;1 caixa de Buchanas&#10;60 cx Heineken&#10;15 fardos água s/ gás"></textarea>
<p class="lig-wa-import__hint">Formato: quantidade + embalagem (cx, un, fardo, pl) + nome — ou nome + quantidade no final. Uma linha por item.</p>
<p id="lig-wa-import-error" class="lig-wa-import__error" hidden></p>
<div class="lig-wa-import__actions">
<button type="button" class="lig-wa-import__btn lig-wa-import__btn--primary" id="lig-wa-import-analyze">Analisar mensagem</button>
<button type="button" class="lig-wa-import__btn" data-wa-import-close>Cancelar</button>
</div>
</div>
<div id="lig-wa-import-step-review" class="lig-wa-import__body" hidden>
<div class="lig-wa-import__summary-bar">
<div class="lig-wa-import__summary-stats">
<p class="lig-wa-import__summary-count"><span id="lig-wa-import-summary-count">0 de 0 selecionados</span> · <span id="lig-wa-import-summary-units">0 embalagens</span></p>
<p id="lig-wa-import-summary" class="lig-wa-import__summary">Confira as sugestões antes de adicionar ao caminhão.</p>
</div>
<div class="lig-wa-import__summary-actions">
<button type="button" class="lig-wa-import__summary-btn" id="lig-wa-import-select-all">Marcar todos</button>
<button type="button" class="lig-wa-import__summary-btn" id="lig-wa-import-select-none">Desmarcar</button>
</div>
</div>
<div id="lig-wa-import-review-list" class="lig-wa-import__list"></div>
<p id="lig-wa-import-merge-hint" class="lig-wa-import__merge" hidden></p>
<div class="lig-wa-import__actions lig-wa-import__actions--review">
<button type="button" class="lig-wa-import__btn lig-wa-import__btn--primary" id="lig-wa-import-confirm">Adicionar ao caminhão</button>
<button type="button" class="lig-wa-import__btn lig-wa-import__btn--primary" id="lig-wa-import-replace" hidden>Substituir caminhão</button>
<button type="button" class="lig-wa-import__btn" id="lig-wa-import-merge" hidden>Somar ao caminhão</button>
<button type="button" class="lig-wa-import__btn" data-wa-import-back>Voltar</button>
</div>
</div>
</div>
</div>`;
        document.body.appendChild(wrap.firstElementChild);

        document.getElementById('lig-wa-import-analyze')?.addEventListener('click', () => {
            void analyze();
        });
        document.getElementById('lig-wa-import-confirm')?.addEventListener('click', () => applyLines('replace'));
        document.getElementById('lig-wa-import-replace')?.addEventListener('click', () => applyLines('replace'));
        document.getElementById('lig-wa-import-merge')?.addEventListener('click', () => applyLines('merge'));
        document.getElementById('lig-wa-import-select-all')?.addEventListener('click', () => {
            rows.forEach((row) => {
                if (isSelectableRow(row)) row.included = true;
            });
            renderReview();
        });
        document.getElementById('lig-wa-import-select-none')?.addEventListener('click', () => {
            rows.forEach((row) => {
                if (isSelectableRow(row)) row.included = false;
            });
            renderReview();
        });
        document.querySelectorAll('[data-wa-import-close]').forEach((btn) => {
            btn.addEventListener('click', closeModal);
        });
        document.querySelector('[data-wa-import-back]')?.addEventListener('click', () => {
            setStep('paste');
            showError('');
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modal()?.classList.contains('lig-wa-import--open')) {
                closeModal();
            }
        });
        bindReviewEvents();
    };

    const init = (nextDeps = {}) => {
        deps = nextDeps;
        if (!isEnabled()) return;
        ensureModal();
    };

    window.LigeirinhoWhatsappOrderImport = {
        init,
        open: openModal,
        isEnabled,
        parseText,
    };
})();
