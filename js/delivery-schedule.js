(function () {
    const CACHE_KEY = 'ligeirinho-delivery-schedule-v1';
    const CACHE_MS = 5 * 60 * 1000;

    const formatDeliveryDateLabel = (isoDate, options = {}) => {
        if (!isoDate) return '';
        const [y, m, d] = String(isoDate).split('-').map(Number);
        if (!y || !m || !d) return isoDate;
        const date = new Date(y, m - 1, d, 12);
        const weekday = date.toLocaleDateString('pt-BR', { weekday: options.short ? 'short' : 'long' });
        const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
        return `${cap(weekday)}, ${d} ${cap(month)}`;
    };

    const readCache = () => {
        try {
            const raw = sessionStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data?.fetchedAt || Date.now() - data.fetchedAt > CACHE_MS) return null;
            return data.payload;
        } catch {
            return null;
        }
    };

    const writeCache = (payload) => {
        try {
            sessionStorage.setItem(
                CACHE_KEY,
                JSON.stringify({ fetchedAt: Date.now(), payload })
            );
        } catch {
            /* ignore */
        }
    };

    const fetchSchedule = async ({ force = false } = {}) => {
        if (!force) {
            const cached = readCache();
            if (cached?.dates?.length) return cached;
        }

        const res = await fetch('/api/delivery/schedule');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Falha ao carregar datas de entrega');

        writeCache(data);
        return data;
    };

    const findSlot = (schedule, isoDate) =>
        (schedule?.dates || []).find((slot) => slot.date === isoDate) || null;

    window.LigeirinhoDeliverySchedule = {
        fetchSchedule,
        formatDeliveryDateLabel,
        findSlot,
        clearCache: () => {
            try {
                sessionStorage.removeItem(CACHE_KEY);
            } catch {
                /* ignore */
            }
        },
    };
})();
