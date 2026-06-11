const headers = (serviceKey, extra = {}) => ({
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    ...extra,
});

const base = (url) => url.replace(/\/$/, '');

async function sbFetch(url, serviceKey, options = {}) {
    const res = await fetch(url, { ...options, headers: headers(serviceKey, options.headers) });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const msg = data?.message || data?.error || data?.hint || res.statusText;
        throw new Error(`Supabase: ${msg}`);
    }
    return data;
}

export async function upsertCustomer(supabaseUrl, serviceKey, row) {
    if (row.hub_user_id) {
        const url = `${base(supabaseUrl)}/rest/v1/customers?on_conflict=hub_user_id`;
        const res = await fetch(url, {
            method: 'POST',
            headers: headers(serviceKey, {
                Prefer: 'resolution=merge-duplicates,return=representation',
            }),
            body: JSON.stringify({ ...row, updated_at: new Date().toISOString() }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.message || 'Falha ao salvar cliente');
        return Array.isArray(data) ? data[0] : data;
    }
    const url = `${base(supabaseUrl)}/rest/v1/customers`;
    const res = await fetch(url, {
        method: 'POST',
        headers: headers(serviceKey, { Prefer: 'return=representation' }),
        body: JSON.stringify({ ...row, updated_at: new Date().toISOString() }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || 'Falha ao salvar cliente');
    return Array.isArray(data) ? data[0] : data;
}

export async function fetchCustomerByHubUserId(supabaseUrl, serviceKey, hubUserId) {
    if (!hubUserId) return null;
    const url = `${base(supabaseUrl)}/rest/v1/customers?hub_user_id=eq.${encodeURIComponent(hubUserId)}&select=*&limit=1`;
    const rows = await sbFetch(url, serviceKey);
    return Array.isArray(rows) ? rows[0] : null;
}

export async function fetchCustomerById(supabaseUrl, serviceKey, id) {
    const url = `${base(supabaseUrl)}/rest/v1/customers?id=eq.${encodeURIComponent(id)}&select=*&limit=1`;
    const rows = await sbFetch(url, serviceKey);
    return Array.isArray(rows) ? rows[0] : null;
}

export async function patchCustomer(supabaseUrl, serviceKey, id, patch) {
    const url = `${base(supabaseUrl)}/rest/v1/customers?id=eq.${encodeURIComponent(id)}`;
    const res = await fetch(url, {
        method: 'PATCH',
        headers: headers(serviceKey, { Prefer: 'return=representation' }),
        body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || 'Falha ao atualizar cliente');
    return Array.isArray(data) ? data[0] : data;
}

export async function listCustomers(supabaseUrl, serviceKey, { limit = 50, offset = 0 } = {}) {
    const url = `${base(supabaseUrl)}/rest/v1/customers?select=*&order=name.asc&limit=${limit}&offset=${offset}`;
    return sbFetch(url, serviceKey);
}

export async function reserveCredit(supabaseUrl, serviceKey, customerId, amount) {
    const customer = await fetchCustomerById(supabaseUrl, serviceKey, customerId);
    if (!customer) throw new Error('Cliente não encontrado');
    if (customer.is_blocked) throw new Error('Cliente bloqueado para novos pedidos');
    const limit = Number(customer.credit_limit) || 0;
    const used = Number(customer.credit_used) || 0;
    if (limit > 0 && used + amount > limit + 0.001) {
        throw new Error(`Limite de crédito excedido. Disponível: R$ ${(limit - used).toFixed(2)}`);
    }
    return patchCustomer(supabaseUrl, serviceKey, customerId, {
        credit_used: Math.round((used + amount) * 100) / 100,
    });
}

export async function releaseCredit(supabaseUrl, serviceKey, customerId, amount) {
    const customer = await fetchCustomerById(supabaseUrl, serviceKey, customerId);
    if (!customer) return null;
    const used = Math.max(0, Number(customer.credit_used) - amount);
    return patchCustomer(supabaseUrl, serviceKey, customerId, {
        credit_used: Math.round(used * 100) / 100,
    });
}

export async function insertCharge(supabaseUrl, serviceKey, row) {
    const url = `${base(supabaseUrl)}/rest/v1/mp_charges`;
    const res = await fetch(url, {
        method: 'POST',
        headers: headers(serviceKey, { Prefer: 'return=representation' }),
        body: JSON.stringify(row),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || 'Falha ao registrar cobrança');
    return Array.isArray(data) ? data[0] : data;
}

export async function patchCharge(supabaseUrl, serviceKey, id, patch) {
    const url = `${base(supabaseUrl)}/rest/v1/mp_charges?id=eq.${encodeURIComponent(id)}`;
    const res = await fetch(url, {
        method: 'PATCH',
        headers: headers(serviceKey, { Prefer: 'return=representation' }),
        body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || 'Falha ao atualizar cobrança');
    return Array.isArray(data) ? data[0] : data;
}

export async function fetchChargeByMpPaymentId(supabaseUrl, serviceKey, mpPaymentId) {
    const url = `${base(supabaseUrl)}/rest/v1/mp_charges?mp_payment_id=eq.${encodeURIComponent(String(mpPaymentId))}&select=*&limit=1`;
    const rows = await sbFetch(url, serviceKey);
    return Array.isArray(rows) ? rows[0] : null;
}

export async function listOrdersFinance(supabaseUrl, serviceKey, filters = {}) {
    const params = new URLSearchParams();
    params.set('select', '*');
    params.set('order', 'created_at.desc');
    params.set('limit', String(filters.limit || 100));
    params.set('offset', String(filters.offset || 0));
    if (filters.financialStatus) {
        params.set('financial_status', `eq.${filters.financialStatus}`);
    }
    if (filters.customerId) {
        params.set('customer_id', `eq.${filters.customerId}`);
    }
    if (filters.channel) {
        params.set('channel', `eq.${filters.channel}`);
    }
    const url = `${base(supabaseUrl)}/rest/v1/orders?${params}`;
    return sbFetch(url, serviceKey);
}

export async function listCharges(supabaseUrl, serviceKey, { limit = 50, offset = 0 } = {}) {
    const url = `${base(supabaseUrl)}/rest/v1/mp_charges?select=*,orders(id,total,customer_name,financial_status)&order=created_at.desc&limit=${limit}&offset=${offset}`;
    return sbFetch(url, serviceKey);
}

export async function getFinanceSettings(supabaseUrl, serviceKey) {
    const url = `${base(supabaseUrl)}/rest/v1/finance_settings?id=eq.1&select=*&limit=1`;
    const rows = await sbFetch(url, serviceKey);
    return Array.isArray(rows) ? rows[0] : null;
}

export async function patchFinanceSettings(supabaseUrl, serviceKey, patch) {
    const url = `${base(supabaseUrl)}/rest/v1/finance_settings?id=eq.1`;
    const res = await fetch(url, {
        method: 'PATCH',
        headers: headers(serviceKey, { Prefer: 'return=representation' }),
        body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || 'Falha ao salvar configurações');
    return Array.isArray(data) ? data[0] : data;
}

export async function getOrCreateWallet(supabaseUrl, serviceKey, customerId, hubUserId) {
    const url = `${base(supabaseUrl)}/rest/v1/wallet?customer_id=eq.${encodeURIComponent(customerId)}&select=*&limit=1`;
    const rows = await sbFetch(url, serviceKey);
    if (Array.isArray(rows) && rows[0]) return rows[0];
    const insertUrl = `${base(supabaseUrl)}/rest/v1/wallet`;
    const res = await fetch(insertUrl, {
        method: 'POST',
        headers: headers(serviceKey, { Prefer: 'return=representation' }),
        body: JSON.stringify({ customer_id: customerId, hub_user_id: hubUserId || null, balance: 0 }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || 'Falha ao criar carteira');
    return Array.isArray(data) ? data[0] : data;
}

export async function walletTransaction(supabaseUrl, serviceKey, { walletId, type, amount, description, orderId, createdBy }) {
    const walletUrl = `${base(supabaseUrl)}/rest/v1/wallet?id=eq.${encodeURIComponent(walletId)}&select=*&limit=1`;
    const wallets = await sbFetch(walletUrl, serviceKey);
    const wallet = Array.isArray(wallets) ? wallets[0] : null;
    if (!wallet) throw new Error('Carteira não encontrada');
    const delta = Number(amount);
    const nextBalance = Math.max(0, Math.round((Number(wallet.balance) + delta) * 100) / 100);
    const txUrl = `${base(supabaseUrl)}/rest/v1/wallet_transactions`;
    await fetch(txUrl, {
        method: 'POST',
        headers: headers(serviceKey),
        body: JSON.stringify({
            wallet_id: walletId,
            type,
            amount: delta,
            balance_after: nextBalance,
            description: description || null,
            order_id: orderId || null,
            created_by: createdBy || null,
        }),
    });
    const patchUrl = `${base(supabaseUrl)}/rest/v1/wallet?id=eq.${encodeURIComponent(walletId)}`;
    await fetch(patchUrl, {
        method: 'PATCH',
        headers: headers(serviceKey),
        body: JSON.stringify({ balance: nextBalance, updated_at: new Date().toISOString() }),
    });
    return { balance: nextBalance };
}

export async function listWalletTransactions(supabaseUrl, serviceKey, walletId, limit = 50) {
    const url = `${base(supabaseUrl)}/rest/v1/wallet_transactions?wallet_id=eq.${encodeURIComponent(walletId)}&select=*&order=created_at.desc&limit=${limit}`;
    return sbFetch(url, serviceKey);
}

export async function insertPaymentEvent(supabaseUrl, serviceKey, row) {
    const url = `${base(supabaseUrl)}/rest/v1/payment_events`;
    await fetch(url, {
        method: 'POST',
        headers: headers(serviceKey),
        body: JSON.stringify(row),
    });
}

export async function financeDashboardStats(supabaseUrl, serviceKey) {
    const today = new Date().toISOString().slice(0, 10);
    const ordersUrl = `${base(supabaseUrl)}/rest/v1/orders?select=total,financial_status,due_date,customer_id`;
    const orders = await sbFetch(ordersUrl, serviceKey);
    const list = Array.isArray(orders) ? orders : [];

    let openTotal = 0;
    let receivedTotal = 0;
    let overdueTotal = 0;
    const delinquentCustomers = new Set();

    for (const o of list) {
        const total = Number(o.total) || 0;
        const fs = o.financial_status || 'pendente';
        if (fs === 'pago') {
            receivedTotal += total;
        } else if (fs === 'cancelado') {
            continue;
        } else if (fs === 'vencido' || (o.due_date && o.due_date < today && fs !== 'pago')) {
            overdueTotal += total;
            if (o.customer_id) delinquentCustomers.add(o.customer_id);
        } else if (fs === 'pendente' || fs === 'em_cobranca') {
            openTotal += total;
            if (o.due_date && o.due_date < today && o.customer_id) {
                delinquentCustomers.add(o.customer_id);
            }
        }
    }

    let chargesCount = 0;
    try {
        const chargesHead = await fetch(`${base(supabaseUrl)}/rest/v1/mp_charges?select=id`, {
            headers: { ...headers(serviceKey), Prefer: 'count=exact' },
        });
        const range = chargesHead.headers.get('content-range') || '';
        const m = range.match(/\/(\d+)/);
        chargesCount = m ? Number(m[1]) : 0;
    } catch {
        chargesCount = 0;
    }

    return {
        openTotal: Math.round(openTotal * 100) / 100,
        receivedTotal: Math.round(receivedTotal * 100) / 100,
        overdueTotal: Math.round(overdueTotal * 100) / 100,
        delinquentCount: delinquentCustomers.size,
        chargesCount,
        ordersCount: list.length,
    };
}

export async function customerFinanceHistory(supabaseUrl, serviceKey, customerId) {
    const [customer, orders, charges] = await Promise.all([
        fetchCustomerById(supabaseUrl, serviceKey, customerId),
        sbFetch(
            `${base(supabaseUrl)}/rest/v1/orders?customer_id=eq.${encodeURIComponent(customerId)}&select=*&order=created_at.desc&limit=100`,
            serviceKey
        ),
        sbFetch(
            `${base(supabaseUrl)}/rest/v1/mp_charges?customer_id=eq.${encodeURIComponent(customerId)}&select=*&order=created_at.desc&limit=50`,
            serviceKey
        ),
    ]);
    let wallet = null;
    let walletTx = [];
    if (customer) {
        try {
            wallet = await getOrCreateWallet(supabaseUrl, serviceKey, customerId, customer.hub_user_id);
            walletTx = await listWalletTransactions(supabaseUrl, serviceKey, wallet.id, 50);
        } catch {
            /* wallet optional */
        }
    }
    return { customer, orders, charges, wallet, walletTransactions: walletTx };
}

export function customerView(c) {
    if (!c) return null;
    const limit = Number(c.credit_limit) || 0;
    const used = Number(c.credit_used) || 0;
    return {
        id: c.id,
        hubUserId: c.hub_user_id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        creditLimit: limit,
        creditUsed: used,
        creditAvailable: Math.max(0, Math.round((limit - used) * 100) / 100),
        isBlocked: Boolean(c.is_blocked),
        notes: c.notes,
        createdAt: c.created_at,
    };
}

export function orderFinanceView(o) {
    if (!o) return null;
    return {
        id: o.id,
        status: o.status,
        financialStatus: o.financial_status || 'pendente',
        total: Number(o.total),
        paymentMethod: o.payment_method,
        dueDate: o.due_date,
        paidAt: o.paid_at,
        customerId: o.customer_id,
        customerName: o.customer_name,
        customerPhone: o.customer_phone,
        customerEmail: o.customer_email,
        hubUserId: o.hub_user_id,
        channel: o.channel,
        mpPaymentId: o.mp_payment_id,
        mpTransactionId: o.mp_transaction_id,
        latestChargeId: o.latest_charge_id,
        createdAt: o.created_at,
    };
}

export function chargeView(c) {
    if (!c) return null;
    return {
        id: c.id,
        orderId: c.order_id,
        amount: Number(c.amount),
        dueDate: c.due_date,
        status: c.status,
        mpPaymentId: c.mp_payment_id,
        paymentLink: c.payment_link,
        pixQrCode: c.pix_qr_code,
        pixQrBase64: c.pix_qr_base64,
        paidAt: c.paid_at,
        createdAt: c.created_at,
    };
}
