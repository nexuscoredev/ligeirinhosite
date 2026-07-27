(function () {
    const EVENT = 'ligeirinho-catalog-synced';
    const START_EVENT = 'ligeirinho-catalog-sync-start';

    let busy = false;

    const sync = async (options = {}) => {
        if (busy) return { ok: false, busy: true };
        if (!window.LigeirinhoCatalogLoader?.load) {
            return { ok: false, error: 'Catálogo indisponível nesta página.' };
        }

        busy = true;
        const apiUrl = String(options.apiUrl || '/api/catalog');
        const promoApiUrl = String(options.promoApiUrl || '/api/promocoes');

        window.dispatchEvent(new CustomEvent(START_EVENT, { detail: { apiUrl, promoApiUrl } }));

        try {
            window.__ligCatalogSyncTs = Date.now();
            window.LigeirinhoCatalogLoader.clear?.();
            if (window.__ligPackConfig) window.__ligPackConfig = null;
            if (window.__ligTierImages) window.__ligTierImages = null;
            try {
                sessionStorage.removeItem('ligeirinho-pack-config-v1');
                sessionStorage.removeItem('ligeirinho-tier-images-v1');
            } catch {
                /* ignore */
            }

            const promoLoaderFactory = window.LigeirinhoPromoCatalog?.createHubPromoLoader;
            const promoLoader = promoLoaderFactory ? promoLoaderFactory(promoApiUrl) : null;
            promoLoader?.clear?.();

            const [catalogData, , , promoData] = await Promise.all([
                window.LigeirinhoCatalogLoader.load({ force: true, apiUrl }),
                window.LigeirinhoPricing?.loadPackConfig?.() ?? Promise.resolve(),
                window.LigeirinhoPricing?.loadTierImages?.() ?? Promise.resolve(),
                promoLoader ? promoLoader.load(true) : Promise.resolve(null),
            ]);

            if (!catalogData?.categories?.length) {
                throw new Error('Catálogo vazio ou indisponível.');
            }

            window.dispatchEvent(
                new CustomEvent(EVENT, {
                    detail: { catalogData, promoData, apiUrl, promoApiUrl },
                }),
            );

            return { ok: true, catalogData, promoData };
        } catch (err) {
            return { ok: false, error: err?.message || 'Falha na sincronização.' };
        } finally {
            busy = false;
        }
    };

    window.LigeirinhoCatalogSync = {
        sync,
        isBusy: () => busy,
        EVENT,
        START_EVENT,
    };
})();
