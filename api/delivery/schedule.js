import { getDeliverySchedule } from '../../scripts/lib/hub-delivery.mjs';

const CACHE_SECONDS = Number(process.env.DELIVERY_CACHE_SECONDS || 120);

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const schedule = await getDeliverySchedule(process.env);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader(
            'Cache-Control',
            `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS * 2}`
        );
        return res.status(200).json(schedule);
    } catch (err) {
        console.error('[api/delivery/schedule]', err.message || err);
        return res.status(500).json({ error: 'Não foi possível carregar as datas de entrega.' });
    }
}
