import { isDistribuidoraAccount, normalizeAccountDigits } from './distribuidora-account.mjs';

export const EDIT_REQUEST_TAG = 'lig-edit-request';
export const EDIT_GRANTED_TAG = 'lig-edit-granted';

export function todayIsoInSaoPaulo(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(date);
}

export function orderDeliveryDateIso(order) {
    const raw = order?.deliveryDate || order?.delivery_date || '';
    const value = String(raw).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function isOrderDeliveryDayToday(order, today = todayIsoInSaoPaulo()) {
    const deliveryDate = orderDeliveryDateIso(order);
    return Boolean(deliveryDate && deliveryDate === today);
}

export function extractCnpjFromOrderNotes(notes) {
    const match = String(notes || '').match(/CNPJ:\s*([0-9./-]+)/i);
    return match ? normalizeAccountDigits(match[1]) : '';
}

export function resolveAccountCnpj(source, order = null) {
    if (isDistribuidoraAccount(source)) return normalizeAccountDigits(typeof source === 'string' ? source : '');
    const fromSource =
        typeof source === 'string'
            ? normalizeAccountDigits(source)
            : normalizeAccountDigits(source?.cnpj || source?.login || source?.cnpjDigits || '');
    if (fromSource.length === 14) return fromSource;
    return extractCnpjFromOrderNotes(order?.notes);
}

export function hasEditPermissionGranted(order) {
    return new RegExp(`\\[\\[${EDIT_GRANTED_TAG}:`, 'i').test(String(order?.notes || ''));
}

export function hasEditPermissionRequested(order) {
    return new RegExp(`\\[\\[${EDIT_REQUEST_TAG}:`, 'i').test(String(order?.notes || ''));
}

export function hubStatusCancelable(hubStatus) {
    const hs = String(hubStatus || '').toLowerCase().trim();
    return hs === 'pendente' || hs === 'aguardando_aceite' || !hs;
}

export function baseOrderEditable(order, hubStatus) {
    if (!order || order.status === 'cancelled') return false;
    if ((order.channel || 'parceiros') !== 'parceiros') return false;
    if (order.status !== 'pending') return false;
    if (order.financialStatus === 'pago' || order.financial_status === 'pago') return false;
    if (order.financialStatus === 'em_cobranca' || order.financial_status === 'em_cobranca') return false;
    return hubStatusCancelable(hubStatus || order?.hubStatus);
}

/**
 * @returns {{
 *   canEdit: boolean,
 *   canRequestEdit: boolean,
 *   deliveryToday: boolean,
 *   editPermissionRequested: boolean,
 *   editPermissionGranted: boolean,
 *   alwaysEditAccount: boolean,
 *   editBlockedReason?: string
 * }}
 */
export function evaluateOrderEditPolicy(order, options = {}) {
    const hubStatus = options.hubStatus ?? order?.tracking?.hubStatus ?? order?.hubStatus ?? '';
    const accountCnpj = resolveAccountCnpj(options.accountCnpj || options.account || '', order);
    const deliveryToday = isOrderDeliveryDayToday(order, options.today);
    const editPermissionGranted = hasEditPermissionGranted(order);
    const editPermissionRequested = hasEditPermissionRequested(order);
    const alwaysEditAccount = isDistribuidoraAccount(accountCnpj);
    const base = baseOrderEditable(order, hubStatus);

    if (!base) {
        return {
            canEdit: false,
            canRequestEdit: false,
            deliveryToday,
            editPermissionRequested,
            editPermissionGranted,
            alwaysEditAccount,
            editBlockedReason: 'status',
        };
    }

    if (alwaysEditAccount) {
        return {
            canEdit: true,
            canRequestEdit: false,
            deliveryToday,
            editPermissionRequested,
            editPermissionGranted,
            alwaysEditAccount: true,
        };
    }

    if (deliveryToday && !editPermissionGranted) {
        return {
            canEdit: false,
            canRequestEdit: !editPermissionRequested,
            deliveryToday,
            editPermissionRequested,
            editPermissionGranted,
            editBlockedReason: 'delivery_day',
        };
    }

    return {
        canEdit: true,
        canRequestEdit: false,
        deliveryToday,
        editPermissionRequested,
        editPermissionGranted,
        alwaysEditAccount: false,
    };
}

export function appendEditRequestNote(notes, at = new Date()) {
    const tag = `[[${EDIT_REQUEST_TAG}:${at.toISOString()}]]`;
    const base = String(notes || '').trim();
    if (base.includes(`[[${EDIT_REQUEST_TAG}:`)) return base.slice(0, 2000);
    const combined = base ? `${base} · ${tag}` : tag;
    return combined.slice(0, 2000);
}

export function preserveEditPolicyTags(existingNotes, newNotes) {
    const existing = String(existingNotes || '');
    const found = [];
    for (const tagName of [EDIT_REQUEST_TAG, EDIT_GRANTED_TAG]) {
        const re = new RegExp(`\\[\\[${tagName}:[^\\]]+\\]\\]`, 'gi');
        let match;
        while ((match = re.exec(existing)) !== null) {
            found.push(match[0]);
        }
    }
    if (!found.length) return newNotes;
    const base = String(newNotes || '').trim();
    const combined = base ? `${base} · ${found.join(' ')}` : found.join(' ');
    return combined.slice(0, 2000);
}
