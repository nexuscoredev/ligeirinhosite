(function () {
    const RAIOS_KEY = 'ligeirinho-raios-v1';

    const defaultState = () => ({
        points: 0,
        earnedThisPeriod: 0,
        joinedAt: null,
        creditedOrderIds: [],
        transactions: [],
    });

    const load = () => {
        try {
            return { ...defaultState(), ...JSON.parse(localStorage.getItem(RAIOS_KEY) || '{}') };
        } catch {
            return defaultState();
        }
    };

    const save = (state) => {
        localStorage.setItem(RAIOS_KEY, JSON.stringify(state));
        window.dispatchEvent(new CustomEvent('ligeirinho-raios-changed'));
    };

    const isMember = () => {
        const prefs = window.LigeirinhoCart?.loadPrefs?.() || {};
        const state = load();
        return Boolean(prefs.clubOptIn || state.joinedAt);
    };

    const join = () => {
        const state = load();
        if (!state.joinedAt) {
            state.joinedAt = Date.now();
            window.LigeirinhoCart?.savePrefs?.({ clubOptIn: true });
        }
        save(state);
        return state;
    };

    const addTransaction = (type, amount, description, meta = {}) => {
        const state = load();
        const delta = Math.round(Number(amount));
        if (!delta) return state;
        state.points = Math.max(0, state.points + delta);
        if (delta > 0) state.earnedThisPeriod = (state.earnedThisPeriod || 0) + delta;
        state.transactions.unshift({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type,
            amount: delta,
            description,
            balanceAfter: state.points,
            createdAt: new Date().toISOString(),
            ...meta,
        });
        state.transactions = state.transactions.slice(0, 50);
        save(state);
        return state;
    };

    const creditWelcomeBonus = (bonus = 500) => {
        const state = load();
        if (state.transactions.some((t) => t.type === 'welcome')) return state;
        if (!isMember()) return state;
        return addTransaction('welcome', bonus, 'Bônus de boas-vindas Club Raios');
    };

    const creditOrder = (orderId, total, config = {}) => {
        if (!orderId || !isMember()) return load();
        const state = load();
        if (state.creditedOrderIds.includes(orderId)) return state;
        const rate = Number(config.pointsPerReal) || 10;
        const pts = Math.max(1, Math.floor(Number(total) * rate));
        state.creditedOrderIds.push(orderId);
        save(state);
        return addTransaction('pedido', pts, `Pedido #${String(orderId).slice(0, 8)}`, { orderId });
    };

    const formatPoints = (n) => Number(n || 0).toLocaleString('pt-BR');

    window.LigeirinhoRaios = {
        RAIOS_KEY,
        load,
        save,
        isMember,
        join,
        addTransaction,
        creditWelcomeBonus,
        creditOrder,
        formatPoints,
    };
})();
