import {
    hubConfig,
    isTotemRole,
    resolveHubLogin,
    resolveProfileByEmail,
    resolveProfileByPhone,
} from '../../scripts/hub-auth.mjs';
import { ensureUsuarioForGoogleParceiro } from '../../scripts/hub-parceiro.mjs';
import { issueAccountSession } from '../../scripts/account-session.mjs';

export const config = { maxDuration: 15 };

function parseJwtPayload(token) {
    try {
        const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
    } catch {
        return null;
    }
}

function publicProfile(profile) {
    return {
        sub: profile.sub,
        email: profile.email || '',
        name: profile.name || '',
        phone: profile.phone || '',
        login: profile.login || '',
        role: profile.role || 'PARCEIRO',
        cargo: profile.cargo || '',
        hubUserId: profile.hubUserId || '',
        provider: profile.provider || 'hub',
        totemUnitId: profile.totemUnitId || null,
        totemLabel: profile.totemLabel || null,
        isTotem: isTotemRole(profile.role),
        mustChangePassword: Boolean(profile.mustChangePassword),
        cnpj: profile.cnpj || '',
        condicaoPagamento: profile.condicaoPagamento || '',
        parcelasVencimento: profile.parcelasVencimento || '',
        pessoaId: profile.pessoaId || null,
        paymentMethods: profile.paymentMethods || [],
        deliveryDateOptions: profile.deliveryDateOptions || [],
        datasEntrega: profile.datasEntrega || [],
        diasEntregaLabel: profile.diasEntregaLabel || '',
        razaoSocial: profile.razaoSocial || '',
    };
}

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = req.body || {};
        const hub = hubConfig(process.env);
        const type = String(body.type || 'hub').toLowerCase();

        if (type === 'hub') {
            const login = String(body.login || '').trim();
            const password = String(body.password || '');
            if (!login || !password) {
                return res.status(400).json({ error: 'Informe usuário e senha.' });
            }
            const result = await resolveHubLogin(hub, login, password);
            if (result.error) return res.status(401).json({ error: result.error });

            return res.status(200).json({
                profile: publicProfile(result.profile),
                hubSession: {
                    accessToken: result.accessToken,
                    refreshToken: result.refreshToken || '',
                    expiresAt: Date.now() + 3600 * 1000,
                },
            });
        }

        if (type === 'google') {
            const credential = String(body.credential || '');
            const payload = parseJwtPayload(credential);
            if (!payload?.sub) {
                return res.status(400).json({ error: 'Credencial Google inválida.' });
            }
            const email = String(payload.email || '').trim().toLowerCase();
            let profile = await resolveProfileByEmail(hub, email, {
                sub: payload.sub,
                name: payload.name,
                picture: payload.picture,
                phone: String(body.phone || '').trim(),
                provider: 'google',
            });

            if (hub.serviceKey && email) {
                let hubUserId = profile.hubUserId || '';
                if (!hubUserId) {
                    try {
                        const usuario = await ensureUsuarioForGoogleParceiro(hub, {
                            email,
                            name: String(payload.name || '').trim(),
                        });
                        hubUserId = usuario?.id || '';
                        if (hubUserId) {
                            profile = { ...profile, hubUserId, sub: hubUserId };
                        }
                    } catch (err) {
                        console.warn('[resolve-profile] ensureUsuarioForGoogleParceiro', err.message);
                    }
                }

                const accountSession = hubUserId
                    ? issueAccountSession({
                          userId: hubUserId,
                          email,
                          provider: 'google',
                      })
                    : null;

                return res.status(200).json({
                    profile: publicProfile(profile),
                    accountSession,
                });
            }

            return res.status(200).json({ profile: publicProfile(profile) });
        }

        if (type === 'phone') {
            const phone = String(body.phone || '').trim();
            const name = String(body.name || '').trim();
            if (!phone || name.length < 2) {
                return res.status(400).json({ error: 'Telefone e nome são obrigatórios.' });
            }
            const profile = await resolveProfileByPhone(hub, phone, name);
            return res.status(200).json({ profile: publicProfile(profile) });
        }

        return res.status(400).json({ error: 'Tipo de autenticação não suportado.' });
    } catch (err) {
        console.error('auth/resolve-profile', err);
        return res.status(500).json({ error: err.message || 'Erro ao resolver perfil.' });
    }
}
