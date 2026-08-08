/**
 * Configuração da ponte de impressão ESC/POS (PC do depósito).
 * Defina TOTEM_PRINT_BRIDGE_HOST no Vercel (ex.: 192.168.15.10) para tablets
 * encontrarem a ponte sem ?printBridge= na URL.
 */
export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');

    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const host = String(process.env.TOTEM_PRINT_BRIDGE_HOST || '').trim();
    const port = Number(process.env.TOTEM_PRINT_BRIDGE_PORT) || 8787;

    if (!host) {
        return res.status(200).json({ bridgeUrl: null, healthUrl: null });
    }

    const base = host.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const bridgeUrl = `http://${base}:${port}/print`;
    const healthUrl = `http://${base}:${port}/health`;

    return res.status(200).json({ bridgeUrl, healthUrl, port });
}
