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
            window.LigeirinhoCatalogLoader.clear?.();
            const catalogData = await window.LigeirinhoCatalogLoader.load({ force: true, apiUrl });
            if (!catalogData?.categories?.length) {
                throw new Error('Catálogo vazio ou indisponível.');
            }

            await Promise.all([
                window.LigeirinhoPricing?.loadPackConfig?.() ?? Promise.resolve(),
                window.LigeirinhoPricing?.loadTierImages?.() ?? Promise.resolve(),
            ]);

            window.dispatchEvent(
                new CustomEvent(EVENT, {
                    detail: { catalogData, apiUrl, promoApiUrl },
                }),
            );

            return { ok: true, catalogData };
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
