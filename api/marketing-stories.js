const CACHE_SECONDS = Number(process.env.MARKETING_STORIES_CACHE_SECONDS || 300);

/** Encartes do Google Drive não são exibidos no app Parceiros — somente promoções da tabela PROMOCAO. */
const EMPTY_PAYLOAD = {
    source: 'disabled:marketing-drive',
    stories: [],
};

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
        'Cache-Control',
        `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS * 2}`
    );
    return res.status(200).json(EMPTY_PAYLOAD);
}
