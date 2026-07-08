import { getHubPromocoes } from '../scripts/lib/hub-promocoes.mjs';

const CACHE_SECONDS = Number(process.env.PROMOCOES_CACHE_SECONDS || 60);

function setLiveCacheHeaders(res, req, seconds) {
    if (req.query?.sync != null) {
        res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
        return;
    }
    res.setHeader(
        'Cache-Control',
        `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`,
    );
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const payload = await getHubPromocoes(process.env);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        setLiveCacheHeaders(res, req, CACHE_SECONDS);
        return res.status(200).json(payload);
    } catch (err) {
        console.error('[api/promocoes]', err.message || err);
        return res.status(502).json({
            error: 'Não foi possível carregar as promoções do Hub.',
            detail: err.message || String(err),
        });
    }
}
