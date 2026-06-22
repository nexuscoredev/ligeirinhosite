(function () {
    const auth = window.LigeirinhoAuth;
    if (!auth) return;

    const TOTEM_HOME = 'totem.html';
    const PARCEIRO_HOME = 'inicio.html';
    const ACCOUNT_HOME = 'conta.html';
    const LOGIN_PAGE = 'index.html';

    const TOTEM_PAGES = new Set(['totem', 'totem-pagamento', 'totem-sucesso']);
    const RESTRICTED_FOR_TOTEM = new Set(['inicio', 'pedidos', 'contato', 'conta', 'raios', 'ofertas', 'caminhao', 'quemsomos', 'pagamento', 'pedido', 'versao', 'financeiro', 'separacao', 'resumo-pedido']);

    const PASSWORD_HOME = 'conta.html#senha';

    const defaultPathForRole = (role, session) => {
        if (session?.mustChangePassword) return PASSWORD_HOME;
        if (auth.isTotemRole(role)) return TOTEM_HOME;
        if (String(role || '').toUpperCase() === 'ADMIN') return PARCEIRO_HOME;
        return ACCOUNT_HOME;
    };

    const safeNextUrl = (nextUrl, role, session) => {
        const fallback = defaultPathForRole(role, session);
        if (session?.mustChangePassword) {
            return nextUrl?.includes('conta.html#senha') ? nextUrl : PASSWORD_HOME;
        }
        if (!nextUrl) return fallback;
        const base = nextUrl.split('#')[0];
        if (nextUrl.startsWith('//') || nextUrl.includes('://')) return fallback;
        if (auth.isTotemRole(role) && !base.includes('totem')) return TOTEM_HOME;
        if (!auth.isTotemRole(role) && base.includes('totem')) return fallback;
        if (base.startsWith('/') || base.endsWith('.html')) return nextUrl;
        return fallback;
    };

    const currentPage = () => document.body?.dataset?.page || '';

    const guardPageAccess = () => {
        const page = currentPage();
        const session = auth.loadSession();

        if (session?.mustChangePassword && auth.getHubAccessToken) {
            const hash = (window.location.hash || '').replace(/^#/, '').toLowerCase();
            const onPasswordScreen =
                page === 'conta' && (hash === 'senha' || hash.startsWith('senha'));
            const onLogin = page === 'login';
            if (!onPasswordScreen && !onLogin) {
                window.location.replace(`${PASSWORD_HOME}?primeiro=1`);
                return false;
            }
        }

        if (TOTEM_PAGES.has(page)) {
            if (!session) {
                window.location.replace(`${LOGIN_PAGE}?next=${encodeURIComponent(TOTEM_HOME)}`);
                return false;
            }
            if (!auth.isTotemSession(session)) {
                window.location.replace(PARCEIRO_HOME);
                return false;
            }
            return true;
        }

        if (session && auth.isTotemSession(session) && RESTRICTED_FOR_TOTEM.has(page)) {
            window.location.replace(TOTEM_HOME);
            return false;
        }

        if (page === 'separacao' && session) {
            const role = String(session.role || '').toUpperCase();
            if (role !== 'ADMIN' && role !== 'OPERADOR') {
                window.location.replace(PARCEIRO_HOME);
                return false;
            }
        }

        return true;
    };

    const resolveProfile = async (payload) => {
        const res = await fetch('/api/auth/resolve-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Não foi possível validar o perfil.');
        return data.profile;
    };

    const loginWithProfile = async (payload) => {
        const res = await fetch('/api/auth/resolve-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Não foi possível validar o perfil.');

        if (data.hubSession?.accessToken) {
            auth.saveHubSession(data.hubSession);
        } else if (payload.type === 'hub') {
            auth.clearHubSession?.();
        }

        const session = auth.applyProfile(data.profile);
        if (!session) throw new Error('Não foi possível iniciar a sessão.');
        return { session, mustChangePassword: Boolean(data.profile?.mustChangePassword) };
    };

    const redirectAfterLogin = (role, nextUrl, session) => {
        window.location.href = safeNextUrl(nextUrl, role, session);
    };

    window.LigeirinhoAuthRouting = {
        TOTEM_HOME,
        PARCEIRO_HOME,
        ACCOUNT_HOME,
        PASSWORD_HOME,
        defaultPathForRole,
        safeNextUrl,
        guardPageAccess,
        resolveProfile,
        loginWithProfile,
        redirectAfterLogin,
    };

    if (document.body?.dataset?.page && document.body.dataset.page !== 'login') {
        guardPageAccess();
    }
})();
