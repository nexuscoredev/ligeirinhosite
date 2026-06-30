import { getHubMarketingStories } from '../scripts/lib/hub-marketing-stories.mjs';

const CACHE_SECONDS = Number(process.env.MARKETING_STORIES_CACHE_SECONDS || 120);

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const payload = await getHubMarketingStories(process.env);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader(
            'Cache-Control',
            `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS * 2}`
        );
        return res.status(200).json(payload);
    } catch (err) {
        console.error('[api/marketing-stories]', err.message || err);
        return res.status(502).json({
            error: 'Não foi possível carregar os stories de promoções do Hub.',
            detail: err.message || String(err),
            stories: [],
        });
    }
}
