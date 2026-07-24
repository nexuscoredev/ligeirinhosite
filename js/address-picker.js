(function () {
    /** Fluxo de endereço estilo app de delivery: busca → mapa → confirmar. */
    const DEFAULT_CENTER = { lat: -23.6515, lng: -46.7612 }; // Campo Limpo / região Ligeirinho
    const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

    const esc = (value) =>
        String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const stateCodeFrom = (parts) => {
        if (parts.stateCode) return String(parts.stateCode).slice(0, 2).toUpperCase();
        const map = {
            'são paulo': 'SP',
            'sao paulo': 'SP',
            'rio de janeiro': 'RJ',
            'minas gerais': 'MG',
            paraná: 'PR',
            parana: 'PR',
        };
        return map[String(parts.state || '').toLowerCase()] || '';
    };

    const formatAddressLine = (parts) => {
        const street = [parts.street, parts.noNumber ? 'S/N' : parts.number].filter(Boolean).join(', ');
        const tail = [parts.complement, parts.neighborhood, parts.city, parts.stateCode || parts.state]
            .filter(Boolean)
            .join(' · ');
        return [street, tail].filter(Boolean).join(' — ');
    };

    let root = null;
    let view = 'search';
    let map = null;
    let mapReady = false;
    let searchTimer = null;
    let reverseTimer = null;
    let draft = emptyDraft();
    let onConfirmCb = null;
    let onDismissCb = null;
    let leafletLoading = null;

    function emptyDraft() {
        return {
            street: '',
            number: '',
            complement: '',
            noNumber: false,
            noComplement: false,
            neighborhood: '',
            city: '',
            state: '',
            stateCode: '',
            reference: '',
            lat: DEFAULT_CENTER.lat,
            lng: DEFAULT_CENTER.lng,
            label: '',
        };
    }

    const loadLeaflet = () => {
        if (window.L?.map) return Promise.resolve();
        if (leafletLoading) return leafletLoading;
        leafletLoading = new Promise((resolve, reject) => {
            if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = LEAFLET_CSS;
                document.head.appendChild(link);
            }
            const script = document.createElement('script');
            script.src = LEAFLET_JS;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Leaflet'));
            document.head.appendChild(script);
        });
        return leafletLoading;
    };

    const buildRoot = () => {
        const el = document.createElement('div');
        el.id = 'lig-address-picker';
        el.className = 'lig-addr';
        el.setAttribute('hidden', '');
        el.innerHTML = `
<div class="lig-addr__screen" data-addr-view="search">
<header class="lig-addr__top">
<button type="button" class="lig-addr__icon-btn" data-addr-close aria-label="Voltar">
<span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
</button>
<h1 class="lig-addr__title">Onde entregamos?</h1>
<span class="lig-addr__top-spacer" aria-hidden="true"></span>
</header>
<div class="lig-addr__search-wrap">
<label class="lig-addr__field">
<input type="search" id="lig-addr-q" class="lig-addr__input" placeholder="Digite o endereço completo" autocomplete="street-address" enterkeyhint="search">
<span class="material-symbols-outlined lig-addr__field-icon" aria-hidden="true">location_on</span>
</label>
<button type="button" class="lig-addr__geo-row" data-addr-geo>
<span class="material-symbols-outlined" aria-hidden="true">my_location</span>
<span>Usar minha localização</span>
<span class="material-symbols-outlined lig-addr__chevron" aria-hidden="true">chevron_right</span>
</button>
</div>
<div class="lig-addr__divider" aria-hidden="true"></div>
<div id="lig-addr-results" class="lig-addr__results" role="listbox" aria-label="Sugestões de endereço"></div>
<p id="lig-addr-search-status" class="lig-addr__hint" hidden></p>
</div>

<div class="lig-addr__screen lig-addr__screen--map" data-addr-view="map" hidden>
<header class="lig-addr__top lig-addr__top--over-map">
<button type="button" class="lig-addr__icon-btn lig-addr__icon-btn--light" data-addr-back="search" aria-label="Voltar">
<span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
</button>
<h1 class="lig-addr__title">Indicar local no mapa</h1>
<span class="lig-addr__top-spacer" aria-hidden="true"></span>
</header>
<div id="lig-addr-map" class="lig-addr__map" role="application" aria-label="Mapa para indicar o local"></div>
<div class="lig-addr__pin" aria-hidden="true">
<span class="lig-addr__pin-mark"><span class="material-symbols-outlined">home</span></span>
<span class="lig-addr__pin-dot"></span>
</div>
<div class="lig-addr__map-ui">
<p class="lig-addr__tip">Arraste o mapa para posicionar a ponta do marcador no seu local.</p>
<button type="button" class="lig-addr__recenter" data-addr-geo title="Minha localização" aria-label="Centralizar na minha localização">
<span class="material-symbols-outlined" aria-hidden="true">my_location</span>
</button>
<button type="button" class="lig-addr__confirm-btn" data-addr-to-confirm>Confirmar local</button>
</div>
</div>

<div class="lig-addr__screen" data-addr-view="confirm" hidden>
<header class="lig-addr__top">
<button type="button" class="lig-addr__icon-btn" data-addr-back="map" aria-label="Voltar">
<span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
</button>
<h1 class="lig-addr__title">Conferir endereço</h1>
<button type="button" class="lig-addr__icon-btn" data-addr-close aria-label="Fechar">
<span class="material-symbols-outlined" aria-hidden="true">close</span>
</button>
</header>
<div class="lig-addr__confirm-scroll">
<p class="lig-addr__lead">Esse é o endereço do local indicado no mapa. Você pode editar o número e o complemento, se necessário.</p>
<label class="lig-addr__label" for="lig-addr-street">Rua</label>
<input id="lig-addr-street" class="lig-addr__input" type="text" autocomplete="address-line1">
<div class="lig-addr__row">
<div class="lig-addr__col lig-addr__col--num">
<label class="lig-addr__label" for="lig-addr-number">Número</label>
<input id="lig-addr-number" class="lig-addr__input" type="text" inputmode="numeric" autocomplete="address-line2">
</div>
<div class="lig-addr__col">
<label class="lig-addr__label" for="lig-addr-comp">Complemento</label>
<input id="lig-addr-comp" class="lig-addr__input" type="text" placeholder="Complemento" autocomplete="address-line2">
</div>
</div>
<div class="lig-addr__checks">
<label class="lig-addr__check"><input type="checkbox" id="lig-addr-no-num"> Sem número</label>
<label class="lig-addr__check"><input type="checkbox" id="lig-addr-no-comp"> Não tenho complemento</label>
</div>
<label class="lig-addr__label" for="lig-addr-neigh">Bairro</label>
<input id="lig-addr-neigh" class="lig-addr__input" type="text" autocomplete="address-level2">
<label class="lig-addr__label" for="lig-addr-city">Cidade</label>
<input id="lig-addr-city" class="lig-addr__input" type="text" autocomplete="address-level2">
<label class="lig-addr__label" for="lig-addr-ref">Ponto de referência (opcional)</label>
<input id="lig-addr-ref" class="lig-addr__input" type="text" placeholder="Ponto de referência (opcional)">
<p class="lig-addr__state" id="lig-addr-state-label"></p>
</div>
<div class="lig-addr__confirm-foot">
<button type="button" class="lig-addr__confirm-btn" data-addr-save>Continuar</button>
<p class="lig-addr__change">O endereço não está correto? <button type="button" data-addr-back="map">Alterar local no mapa</button></p>
</div>
</div>`;
        return el;
    };

    const setView = (name) => {
        view = name;
        root.querySelectorAll('[data-addr-view]').forEach((screen) => {
            const active = screen.dataset.addrView === name;
            screen.hidden = !active;
        });
        if (name === 'map') {
            void ensureMap().then(() => {
                map?.invalidateSize?.();
                map?.setView([draft.lat, draft.lng], Math.max(map.getZoom(), 17));
            });
        }
        if (name === 'confirm') fillConfirmForm();
    };

    const setSearchStatus = (msg) => {
        const el = root.querySelector('#lig-addr-search-status');
        if (!el) return;
        el.hidden = !msg;
        el.textContent = msg || '';
    };

    const applyPlace = (place) => {
        draft = {
            ...draft,
            street: place.street || draft.street,
            number: place.number || draft.number,
            neighborhood: place.neighborhood || draft.neighborhood,
            city: place.city || draft.city,
            state: place.state || draft.state,
            stateCode: place.stateCode || stateCodeFrom(place) || draft.stateCode,
            lat: Number.isFinite(place.lat) ? place.lat : draft.lat,
            lng: Number.isFinite(place.lng) ? place.lng : draft.lng,
            label: place.label || draft.label,
        };
    };

    const renderResults = (results) => {
        const box = root.querySelector('#lig-addr-results');
        if (!box) return;
        if (!results.length) {
            box.innerHTML = '<p class="lig-addr__empty">Nenhum endereço encontrado. Tente rua e bairro.</p>';
            return;
        }
        box.innerHTML = results
            .map(
                (r) =>
                    `<button type="button" class="lig-addr__result" role="option" data-addr-pick="${esc(r.id)}">
<span class="material-symbols-outlined" aria-hidden="true">location_on</span>
<span>${esc(r.label)}</span>
</button>`,
            )
            .join('');
        box.querySelectorAll('[data-addr-pick]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const place = results.find((r) => r.id === btn.dataset.addrPick);
                if (!place) return;
                applyPlace(place);
                setView('map');
            });
        });
    };

    const searchAddress = async (q) => {
        setSearchStatus('Buscando…');
        try {
            const res = await fetch(`/api/geo/search?q=${encodeURIComponent(q)}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Falha na busca');
            setSearchStatus('');
            renderResults(data.results || []);
        } catch (err) {
            setSearchStatus(err.message || 'Não foi possível buscar agora.');
            renderResults([]);
        }
    };

    const reverseGeocode = async (lat, lng) => {
        try {
            const res = await fetch(`/api/geo/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.result) return;
            applyPlace({ ...data.result, lat, lng });
        } catch {
            /* keep draft coords */
        }
    };

    const useGeolocation = () => {
        if (!navigator.geolocation) {
            setSearchStatus('Geolocalização indisponível neste aparelho.');
            return;
        }
        setSearchStatus('Obtendo sua localização…');
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                draft.lat = lat;
                draft.lng = lng;
                await reverseGeocode(lat, lng);
                setSearchStatus('');
                setView('map');
            },
            () => {
                setSearchStatus('Não foi possível obter a localização. Digite o endereço.');
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
        );
    };

    const ensureMap = async () => {
        await loadLeaflet();
        const host = root.querySelector('#lig-addr-map');
        if (!host || !window.L) return;
        if (map) return;
        map = window.L.map(host, {
            zoomControl: false,
            attributionControl: true,
        }).setView([draft.lat, draft.lng], 17);
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            maxZoom: 20,
        }).addTo(map);
        window.L.control.zoom({ position: 'bottomright' }).addTo(map);
        map.on('moveend', () => {
            const c = map.getCenter();
            draft.lat = c.lat;
            draft.lng = c.lng;
            if (reverseTimer) clearTimeout(reverseTimer);
            reverseTimer = window.setTimeout(() => reverseGeocode(c.lat, c.lng), 350);
        });
        mapReady = true;
    };

    const fillConfirmForm = () => {
        root.querySelector('#lig-addr-street').value = draft.street || '';
        root.querySelector('#lig-addr-number').value = draft.noNumber ? '' : draft.number || '';
        root.querySelector('#lig-addr-comp').value = draft.noComplement ? '' : draft.complement || '';
        root.querySelector('#lig-addr-neigh').value = draft.neighborhood || '';
        root.querySelector('#lig-addr-city').value = draft.city || '';
        root.querySelector('#lig-addr-ref').value = draft.reference || '';
        root.querySelector('#lig-addr-no-num').checked = draft.noNumber;
        root.querySelector('#lig-addr-no-comp').checked = draft.noComplement;
        root.querySelector('#lig-addr-number').disabled = draft.noNumber;
        root.querySelector('#lig-addr-comp').disabled = draft.noComplement;
        const code = draft.stateCode || stateCodeFrom(draft);
        root.querySelector('#lig-addr-state-label').textContent = code || draft.state || '';
        syncSaveEnabled();
    };

    const readConfirmForm = () => {
        draft.street = root.querySelector('#lig-addr-street').value.trim();
        draft.noNumber = root.querySelector('#lig-addr-no-num').checked;
        draft.noComplement = root.querySelector('#lig-addr-no-comp').checked;
        draft.number = draft.noNumber ? '' : root.querySelector('#lig-addr-number').value.trim();
        draft.complement = draft.noComplement ? '' : root.querySelector('#lig-addr-comp').value.trim();
        draft.neighborhood = root.querySelector('#lig-addr-neigh').value.trim();
        draft.city = root.querySelector('#lig-addr-city').value.trim();
        draft.reference = root.querySelector('#lig-addr-ref').value.trim();
        draft.stateCode = draft.stateCode || stateCodeFrom(draft);
    };

    const syncSaveEnabled = () => {
        readConfirmForm();
        const ok =
            Boolean(draft.street) &&
            Boolean(draft.city) &&
            (draft.noNumber || Boolean(draft.number));
        const btn = root.querySelector('[data-addr-save]');
        if (btn) btn.disabled = !ok;
    };

    const saveAndClose = () => {
        readConfirmForm();
        if (!draft.street || !draft.city || (!draft.noNumber && !draft.number)) {
            syncSaveEnabled();
            return;
        }
        const address = formatAddressLine(draft);
        const payload = {
            deliveryType: 'entrega',
            address,
            addressParts: { ...draft },
        };
        window.LigeirinhoCart?.saveCheckout?.(payload);
        onConfirmCb?.(payload);
        onDismissCb = null;
        close();
    };

    const bind = () => {
        root.querySelectorAll('[data-addr-close]').forEach((btn) => btn.addEventListener('click', close));
        root.querySelectorAll('[data-addr-back]').forEach((btn) => {
            btn.addEventListener('click', () => setView(btn.dataset.addrBack || 'search'));
        });
        root.querySelectorAll('[data-addr-geo]').forEach((btn) => btn.addEventListener('click', useGeolocation));
        root.querySelector('[data-addr-to-confirm]')?.addEventListener('click', () => setView('confirm'));
        root.querySelector('[data-addr-save]')?.addEventListener('click', saveAndClose);

        const q = root.querySelector('#lig-addr-q');
        q?.addEventListener('input', () => {
            const value = q.value.trim();
            if (searchTimer) clearTimeout(searchTimer);
            if (value.length < 3) {
                setSearchStatus('');
                root.querySelector('#lig-addr-results').innerHTML = '';
                return;
            }
            searchTimer = window.setTimeout(() => searchAddress(value), 320);
        });

        ['#lig-addr-street', '#lig-addr-number', '#lig-addr-comp', '#lig-addr-neigh', '#lig-addr-city', '#lig-addr-ref'].forEach(
            (sel) => root.querySelector(sel)?.addEventListener('input', syncSaveEnabled),
        );
        root.querySelector('#lig-addr-no-num')?.addEventListener('change', (e) => {
            draft.noNumber = e.target.checked;
            root.querySelector('#lig-addr-number').disabled = draft.noNumber;
            if (draft.noNumber) root.querySelector('#lig-addr-number').value = '';
            syncSaveEnabled();
        });
        root.querySelector('#lig-addr-no-comp')?.addEventListener('change', (e) => {
            draft.noComplement = e.target.checked;
            root.querySelector('#lig-addr-comp').disabled = draft.noComplement;
            if (draft.noComplement) root.querySelector('#lig-addr-comp').value = '';
            syncSaveEnabled();
        });
    };

    const open = (opts = {}) => {
        if (!root) {
            root = buildRoot();
            document.body.appendChild(root);
            bind();
        }
        onConfirmCb = typeof opts.onConfirm === 'function' ? opts.onConfirm : null;
        onDismissCb = typeof opts.onDismiss === 'function' ? opts.onDismiss : null;
        const checkout = window.LigeirinhoCart?.loadCheckout?.() || {};
        draft = { ...emptyDraft(), ...(checkout.addressParts || {}) };
        if (Number.isFinite(draft.lat) && Number.isFinite(draft.lng)) {
            /* keep */
        } else {
            draft.lat = DEFAULT_CENTER.lat;
            draft.lng = DEFAULT_CENTER.lng;
        }
        root.removeAttribute('hidden');
        document.documentElement.classList.add('lig-addr-open');
        document.body.style.overflow = 'hidden';
        const start = opts.view || (draft.street ? 'confirm' : 'search');
        setView(start);
        if (start === 'search') {
            window.setTimeout(() => root.querySelector('#lig-addr-q')?.focus(), 80);
        }
    };

    const close = () => {
        if (!root) return;
        const dismiss = onDismissCb;
        root.setAttribute('hidden', '');
        document.documentElement.classList.remove('lig-addr-open');
        document.body.style.overflow = '';
        onConfirmCb = null;
        onDismissCb = null;
        dismiss?.();
    };

    window.LigeirinhoAddressPicker = { open, close };
})();
