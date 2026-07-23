(function () {
    const LETTER_ROWS = [
        ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
        ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ç'],
        ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
    ];

    const NUMPAD_ROWS = [
        ['7', '8', '9'],
        ['4', '5', '6'],
        ['1', '2', '3'],
        ['0'],
    ];

    const NUMERIC_ROWS = [
        ['7', '8', '9'],
        ['4', '5', '6'],
        ['1', '2', '3'],
    ];

    let root = null;
    let input = null;
    let onInput = null;
    let onSubmit = null;
    let onClose = null;
    let open = false;
    let currentMode = null;
    let lowercaseInput = false;
    let lastInsertAt = 0;
    const INSERT_MIN_MS = 90;

    const syncInput = () => {
        if (!input) return;
        onInput?.(input.value);
    };

    const insertChar = (char) => {
        if (!input) return;
        const now = Date.now();
        if (now - lastInsertAt < INSERT_MIN_MS) return;
        lastInsertAt = now;
        if (lowercaseInput && /[A-ZÇ]/.test(char)) char = char.toLowerCase();
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        const next = `${input.value.slice(0, start)}${char}${input.value.slice(end)}`;
        input.value = next;
        const caret = start + char.length;
        input.setSelectionRange(caret, caret);
        syncInput();
    };

    const backspace = () => {
        if (!input?.value) return;
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        if (start !== end) {
            input.value = `${input.value.slice(0, start)}${input.value.slice(end)}`;
            input.setSelectionRange(start, start);
        } else if (start > 0) {
            input.value = `${input.value.slice(0, start - 1)}${input.value.slice(start)}`;
            input.setSelectionRange(start - 1, start - 1);
        }
        syncInput();
    };

    const clearAll = () => {
        if (!input) return;
        input.value = '';
        input.setSelectionRange(0, 0);
        syncInput();
    };

    const syncVkHeight = () => {
        if (!root || !open) return;
        document.documentElement.style.setProperty('--totem-vk-height', `${root.offsetHeight}px`);
    };

    const clearOpenClasses = () => {
        document.body.classList.remove(
            'totem-keyboard-open',
            'totem-keyboard-customer',
            'totem-keyboard-numeric',
            'totem-keyboard-payment',
        );
        document.documentElement.style.removeProperty('--totem-vk-height');
    };

    const show = () => {
        if (!root) return;
        window.LigeirinhoTotemActivity?.clearGhostSuppression?.();
        const alreadyVisible = open && !root.hidden;
        open = true;
        root.hidden = false;
        root.setAttribute('aria-hidden', 'false');
        document.body.classList.add('totem-keyboard-open');
        document.body.classList.toggle('totem-keyboard-numeric', currentMode === 'numeric');
        document.body.classList.toggle(
            'totem-keyboard-payment',
            currentMode === 'numeric' && document.body.getAttribute('data-page') === 'totem-pagamento',
        );
        const inCustomer = document.getElementById('totem-view-customer')?.classList.contains('totem-view--active');
        document.body.classList.toggle('totem-keyboard-customer', Boolean(inCustomer));
        if (!alreadyVisible) {
            window.requestAnimationFrame(syncVkHeight);
        } else {
            syncVkHeight();
        }
    };

    const hide = () => {
        if (!root || !open) return;
        open = false;
        root.hidden = true;
        root.setAttribute('aria-hidden', 'true');
        clearOpenClasses();
        input?.blur();
        window.LigeirinhoTotemActivity?.suppressGhostClicks?.(320);
        onClose?.();
    };

    const handleKey = (action, value) => {
        if (!input) return;
        if (action === 'char') insertChar(value);
        else if (action === 'space') insertChar(' ');
        else if (action === 'backspace') backspace();
        else if (action === 'clear') clearAll();
        else if (action === 'submit') {
            onSubmit?.(input.value);
            hide();
        } else if (action === 'close') hide();
    };

    const createCharKey = (key) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'totem-vk__key';
        btn.textContent = key;
        btn.dataset.action = 'char';
        btn.dataset.value = key;
        return btn;
    };

    const bindKeyboardEvents = () => {
        root.addEventListener('pointerdown', (e) => {
            e.preventDefault();
        });

        root.querySelector('.totem-vk__inner')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            handleKey(btn.dataset.action, btn.dataset.value || '');
        });
    };

    const buildFullKeyboard = (submitLabel = 'Buscar', { email = false } = {}) => {
        root = document.createElement('div');
        root.id = 'totem-vk';
        root.className = 'totem-vk';
        root.hidden = true;
        root.setAttribute('aria-hidden', 'true');

        const inner = document.createElement('div');
        inner.className = 'totem-vk__inner';
        inner.setAttribute('role', 'group');
        inner.setAttribute('aria-label', 'Teclado virtual ABNT');

        const layout = document.createElement('div');
        layout.className = 'totem-vk__layout';

        const letters = document.createElement('div');
        letters.className = 'totem-vk__letters';

        LETTER_ROWS.forEach((row, index) => {
            const rowEl = document.createElement('div');
            rowEl.className = 'totem-vk__row';
            if (index === 0) rowEl.classList.add('totem-vk__row--top');
            if (index === 1) rowEl.classList.add('totem-vk__row--mid');
            if (index === 2) rowEl.classList.add('totem-vk__row--bottom');

            row.forEach((key) => rowEl.appendChild(createCharKey(key)));

            if (index === 0) {
                const backspaceBtn = document.createElement('button');
                backspaceBtn.type = 'button';
                backspaceBtn.className = 'totem-vk__key totem-vk__key--icon totem-vk__key--backspace';
                backspaceBtn.dataset.action = 'backspace';
                backspaceBtn.setAttribute('aria-label', 'Apagar');
                backspaceBtn.innerHTML =
                    '<span class="material-symbols-outlined" aria-hidden="true">backspace</span>';
                rowEl.appendChild(backspaceBtn);
            }

            letters.appendChild(rowEl);
        });

        if (email) {
            const symRow = document.createElement('div');
            symRow.className = 'totem-vk__row totem-vk__row--symbols';
            ['@', '.', '-', '_'].forEach((key) => symRow.appendChild(createCharKey(key)));
            letters.appendChild(symRow);
        }

        const actions = document.createElement('div');
        actions.className = 'totem-vk__row totem-vk__row--actions';
        actions.innerHTML = `<button type="button" class="totem-vk__key totem-vk__key--wide" data-action="space" aria-label="Espaço">Espaço</button>
<button type="button" class="totem-vk__key totem-vk__key--ghost" data-action="clear">Limpar</button>
<button type="button" class="totem-vk__key totem-vk__key--primary totem-vk__key--submit" data-action="submit">${submitLabel}</button>
<button type="button" class="totem-vk__key totem-vk__key--icon totem-vk__key--ghost" data-action="close" aria-label="Fechar teclado">
<span class="material-symbols-outlined" aria-hidden="true">keyboard_hide</span>
</button>`;
        letters.appendChild(actions);

        const numpad = document.createElement('div');
        numpad.className = 'totem-vk__numpad';
        numpad.setAttribute('aria-label', 'Teclado numérico');

        NUMPAD_ROWS.forEach((row, index) => {
            const rowEl = document.createElement('div');
            rowEl.className = 'totem-vk__numpad-row';
            if (index === NUMPAD_ROWS.length - 1) rowEl.classList.add('totem-vk__numpad-row--zero');
            row.forEach((key) => rowEl.appendChild(createCharKey(key)));
            numpad.appendChild(rowEl);
        });

        layout.appendChild(letters);
        layout.appendChild(numpad);
        inner.appendChild(layout);
        root.appendChild(inner);
        document.body.appendChild(root);
        bindKeyboardEvents();
    };

    const buildNumericKeyboard = (submitLabel = 'OK') => {
        root = document.createElement('div');
        root.id = 'totem-vk';
        root.className = 'totem-vk totem-vk--numeric-only';
        root.hidden = true;
        root.setAttribute('aria-hidden', 'true');

        const inner = document.createElement('div');
        inner.className = 'totem-vk__inner';
        inner.setAttribute('role', 'group');
        inner.setAttribute('aria-label', 'Teclado numérico');

        const numpad = document.createElement('div');
        numpad.className = 'totem-vk__numpad totem-vk__numpad--full';

        NUMERIC_ROWS.forEach((row) => {
            const rowEl = document.createElement('div');
            rowEl.className = 'totem-vk__numpad-row';
            row.forEach((key) => rowEl.appendChild(createCharKey(key)));
            numpad.appendChild(rowEl);
        });

        const bottomRow = document.createElement('div');
        bottomRow.className = 'totem-vk__numpad-row totem-vk__numpad-row--bottom';
        bottomRow.appendChild(createCharKey(','));
        bottomRow.appendChild(createCharKey('0'));
        const backspaceBtn = document.createElement('button');
        backspaceBtn.type = 'button';
        backspaceBtn.className = 'totem-vk__key totem-vk__key--icon totem-vk__key--backspace';
        backspaceBtn.dataset.action = 'backspace';
        backspaceBtn.setAttribute('aria-label', 'Apagar');
        backspaceBtn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">backspace</span>';
        bottomRow.appendChild(backspaceBtn);
        numpad.appendChild(bottomRow);

        const actions = document.createElement('div');
        actions.className = 'totem-vk__row totem-vk__row--numeric-actions';
        actions.innerHTML = `<button type="button" class="totem-vk__key totem-vk__key--ghost" data-action="clear">Limpar</button>
<button type="button" class="totem-vk__key totem-vk__key--primary totem-vk__key--submit" data-action="submit">${submitLabel}</button>
<button type="button" class="totem-vk__key totem-vk__key--icon totem-vk__key--ghost" data-action="close" aria-label="Fechar teclado">
<span class="material-symbols-outlined" aria-hidden="true">keyboard_hide</span>
</button>`;

        inner.appendChild(numpad);
        inner.appendChild(actions);
        root.appendChild(inner);
        document.body.appendChild(root);
        bindKeyboardEvents();
    };

    const setSubmitLabel = (label) => {
        root?.querySelector('.totem-vk__key--submit')?.replaceChildren(document.createTextNode(label || 'Buscar'));
    };

    const ensureKeyboard = (mode, submitLabel) => {
        if (root && currentMode === mode) {
            setSubmitLabel(submitLabel);
            return;
        }
        // Troca de layout (ex.: nome → telefone): recria o teclado e libera show().
        root?.remove();
        root = null;
        open = false;
        clearOpenClasses();
        currentMode = mode;
        if (mode === 'numeric') buildNumericKeyboard(submitLabel);
        else if (mode === 'email') buildFullKeyboard(submitLabel, { email: true });
        else buildFullKeyboard(submitLabel);
    };

    const init = (opts = {}) => {
        input = opts.input || null;
        onInput = typeof opts.onInput === 'function' ? opts.onInput : null;
        onSubmit = typeof opts.onSubmit === 'function' ? opts.onSubmit : null;
        onClose = typeof opts.onClose === 'function' ? opts.onClose : null;
        if (!input) return;

        const mode = opts.mode === 'numeric' ? 'numeric' : opts.mode === 'email' ? 'email' : 'full';
        const submitLabel = String(opts.submitLabel || (mode === 'numeric' ? 'OK' : 'Buscar'));
        lowercaseInput = mode === 'email';
        ensureKeyboard(mode, submitLabel);

        if (!input.hasAttribute('readonly')) {
            input.setAttribute('readonly', 'readonly');
        }
        input.setAttribute('inputmode', 'none');
        if (input.getAttribute('autocomplete') == null) {
            input.setAttribute('autocomplete', 'off');
        }

        if (!input.dataset.totemVkBound) {
            input.dataset.totemVkBound = '1';
            input.addEventListener('focus', () => show());
            input.addEventListener('click', () => show());
        }

        return { show, hide, isOpen: () => open };
    };

    window.LigeirinhoTotemKeyboard = { init, show, hide, isOpen: () => open };
})();
