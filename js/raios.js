(function () {
    const root = document.getElementById('raios-app');
    if (!root) return;

    const raios = window.LigeirinhoRaios;
    const cart = window.LigeirinhoCart;
    if (!raios) return;

    const esc = (v) =>
        String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    let config = null;

    const currentView = () => {
        const hash = (window.location.hash || '').replace(/^#/, '').toLowerCase();
        return hash || 'home';
    };

    const memberHeader = () => {
        const state = raios.load();
        const member = raios.isMember();
        return `<header class="raios-hero">
<div class="raios-hero__top">
<button type="button" class="raios-hero__back" data-raios-exit aria-label="Voltar">
<span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
</button>
<h1 class="raios-hero__title">Club Raios</h1>
</div>
<div class="raios-points-pill">
<span class="raios-points-pill__icon" aria-hidden="true">⚡</span>
<span class="raios-points-pill__value">${raios.formatPoints(state.points)} pontos</span>
</div>
${member ? '' : `<p class="raios-hero__guest">Entre no clube e ganhe Raios a cada pedido pago.</p>`}
</header>`;
    };

    const subHeader = (title) =>
        `<header class="raios-sub-header">
<button type="button" class="raios-sub-header__back" data-raios-nav="" aria-label="Voltar">
<span class="material-symbols-outlined">arrow_back</span>
</button>
<h1 class="raios-sub-header__title">${esc(title)}</h1>
</header>`;

    const renderJoinCta = () =>
        `<div class="raios-join-card">
<div class="raios-join-card__icon">⚡</div>
<h2 class="raios-join-card__title">Faça parte do Club Raios</h2>
<p class="raios-join-card__sub">Ganhe pontos em cada pedido via Mercado Pago e troque por benefícios.</p>
<button type="button" class="raios-btn raios-btn--yellow" id="raios-join-btn">Participar grátis</button>
<p class="raios-join-card__hint">+${config?.welcomeBonus || 500} Raios de boas-vindas</p>
</div>`;

    const renderHome = () => {
        const state = raios.load();
        const member = raios.isMember();
        const goal = Number(config?.tierGoal) || 5000;
        const progress = Math.min(100, Math.round(((state.earnedThisPeriod || 0) / goal) * 100));

        const summaryCards = member
            ? `<div class="raios-summary-row">
<article class="raios-summary-card">
<span class="raios-summary-card__tag">Membro Club Raios</span>
<p class="raios-summary-card__value">${raios.formatPoints(state.points)} <span>pontos</span></p>
<p class="raios-summary-card__sub">para resgatar</p>
<button type="button" class="raios-summary-card__link" data-raios-nav="transacoes">Transações</button>
</article>
<article class="raios-summary-card">
<div class="raios-summary-card__ring" style="--raios-progress:${progress}%">
<span class="raios-summary-card__ring-icon">⚡</span>
</div>
<p class="raios-summary-card__value raios-summary-card__value--sm">${raios.formatPoints(state.earnedThisPeriod || 0)} <span class="text-muted">/ ${raios.formatPoints(goal)}</span></p>
<p class="raios-summary-card__sub">pontos ganhos no período</p>
<button type="button" class="raios-summary-card__link" data-raios-nav="resgatar">Resgatar prêmios</button>
</article>
</div>`
            : renderJoinCta();

        const challenges = (config?.challenges || [])
            .map(
                (c) => `<article class="raios-challenge-card">
<div class="raios-challenge-card__icon"><span class="material-symbols-outlined">${esc(c.icon)}</span></div>
<p class="raios-challenge-card__title">${esc(c.title)}</p>
<p class="raios-challenge-card__sub">${esc(c.subtitle)}</p>
<span class="raios-challenge-card__badge">${esc(c.multiplier || '')} ${raios.formatPoints(c.points)} pontos</span>
</article>`
            )
            .join('');

        const missions = (config?.missions || [])
            .map(
                (m) => `<article class="raios-mission-card">
<div class="raios-mission-card__banner">
<span class="raios-mission-card__badge">${esc(m.badge)}</span>
<p class="raios-mission-card__cat">${esc(m.subtitle)}</p>
</div>
<p class="raios-mission-card__title">${esc(m.title)}</p>
<div class="raios-mission-card__footer">
<span class="raios-mission-card__pts">⚡ ${raios.formatPoints(m.points)} pontos</span>
<a href="pedidos.html?categoria=${encodeURIComponent(m.categoryId)}" class="raios-mission-card__cta">Ver produtos</a>
</div>
</article>`
            )
            .join('');

        root.innerHTML = `${memberHeader()}
<div class="raios-body-content">
${summaryCards}
<div class="raios-promo-banner" aria-hidden="true">
<div class="raios-promo-banner__text">
<p class="raios-promo-banner__title">Acumule Raios</p>
<p class="raios-promo-banner__sub">a cada pedido no app</p>
</div>
<span class="raios-promo-banner__emoji">⚡</span>
</div>
${
    challenges
        ? `<section class="raios-section">
<h2 class="raios-section__title">Desafios</h2>
<div class="raios-scroll-row">${challenges}</div>
</section>`
        : ''
}
<section class="raios-section">
<div class="raios-section__head">
<h2 class="raios-section__title">Missões</h2>
<a href="pedidos.html" class="raios-section__link">Ver catálogo</a>
</div>
<div class="raios-scroll-row raios-scroll-row--missions">${missions}</div>
<button type="button" class="raios-btn raios-btn--outline raios-btn--full" data-raios-nav="resgatar">Ganhe mais Raios nos pedidos</button>
</section>
<section class="raios-section">
<div class="raios-section__head">
<h2 class="raios-section__title">Mais formas de acumular</h2>
</div>
<article class="raios-earn-card">
<div class="raios-earn-card__body">
<p class="raios-earn-card__title">Ganhe pontos sem complicação</p>
<p class="raios-earn-card__sub">Pague pelo app com Mercado Pago e os Raios caem automaticamente.</p>
<a href="pedidos.html" class="raios-btn raios-btn--dark raios-btn--sm">Fazer pedido</a>
</div>
<span class="raios-earn-card__art">🚀</span>
</article>
</section>
<section class="raios-section">
<div class="raios-section__head">
<h2 class="raios-section__title">Resgate por categoria</h2>
<button type="button" class="raios-section__link" data-raios-nav="resgatar">Mostrar tudo</button>
</div>
<div class="raios-cat-preview">${renderCategoryGrid((config?.redeemCategories || []).slice(0, 6))}</div>
</section>
<p class="raios-terms"><button type="button" class="raios-terms__link" data-raios-nav="termos">Mostrar Termos e Condições</button></p>
</div>`;
    };

    const renderCategoryGrid = (categories) =>
        categories
            .map(
                (cat) => `<a href="pedidos.html?categoria=${encodeURIComponent(cat.id)}" class="raios-cat-tile" style="--raios-cat-bg:${esc(cat.bg)}">
<div class="raios-cat-tile__media">
<span class="material-symbols-outlined raios-cat-tile__icon">${esc(cat.icon)}</span>
</div>
<span class="raios-cat-tile__label">${esc(cat.label)}</span>
</a>`
            )
            .join('');

    const renderResgatar = () => {
        root.innerHTML = `${subHeader('Resgatar prêmios')}
<div class="raios-body-content raios-body-content--grid">
<p class="raios-sub-lead">Use seus Raios em produtos do catálogo. Cada categoria traz ofertas para membros.</p>
<div class="raios-cat-grid">${renderCategoryGrid(config?.redeemCategories || [])}</div>
<p class="raios-terms"><button type="button" class="raios-terms__link" data-raios-nav="termos">Mostrar Termos e Condições</button></p>
</div>`;
    };

    const renderTransacoes = () => {
        const state = raios.load();
        const rows = state.transactions.length
            ? state.transactions
                  .map(
                      (t) => `<div class="raios-tx-row">
<div class="raios-tx-row__main">
<p class="raios-tx-row__desc">${esc(t.description)}</p>
<p class="raios-tx-row__date">${esc(new Date(t.createdAt).toLocaleString('pt-BR'))}</p>
</div>
<span class="raios-tx-row__amt ${t.amount >= 0 ? 'raios-tx-row__amt--pos' : ''}">${t.amount >= 0 ? '+' : ''}${raios.formatPoints(t.amount)}</span>
</div>`
                  )
                  .join('')
            : `<p class="raios-empty">Nenhuma movimentação ainda. Faça um pedido para ganhar Raios.</p>`;

        root.innerHTML = `${subHeader('Transações')}
<div class="raios-body-content">
<div class="raios-tx-balance">
<p class="raios-tx-balance__label">Saldo atual</p>
<p class="raios-tx-balance__value">⚡ ${raios.formatPoints(state.points)}</p>
</div>
<div class="raios-tx-list">${rows}</div>
</div>`;
    };

    const renderTermos = () => {
        root.innerHTML = `${subHeader('Termos e Condições')}
<div class="raios-body-content raios-body-content--plain">
<div class="raios-terms-doc">
<p>O Club Raios é o programa de fidelidade do Ligeirinho Parceiros. Ao participar, você acumula pontos (Raios) em pedidos pagos pelo app via Mercado Pago.</p>
<ul>
<li><strong>Acúmulo:</strong> ${config?.pointsPerReal || 10} Raios por R$ 1,00 em pedidos aprovados.</li>
<li><strong>Bônus:</strong> ${config?.welcomeBonus || 500} Raios na primeira adesão.</li>
<li><strong>Resgate:</strong> categorias do catálogo com benefícios promocionais (em expansão).</li>
<li><strong>Validade:</strong> pontos podem expirar após 12 meses sem movimentação.</li>
</ul>
<p>Regras podem ser atualizadas. Dúvidas: WhatsApp (11) 97092-4909.</p>
</div>
</div>`;
    };

    const bindCommon = () => {
        root.querySelectorAll('[data-raios-nav]').forEach((el) => {
            el.addEventListener('click', () => {
                const target = el.dataset.raiosNav;
                window.location.hash = target ? `#${target}` : '';
                if (!target && window.location.hash) window.location.hash = '';
                else render();
            });
        });

        root.querySelector('#raios-join-btn')?.addEventListener('click', () => {
            raios.join();
            raios.creditWelcomeBonus(config?.welcomeBonus);
            render();
        });

        root.querySelector('[data-raios-exit]')?.addEventListener('click', () => {
            if (window.history.length > 1) window.history.back();
            else window.location.href = 'inicio.html';
        });
    };

    const render = () => {
        if (!config) return;
        const view = currentView();
        switch (view) {
            case 'resgatar':
                renderResgatar();
                break;
            case 'transacoes':
                renderTransacoes();
                break;
            case 'termos':
                renderTermos();
                break;
            default:
                renderHome();
        }
        bindCommon();
    };

    const init = () => {
        fetch('data/raios-config.json')
            .then((r) => (r.ok ? r.json() : {}))
            .catch(() => ({}))
            .then((cfg) => {
                config = cfg;
                if (raios.isMember()) raios.creditWelcomeBonus(cfg.welcomeBonus);
                render();
            });
    };

    window.addEventListener('hashchange', render);
    window.addEventListener('ligeirinho-raios-changed', render);
    window.addEventListener('ligeirinho-prefs-changed', render);

    init();
})();
