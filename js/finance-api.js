(function () {
    const TOKEN_KEY = 'ligeirinho-finance-token-v1';

    const getToken = () => sessionStorage.getItem(TOKEN_KEY) || '';
    const setToken = (token) => {
        if (token) sessionStorage.setItem(TOKEN_KEY, token);
        else sessionStorage.removeItem(TOKEN_KEY);
    };

    const headers = () => {
        const h = { 'Content-Type': 'application/json' };
        const token = getToken();
        if (token) h.Authorization = `Bearer ${token}`;
        return h;
    };

    const request = async (url, options = {}) => {
        const res = await fetch(url, { ...options, headers: { ...headers(), ...options.headers } });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
            setToken('');
            throw new Error(data.error || 'Sessão financeira expirada. Faça login novamente.');
        }
        if (!res.ok) throw new Error(data.error || 'Erro na requisição financeira.');
        return data;
    };

    const login = async (loginId, password) => {
        const data = await request('/api/finance/auth', {
            method: 'POST',
            body: JSON.stringify({ login: loginId, password }),
        });
        setToken(data.token);
        return data.profile;
    };

    const logout = () => setToken('');

    const isLoggedIn = () => Boolean(getToken());

    const dashboard = () => request('/api/finance/dashboard');
    const orders = (params = {}) => {
        const q = new URLSearchParams({ view: 'orders', ...params });
        return request(`/api/finance/dashboard?${q}`);
    };
    const charges = () => request('/api/finance/dashboard?view=charges');
    const customers = (params = {}) => {
        const q = new URLSearchParams(params);
        return request(`/api/finance/customers?${q}`);
    };
    const customerHistory = (id) => request(`/api/finance/customers?id=${encodeURIComponent(id)}`);
    const updateCustomer = (id, patch) =>
        request(`/api/finance/customers?id=${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    const createCharge = (orderId, mode = 'both') =>
        request('/api/finance/charges/create', {
            method: 'POST',
            body: JSON.stringify({ orderId, mode }),
        });
    const settings = () => request('/api/finance/settings');
    const updateSettings = (patch) =>
        request('/api/finance/settings', { method: 'PATCH', body: JSON.stringify(patch) });
    const walletAdjust = (customerId, amount, description) =>
        request(`/api/finance/customers?id=${encodeURIComponent(customerId)}`, {
            method: 'POST',
            body: JSON.stringify({ action: 'wallet-adjust', amount, description }),
        });

    const separationQueue = () => request('/api/totem/separation/queue');
    const separationOrder = (id) => request(`/api/totem/separation/order?id=${encodeURIComponent(id)}`);
    const separationPick = (orderId, itemId, delta = 1) =>
        request(`/api/totem/separation/order?id=${encodeURIComponent(orderId)}`, {
            method: 'POST',
            body: JSON.stringify({ itemId, delta }),
        });
    const separationExport = async (orderId) => {
        const res = await fetch(`/api/totem/separation/export?id=${encodeURIComponent(orderId)}`, {
            headers: headers(),
        });
        if (res.status === 401) {
            setToken('');
            throw new Error('Sessão expirada. Faça login novamente.');
        }
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Erro ao exportar');
        }
        const blob = await res.blob();
        const code = String(orderId).slice(0, 8).toUpperCase();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `separacao-${code}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const formatMoney = (v) =>
        Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const formatDate = (d) => {
        if (!d) return '—';
        return new Date(String(d).includes('T') ? d : `${d}T12:00:00`).toLocaleDateString('pt-BR');
    };

    const statusLabel = {
        pendente: 'Pendente',
        pago: 'Pago',
        vencido: 'Vencido',
        cancelado: 'Cancelado',
        em_cobranca: 'Em cobrança',
    };

    const statusClass = {
        pendente: 'fin-badge--pending',
        pago: 'fin-badge--paid',
        vencido: 'fin-badge--overdue',
        cancelado: 'fin-badge--cancelled',
        em_cobranca: 'fin-badge--billing',
    };

    const whatsAppUrl = (phone, message) => {
        const digits = String(phone || '').replace(/\D/g, '');
        const n = digits.startsWith('55') ? digits : `55${digits}`;
        return `https://api.whatsapp.com/send/?phone=${n}&text=${encodeURIComponent(message)}`;
    };

    window.LigeirinhoFinance = {
        TOKEN_KEY,
        getToken,
        setToken,
        login,
        logout,
        isLoggedIn,
        dashboard,
        orders,
        charges,
        customers,
        customerHistory,
        updateCustomer,
        createCharge,
        settings,
        updateSettings,
        walletAdjust,
        separationQueue,
        separationOrder,
        separationPick,
        separationExport,
        formatMoney,
        formatDate,
        statusLabel,
        statusClass,
        whatsAppUrl,
    };
})();
