(function () {
    const modal = document.getElementById('conta-cnpj-modal');
    if (!modal) return;

    const backdrop = modal.querySelector('[data-conta-cnpj-close]');
    const closeBtn = modal.querySelector('.lig-cnpj-modal__close');
    const form = document.getElementById('conta-cnpj-modal-form');
    const statusEl = document.getElementById('conta-cnpj-modal-status');
    const btnBuscarCnpj = document.getElementById('conta-cnpj-buscar-empresa');
    const btnBuscarCep = document.getElementById('conta-cnpj-buscar-cep');

    const fields = {
        cnpj: document.getElementById('conta-cnpj-field-cnpj'),
        razao: document.getElementById('conta-cnpj-field-razao'),
        fantasia: document.getElementById('conta-cnpj-field-fantasia'),
        cep: document.getElementById('conta-cnpj-field-cep'),
        logradouro: document.getElementById('conta-cnpj-field-logradouro'),
        numero: document.getElementById('conta-cnpj-field-numero'),
        complemento: document.getElementById('conta-cnpj-field-complemento'),
        bairro: document.getElementById('conta-cnpj-field-bairro'),
        cidade: document.getElementById('conta-cnpj-field-cidade'),
        uf: document.getElementById('conta-cnpj-field-uf'),
        telefone: document.getElementById('conta-cnpj-field-telefone'),
        email: document.getElementById('conta-cnpj-field-email'),
        confirmEndereco: document.getElementById('conta-cnpj-confirm-endereco'),
    };

    let getHeaders = null;
    let onSaved = null;
    let ultimoCnpjBuscado = '';

    const apenasDigitos = (v) => String(v || '').replace(/\D/g, '');

    const maskCnpj = (value) => {
        const digits = apenasDigitos(value).slice(0, 14);
        if (digits.length <= 2) return digits;
        if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
        if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
        if (digits.length <= 12) {
            return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
        }
        return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
    };

    const maskCep = (value) => {
        const digits = apenasDigitos(value).slice(0, 8);
        if (digits.length <= 5) return digits;
        return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    };

    const maskPhone = (value) => {
        const digits = apenasDigitos(value).slice(0, 11);
        if (digits.length <= 2) return digits;
        if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    };

    const setStatus = (msg, type = '') => {
        if (!statusEl) return;
        statusEl.hidden = !msg;
        statusEl.textContent = msg || '';
        statusEl.className = 'lig-cnpj-modal__status';
        if (type === 'error') statusEl.classList.add('lig-cnpj-modal__status--error');
        if (type === 'ok') statusEl.classList.add('lig-cnpj-modal__status--ok');
    };

    const setBusy = (busy) => {
        [btnBuscarCnpj, btnBuscarCep, form?.querySelector('[type="submit"]')].forEach((el) => {
            if (el) el.disabled = busy;
        });
    };

    const resetForm = (session = {}) => {
        ultimoCnpjBuscado = '';
        if (form) form.reset();
        if (fields.telefone && session.phone) {
            fields.telefone.value = maskPhone(session.phone);
        }
        if (fields.email && session.email) {
            fields.email.value = session.email;
        }
        setStatus('');
    };

    const open = async (opts = {}) => {
        getHeaders = typeof opts.getHeaders === 'function' ? opts.getHeaders : null;
        onSaved = typeof opts.onSaved === 'function' ? opts.onSaved : null;
        resetForm(opts.session || {});
        modal.classList.add('lig-login-modal--open');
        modal.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('lig-login-modal-open');
        window.setTimeout(() => fields.cnpj?.focus(), 80);
    };

    const close = () => {
        modal.classList.remove('lig-login-modal--open');
        modal.setAttribute('aria-hidden', 'true');
        document.documentElement.classList.remove('lig-login-modal-open');
        setStatus('');
        setBusy(false);
    };

    const aplicarEmpresa = (empresa) => {
        const razao = String(empresa.razao_social || '').trim();
        const fantasia = String(empresa.nome_fantasia || '').trim() || razao;
        if (fields.razao) fields.razao.value = razao;
        if (fields.fantasia) fields.fantasia.value = fantasia;
        if (fields.cep && empresa.cep) fields.cep.value = maskCep(empresa.cep);
        if (fields.logradouro && empresa.logradouro) fields.logradouro.value = empresa.logradouro;
        if (fields.numero && empresa.numero) fields.numero.value = empresa.numero;
        if (fields.complemento && empresa.complemento) fields.complemento.value = empresa.complemento;
        if (fields.bairro && empresa.bairro) fields.bairro.value = empresa.bairro;
        if (fields.cidade && empresa.municipio) fields.cidade.value = empresa.municipio;
        if (fields.uf && empresa.uf) fields.uf.value = String(empresa.uf).toUpperCase();
        if (fields.telefone && empresa.ddd_telefone_1) {
            fields.telefone.value = maskPhone(empresa.ddd_telefone_1);
        }
        if (fields.email && empresa.email && !fields.email.value) {
            fields.email.value = empresa.email;
        }
    };

    const buscarEmpresa = async () => {
        const digits = apenasDigitos(fields.cnpj?.value || '');
        if (digits.length !== 14) {
            setStatus('Informe um CNPJ com 14 dígitos para buscar a empresa.', 'error');
            fields.cnpj?.focus();
            return;
        }
        if (!getHeaders) {
            setStatus('Sessão expirada. Saia e entre novamente.', 'error');
            return;
        }

        setBusy(true);
        setStatus('Consultando dados na Receita Federal…');
        try {
            const headers = await getHeaders();
            const res = await fetch('/api/cnpj/consultar', {
                method: 'POST',
                headers,
                body: JSON.stringify({ cnpj: digits }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'CNPJ não encontrado.');
            aplicarEmpresa(data.empresa || {});
            ultimoCnpjBuscado = digits;
            setStatus('Dados da empresa preenchidos. Confira e ajuste se necessário.', 'ok');
        } catch (err) {
            setStatus(err.message || 'Falha ao consultar CNPJ.', 'error');
        } finally {
            setBusy(false);
        }
    };

    const buscarCep = async () => {
        const digits = apenasDigitos(fields.cep?.value || '');
        if (digits.length !== 8) {
            setStatus('Informe um CEP com 8 dígitos.', 'error');
            fields.cep?.focus();
            return;
        }
        if (!getHeaders) {
            setStatus('Sessão expirada. Saia e entre novamente.', 'error');
            return;
        }

        setBusy(true);
        setStatus('Buscando endereço pelo CEP…');
        try {
            const headers = await getHeaders();
            const res = await fetch('/api/cep/consultar', {
                method: 'POST',
                headers,
                body: JSON.stringify({ cep: digits }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'CEP não encontrado.');
            const end = data.endereco || {};
            if (fields.cep && end.cep) fields.cep.value = end.cep;
            if (fields.logradouro) fields.logradouro.value = end.logradouro || '';
            if (fields.complemento && end.complemento) fields.complemento.value = end.complemento;
            if (fields.bairro) fields.bairro.value = end.bairro || '';
            if (fields.cidade) fields.cidade.value = end.cidade || '';
            if (fields.uf) fields.uf.value = end.uf || '';
            setStatus('Endereço preenchido pelo CEP.', 'ok');
        } catch (err) {
            setStatus(err.message || 'Falha ao consultar CEP.', 'error');
        } finally {
            setBusy(false);
        }
    };

    fields.cnpj?.addEventListener('input', () => {
        if (!fields.cnpj) return;
        const pos = fields.cnpj.selectionStart;
        const before = fields.cnpj.value;
        fields.cnpj.value = maskCnpj(before);
        if (typeof pos === 'number') {
            const delta = fields.cnpj.value.length - before.length;
            fields.cnpj.setSelectionRange(pos + delta, pos + delta);
        }
    });

    fields.cnpj?.addEventListener('blur', () => {
        const digits = apenasDigitos(fields.cnpj?.value || '');
        if (digits.length === 14 && digits !== ultimoCnpjBuscado) {
            void buscarEmpresa();
        }
    });

    fields.cep?.addEventListener('input', () => {
        if (!fields.cep) return;
        fields.cep.value = maskCep(fields.cep.value);
    });

    fields.telefone?.addEventListener('input', () => {
        if (!fields.telefone) return;
        fields.telefone.value = maskPhone(fields.telefone.value);
    });

    btnBuscarCnpj?.addEventListener('click', () => void buscarEmpresa());
    btnBuscarCep?.addEventListener('click', () => void buscarCep());

    [backdrop, closeBtn].forEach((el) => {
        el?.addEventListener('click', close);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('lig-login-modal--open')) {
            e.preventDefault();
            close();
        }
    });

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!getHeaders) {
            setStatus('Sessão expirada. Saia e entre novamente.', 'error');
            return;
        }

        const cnpj = fields.cnpj?.value || '';
        const razao_social = fields.razao?.value?.trim() || '';
        const nome_fantasia = fields.fantasia?.value?.trim() || '';
        const endereco = {
            cep: fields.cep?.value || '',
            logradouro: fields.logradouro?.value?.trim() || '',
            numero: fields.numero?.value?.trim() || '',
            complemento: fields.complemento?.value?.trim() || '',
            bairro: fields.bairro?.value?.trim() || '',
            cidade: fields.cidade?.value?.trim() || '',
            uf: fields.uf?.value?.trim().toUpperCase() || '',
        };

        if (!razao_social) {
            setStatus('Informe a razão social.', 'error');
            fields.razao?.focus();
            return;
        }
        if (!fields.confirmEndereco?.checked) {
            setStatus('Confirme que o endereço informado é o da empresa.', 'error');
            fields.confirmEndereco?.focus();
            return;
        }

        setBusy(true);
        setStatus('Salvando cadastro…');
        try {
            const headers = await getHeaders();
            const res = await fetch('/api/account/profile', {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                    field: 'cnpj',
                    value: cnpj,
                    cadastro: {
                        cnpj,
                        razao_social,
                        nome_fantasia,
                        telefone: fields.telefone?.value || '',
                        email: fields.email?.value?.trim() || '',
                        endereco,
                    },
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao salvar.');
            setStatus('CNPJ cadastrado com sucesso!', 'ok');
            onSaved?.(data.profile);
            window.setTimeout(close, 600);
        } catch (err) {
            setStatus(err.message || 'Erro ao salvar.', 'error');
        } finally {
            setBusy(false);
        }
    });

    window.LigeirinhoContaCnpjModal = { open, close };
})();
