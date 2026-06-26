(function () {
    const ROWS = [
        ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
        ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ç'],
        ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ];

    let root = null;
    let input = null;
    let onInput = null;
    let onSubmit = null;
    let onClose = null;
    let open = false;

    const syncInput = () => {
        if (!input) return;
        onInput?.(input.value);
    };

    const insertChar = (char) => {
        if (!input) return;
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

    const show = () => {
        if (!root || open) return;
        open = true;
        root.hidden = false;
        root.setAttribute('aria-hidden', 'false');
        document.body.classList.add('totem-keyboard-open');
    };

    const hide = () => {
        if (!root || !open) return;
        open = false;
        root.hidden = true;
        root.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('totem-keyboard-open');
        input?.blur();
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

    const buildKeyboard = () => {
        root = document.createElement('div');
        root.id = 'totem-vk';
        root.className = 'totem-vk';
        root.hidden = true;
        root.setAttribute('aria-hidden', 'true');

        const inner = document.createElement('div');
        inner.className = 'totem-vk__inner';
        inner.setAttribute('role', 'group');
        inner.setAttribute('aria-label', 'Teclado virtual');

        ROWS.forEach((row) => {
            const rowEl = document.createElement('div');
            rowEl.className = 'totem-vk__row';
            row.forEach((key) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'totem-vk__key';
                btn.textContent = key;
                btn.dataset.action = 'char';
                btn.dataset.value = key;
                rowEl.appendChild(btn);
            });
            inner.appendChild(rowEl);
        });

        const actions = document.createElement('div');
        actions.className = 'totem-vk__row totem-vk__row--actions';
        actions.innerHTML = `<button type="button" class="totem-vk__key totem-vk__key--wide" data-action="space" aria-label="Espaço">Espaço</button>
<button type="button" class="totem-vk__key totem-vk__key--icon" data-action="backspace" aria-label="Apagar">
<span class="material-symbols-outlined" aria-hidden="true">backspace</span>
</button>
<button type="button" class="totem-vk__key totem-vk__key--ghost" data-action="clear">Limpar</button>
<button type="button" class="totem-vk__key totem-vk__key--primary" data-action="submit">Buscar</button>
<button type="button" class="totem-vk__key totem-vk__key--icon totem-vk__key--ghost" data-action="close" aria-label="Fechar teclado">
<span class="material-symbols-outlined" aria-hidden="true">keyboard_hide</span>
</button>`;
        inner.appendChild(actions);

        root.appendChild(inner);
        document.body.appendChild(root);

        root.addEventListener('pointerdown', (e) => {
            e.preventDefault();
        });

        inner.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            handleKey(btn.dataset.action, btn.dataset.value || '');
        });
    };

    const init = (opts = {}) => {
        input = opts.input || null;
        onInput = typeof opts.onInput === 'function' ? opts.onInput : null;
        onSubmit = typeof opts.onSubmit === 'function' ? opts.onSubmit : null;
        onClose = typeof opts.onClose === 'function' ? opts.onClose : null;
        if (!input) return;

        if (!root) buildKeyboard();

        input.setAttribute('readonly', 'readonly');
        input.setAttribute('inputmode', 'none');
        input.setAttribute('autocomplete', 'off');

        input.addEventListener('focus', () => show());
        input.addEventListener('click', () => show());

        return { show, hide, isOpen: () => open };
    };

    window.LigeirinhoTotemKeyboard = { init, show, hide, isOpen: () => open };
})();
