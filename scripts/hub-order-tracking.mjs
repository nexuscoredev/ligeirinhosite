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

const DONE_STATUSES = new Set(['entregue', 'concluido', 'finalizado', 'entrega_concluida']);

export function buildOrderTracking(order, hubPedido = null) {
    const hubStatus = String(hubPedido?.status || '').toLowerCase();
    let step = 1;
    let stepLabel = 'Aguardando aceite';
    let message = 'Seu pedido foi recebido e está aguardando aceite no Ligeirinho Hub.';

    if (DONE_STATUSES.has(hubStatus)) {
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
    } else if (PREP_STATUSES.has(hubStatus)) {
        step = 2;
        stepLabel = 'Preparando pedido';
        message = 'Seu pedido foi aceito e está sendo preparado.';
    } else if (hubStatus === 'pendente' || hubStatus === 'aguardando_aceite' || !hubStatus) {
        step = 1;
        stepLabel = 'Aguardando aceite';
        message = 'Seu pedido foi recebido e está aguardando aceite no Ligeirinho Hub.';
    } else if (order?.status === 'paid') {
        step = 2;
        stepLabel = 'Confirmado';
        message = 'Pagamento confirmado. Em breve iniciamos a separação.';
    }

    if (order?.status === 'pending_payment') {
        step = 0;
        stepLabel = 'Aguardando pagamento';
        message = 'Assim que o pagamento for confirmado, seguimos com o pedido.';
    }

    const headerTitleByStep = [
        'Aguardando pagamento',
        'Aguardando aceite',
        'Preparando pedido',
        'Saiu para entrega',
        'Pedido entregue',
    ];

    return {
        hubStatus: hubStatus || null,
        hubNumero: hubPedido?.numero ?? null,
        hubPedidoId: hubPedido?.id ?? order?.hubPedidoId ?? null,
        step,
        stepLabel,
        headerTitle: headerTitleByStep[step] || stepLabel,
        message,
        steps: [
            { id: 'sent', icon: 'shopping_bag', label: 'Enviado' },
            { id: 'accept', icon: 'inventory_2', label: 'Aceite' },
            { id: 'prep', icon: 'soup_kitchen', label: 'Preparo' },
            { id: 'route', icon: 'local_shipping', label: 'Rota' },
            { id: 'done', icon: 'home', label: 'Entregue' },
        ],
    };
}
