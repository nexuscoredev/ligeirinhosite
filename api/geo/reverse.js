/** Proxy Nominatim — reverse geocode (lat/lng → endereço). */
export const config = { maxDuration: 15 };

const UA = 'LigeirinhoParceiros/1.0 (parceiros@ligeirinho; delivery-address)';

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60');

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const lat = Number(req.query?.lat);
    const lng = Number(req.query?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ error: 'Informe lat e lng válidos.' });
    }

    try {
        const url = new URL('https://nominatim.openstreetmap.org/reverse');
        url.searchParams.set('lat', String(lat));
        url.searchParams.set('lon', String(lng));
        url.searchParams.set('format', 'json');
        url.searchParams.set('addressdetails', '1');
        url.searchParams.set('zoom', '18');
        url.searchParams.set('accept-language', 'pt-BR');

        const upstream = await fetch(url.toString(), {
            headers: { Accept: 'application/json', 'User-Agent': UA },
        });
        if (!upstream.ok) {
            return res.status(502).json({ error: 'Falha ao localizar endereço.' });
        }
        const item = await upstream.json();
        const a = item?.address || {};
        const street =
            a.road || a.pedestrian || a.residential || a.street || a.path || a.neighbourhood || '';
        return res.status(200).json({
            result: {
                id: String(item.place_id || `${lat},${lng}`),
                label: item.display_name || '',
                lat,
                lng,
                street,
                number: a.house_number || '',
                neighborhood: a.suburb || a.neighbourhood || a.quarter || a.city_district || '',
                city: a.city || a.town || a.municipality || a.village || a.county || '',
                state: a.state || '',
                stateCode: (a['ISO3166-2-lvl4'] || '').replace(/^BR-/, '') || '',
                postcode: a.postcode || '',
            },
        });
    } catch (err) {
        console.error('[api/geo/reverse]', err);
        return res.status(502).json({ error: 'Falha ao localizar endereço.' });
    }
}
