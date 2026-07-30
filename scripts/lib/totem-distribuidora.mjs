import { requireHubSession } from '../../api/hub/_require-hub-session.mjs';
import { resolveCatalogDistribuidoraId } from './distribuidora-scope.mjs';

/**
 * Resolve distribuidora do Totem a partir do Bearer Hub.
 * Sem token / sessão inválida → Distribuidora legada (nunca mistura outras filiais).
 */
export async function resolveTotemDistribuidoraId(req) {
    const auth = String(req.headers.authorization || '');
    if (!auth.startsWith('Bearer ')) return resolveCatalogDistribuidoraId(null);

    const session = await requireHubSession(req);
    if (session.error || !session.usuario?.ativo) return resolveCatalogDistribuidoraId(null);

    return resolveCatalogDistribuidoraId(session.usuario.distribuidora_id);
}

export function totemCatalogCacheKey(distribuidoraId) {
    const id = String(distribuidoraId || '').trim();
    return id ? `catalog:totem:${id}` : 'catalog:totem';
}

export function totemPromocoesCacheKey(distribuidoraId) {
    const id = String(distribuidoraId || '').trim();
    return id ? `promocoes:totem:${id}` : 'promocoes:totem';
}
