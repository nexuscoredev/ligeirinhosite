import { requireAccountSession } from './_require-hub-session.mjs';
import {
    buildParceiroExtras,
    registerParceiroCnpjCadastro,
    registerUsuarioCnpj,
    resolveParceiroDisplayName,
    resolveParceiroEmail,
    updateUsuarioFields,
    usuarioHasCnpj,
} from '../../scripts/hub-parceiro.mjs';
import { isTotemRole } from '../../scripts/hub-auth.mjs';

export const config = { maxDuration: 15 };

function publicProfile(usuario, extras = {}) {
    const cnpjDigits = extras.cnpjDigits || '';
    const provider = extras.provider || 'hub';
    const base = {
        sub: usuario.id,
        email: usuario.email || '',
        name: usuario.nome || '',
        phone: usuario.telefone || '',
        login: usuario.login || '',
        role: extras.role || 'PARCEIRO',
        hubUserId: usuario.id,
        mustChangePassword: Boolean(usuario.must_change_password),
        ...extras,
        provider,
    };
    return {
        ...base,
        email: resolveParceiroEmail({
            provider: 'hub',
            authEmail: base.email,
            usuario,
            cnpjDigits,
        }),
        name: resolveParceiroDisplayName({
            provider: 'hub',
            authName: base.name,
            usuario,
            cnpjDigits,
        }),
    };
}

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    let session;
    try {
        session = await requireAccountSession(req);
    } catch (err) {
        console.error('account/profile session', err);
        return res.status(503).json({ error: 'Falha ao validar sessão. Tente novamente.' });
    }
    if (session.error) {
        return res.status(session.status).json({ error: session.error });
    }

    const profileExtras = async (usuario) => ({
        ...(await buildParceiroExtras(session.config, usuario)),
        provider: session.provider || 'hub',
    });

    if (req.method === 'GET') {
        try {
            return res.status(200).json({
                profile: publicProfile(session.usuario, await profileExtras(session.usuario)),
            });
        } catch (err) {
            console.error('account/profile GET', err);
            return res.status(500).json({ error: err.message || 'Erro ao carregar perfil.' });
        }
    }

    if (req.method === 'PATCH') {
        try {
            const body = req.body || {};
            const field = String(body.field || '').toLowerCase();
            const value = String(body.value || '').trim();

            if (isTotemRole(session.usuario.cargo) || isTotemRole(session.usuario.login)) {
                return res.status(403).json({ error: 'Conta totem não pode alterar dados aqui.' });
            }

            if (field === 'telefone') {
                const digits = value.replace(/\D/g, '');
                if (digits.length < 10 || digits.length > 13) {
                    return res.status(400).json({ error: 'Informe um telefone válido com DDD.' });
                }
                const usuario = await updateUsuarioFields(session.config, session.userId, {
                    telefone: digits,
                });
                return res.status(200).json({
                    profile: publicProfile(usuario, await profileExtras(usuario)),
                });
            }

            if (field === 'email') {
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    return res.status(400).json({ error: 'Informe um e-mail válido.' });
                }
                const usuario = await updateUsuarioFields(session.config, session.userId, { email: value });
                return res.status(200).json({
                    profile: publicProfile(usuario, await profileExtras(usuario)),
                });
            }

            if (field === 'cnpj') {
                const parceiroAtual = await buildParceiroExtras(session.config, session.usuario);
                if (usuarioHasCnpj(session.usuario, parceiroAtual)) {
                    return res.status(400).json({ error: 'Esta conta já possui CNPJ cadastrado.' });
                }

                const cadastro = body.cadastro && typeof body.cadastro === 'object' ? body.cadastro : null;
                const usuario = cadastro
                    ? await registerParceiroCnpjCadastro(
                          session.config,
                          session.userId,
                          session.usuario,
                          { ...cadastro, cnpj: cadastro.cnpj || value },
                      )
                    : await registerUsuarioCnpj(
                          session.config,
                          session.userId,
                          session.usuario,
                          value,
                      );
                return res.status(200).json({
                    profile: publicProfile(usuario, await profileExtras(usuario)),
                });
            }

            return res.status(400).json({ error: 'Campo inválido. Use telefone, email ou cnpj.' });
        } catch (err) {
            console.error('account/profile PATCH', err);
            return res.status(500).json({ error: err.message || 'Erro ao atualizar perfil.' });
        }
    }

    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: 'Method not allowed' });
}
