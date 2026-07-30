import { hubConfig } from './hub-auth.mjs';

function hubHeaders(config) {
    return {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        'Content-Type': 'application/json',
    };
}

export async function fetchHubPedidoById(hubPedidoId, env = process.env) {
    const hub = hubConfig(env);
    if (!hub.serviceKey || !hubPedidoId) return null;
    const res = await fetch(
        `${hub.url}/rest/v1/pedidos?select=id,numero,status,aceito_em,pagamento_recebido_em,observacoes&id=eq.${encodeURIComponent(hubPedidoId)}&limit=1`,
        { headers: hubHeaders(hub) },
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(data) || !data[0]) return null;
    return data[0];
}

export async function fetchHubPedidoByParceirosOrderId(parceirosOrderId, env = process.env) {
    const hub = hubConfig(env);
    if (!hub.serviceKey || !parceirosOrderId) return null;
    const res = await fetch(
        `${hub.url}/rest/v1/pedidos?select=id,numero,status,aceito_em,pagamento_recebido_em,observacoes&parceiros_order_id=eq.${encodeURIComponent(parceirosOrderId)}&limit=1`,
        { headers: hubHeaders(hub) },
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(data) || !data[0]) return null;
    return data[0];
}

async function fetchHubPedidosByFilter(hub, filterQuery) {
    const res = await fetch(
        `${hub.url}/rest/v1/pedidos?select=id,numero,status,aceito_em,pagamento_recebido_em,observacoes,parceiros_order_id&${filterQuery}`,
        { headers: hubHeaders(hub) },
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(data)) return [];
    return data;
}

async function fetchHubPedidosInColumn(hub, column, ids) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return [];
    const chunkSize = 40;
    const rows = [];
    for (let i = 0; i < unique.length; i += chunkSize) {
        const chunk = unique.slice(i, i + chunkSize);
        const filter = `${column}=in.(${chunk.map((id) => encodeURIComponent(id)).join(',')})`;
        rows.push(...(await fetchHubPedidosByFilter(hub, filter)));
    }
    return rows;
}

/** Mapa order.id (Parceiros) → pedido Hub. */
export async function fetchHubPedidosMapForOrders(orders, env = process.env) {
    const hub = hubConfig(env);
    const map = new Map();
    if (!hub.serviceKey || !orders?.length) return map;

    const views = orders.filter(Boolean);
    const hubIds = views.map((o) => o.hubPedidoId).filter(Boolean);
    const parceirosIds = views.filter((o) => !o.hubPedidoId && o.id).map((o) => o.id);

    const [byHubId, byParceirosId] = await Promise.all([
        fetchHubPedidosInColumn(hub, 'id', hubIds),
        fetchHubPedidosInColumn(hub, 'parceiros_order_id', parceirosIds),
    ]);

    for (const row of byHubId) {
        const view = views.find((o) => o.hubPedidoId === row.id);
        if (view?.id) map.set(view.id, row);
    }
    for (const row of byParceirosId) {
        const pid = row.parceiros_order_id;
        if (pid && !map.has(pid)) map.set(pid, row);
    }

    return map;
}

export async function enrichOrdersWithTracking(orders, env = process.env) {
    const views = (orders || []).filter(Boolean);
    if (!views.length) return [];
    const hubMap = await fetchHubPedidosMapForOrders(views, env);
    return views.map((view) => ({
        ...view,
        tracking: buildOrderTracking(view, hubMap.get(view.id) || null),
    }));
}

const ROUTE_STATUSES = new Set([
    'em_rota',
    'a_caminho',
    'saiu_entrega',
    'em_entrega',
    'proximo_entrega',
]);

const PREP_STATUSES = new Set([
    'aguardando_separacao',
    'em_separacao',
    'separando',
    'aceito',
    'em_preparacao',
]);

const ACCEPTED_STATUSES = new Set(['em_andamento']);

const DONE_STATUSES = new Set(['entregue', 'concluido', 'finalizado', 'entrega_concluida']);

const CANCEL_STATUSES = new Set(['cancelado', 'cancelado_cliente', 'cancelled', 'cancelada']);

function resolveTrackingFilterKey(order, { cancelled, step, hubStatus }) {
    if (cancelled) return 'cancelled';
    if (order?.status === 'pending_payment') return 'pending_payment';
    if (step >= 4) return 'done';
    if (step >= 3) return 'route';
    if (ACCEPTED_STATUSES.has(hubStatus)) return 'accepted';
    if (PREP_STATUSES.has(hubStatus)) return 'separation';
    if (
        order?.status === 'confirmed' &&
        (hubStatus === 'pendente' || hubStatus === 'aguardando_aceite' || !hubStatus)
    ) {
        return 'accepted';
    }
    if (step <= 1 || order?.status === 'pending') return 'pending';
    if (order?.status === 'paid') return 'paid';
    return 'progress';
}

export function buildOrderTracking(order, hubPedido = null) {
    const hubStatus = String(hubPedido?.status || '').toLowerCase();
    let step = 1;
    let stepLabel = 'Aguardando confirmação';
    let message = 'Seu pedido foi recebido e está aguardando confirmação no Ligeirinho Hub.';
    let cancelled = false;

    if (
        order?.status === 'cancelled' ||
        CANCEL_STATUSES.has(hubStatus) ||
        order?.financialStatus === 'cancelado'
    ) {
        cancelled = true;
        step = 0;
        stepLabel = 'Pedido cancelado';
        message = 'Esta solicitação foi cancelada.';
    } else if (DONE_STATUSES.has(hubStatus)) {
        step = 4;
        stepLabel = 'Entrega concluída';
        message = 'Seu pedido foi entregue. Obrigado pela preferência!';
    } else if (ROUTE_STATUSES.has(hubStatus)) {
        step = 3;
        stepLabel = 'A caminho';
        message =
            hubStatus === 'proximo_entrega'
                ? 'Seu pedido é o próximo a ser entregue!'
                : 'Seu pedido saiu para entrega.';
    } else if (ACCEPTED_STATUSES.has(hubStatus)) {
        step = 2;
        stepLabel = 'Aceito';
        message = 'Seu pedido foi aceito e já está em andamento no Ligeirinho.';
    } else if (PREP_STATUSES.has(hubStatus)) {
        step = 2;
        stepLabel = 'Em separação';
        message = 'Seu pedido foi aceito e está em separação no depósito.';
    } else if (
        order?.status === 'confirmed' &&
        (hubStatus === 'pendente' || hubStatus === 'aguardando_aceite' || !hubStatus)
    ) {
        step = 2;
        stepLabel = 'Aceito';
        message = 'Seu pedido foi aceito e já está em andamento no Ligeirinho.';
    } else if (hubStatus === 'pendente' || hubStatus === 'aguardando_aceite' || !hubStatus) {
        step = 1;
        stepLabel = 'Aguardando confirmação';
        message = 'Seu pedido foi recebido e está aguardando confirmação no Ligeirinho Hub.';
    } else if (order?.status === 'paid') {
        step = 2;
        stepLabel = 'Confirmado';
        message = 'Pagamento confirmado. Em breve iniciamos a separação.';
    }

    if (!cancelled && order?.status === 'pending_payment') {
        step = 0;
        stepLabel = 'Aguardando pagamento';
        message = 'Assim que o pagamento for confirmado, seguimos com o pedido.';
    }

    const headerTitleByStep = [
        'Aguardando pagamento',
        'Aguardando confirmação',
        'Em separação',
        'Saiu para entrega',
        'Pedido entregue',
    ];

    const filterKey = resolveTrackingFilterKey(order, { cancelled, step, hubStatus });

    return {
        hubStatus: hubStatus || null,
        hubNumero: hubPedido?.numero ?? null,
        hubPedidoId: hubPedido?.id ?? order?.hubPedidoId ?? null,
        step,
        stepLabel,
        filterKey,
        headerTitle: cancelled
            ? 'Pedido cancelado'
            : ACCEPTED_STATUSES.has(hubStatus)
              ? 'Pedido aceito'
              : headerTitleByStep[step] || stepLabel,
        message,
        cancelled,
        canCancel:
            !cancelled &&
            (order?.channel || 'parceiros') === 'parceiros' &&
            order?.status === 'pending' &&
            (hubStatus === 'pendente' || hubStatus === 'aguardando_aceite' || !hubStatus),
        steps: [
            { id: 'sent', icon: 'send', label: 'Enviado' },
            { id: 'accept', icon: 'check_circle', label: 'Aceite' },
            { id: 'prep', icon: 'package_2', label: 'Separação' },
            { id: 'route', icon: 'local_shipping', label: 'Rota' },
            { id: 'done', icon: 'home', label: 'Entregue' },
        ],
    };
}
