# Guia — Desativar gestos de borda no totem (Windows 11)

Quando o cliente **desliza o dedo da borda esquerda para a direita**, o Windows pode abrir o **Task View / multitarefa** e sair do totem. Este guia descreve como desativar isso no PC do quiosque.

Use **as três camadas** abaixo. Só a Configurações do Windows muitas vezes não basta; o registro + iniciar pelo `totem-kiosk.bat` reforçam o bloqueio.

---

## Resumo rápido

| Camada | O que fazer | Frequência |
|--------|-------------|------------|
| 1 | Configurações do Windows 11 | Uma vez |
| 2 | Assistente `totem-configurar-pc.bat` | Uma vez |
| 3 | Sempre abrir pelo `totem-kiosk.bat` | Sempre |

---

## Camada 1 — Configurações do Windows 11 (manual)

1. Abra **Configurações** (`Win + I`).
2. Vá em **Bluetooth e dispositivos**.
3. Toque em **Tela sensível ao toque** (ou **Touch** / **Toque**).
4. Localize **Gestos de borda** (borda esquerda / borda direita).
5. **Desative**:
   - gesto da **borda esquerda** (Task View / tarefas)
   - gesto da **borda direita** (Centro de ações / notificações), se existir
6. Feche as Configurações.
7. **Reinicie o PC** (recomendado) ou faça logoff e entre de novo.

### Atalho para abrir a tela certa

No **Executar** (`Win + R`), cole:

```
ms-settings:devices-touch
```

Ou execute o assistente do repositório (Camada 2), que abre essa tela automaticamente.

### Se não aparecer “Tela sensível ao toque”

- Confirme que o dispositivo é **tablet/touch** (Surface, totem touch etc.).
- Em alguns PCs: **Configurações → Sistema → Multitarefa** — desative atalhos de gestos relacionados a bordas, se houver.
- Atualize o Windows 11 (build **23H2** ou mais recente costuma expor as opções de borda).

---

## Camada 2 — Assistente do Ligeirinho (recomendado)

Na pasta do projeto, dê **duplo clique** em:

```
totem-configurar-pc.bat
```

O assistente:

1. Grava no **registro** (usuário atual) chaves que desativam gestos de borda.
2. Abre **Configurações → Tela sensível ao toque** (complete o passo manual da Camada 1).
3. Cria atalho **“Ligeirinho Totem”** na **Inicialização do Windows** e na **Área de trabalho**.

Depois de concluir: **reinicie o PC**.

### Bloqueio extra (opcional, como Administrador)

Para políticas mais fortes no registro (inclui chaves de máquina):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\totem-windows-lockdown.ps1
```

Ou importe (Admin): `scripts\totem-windows-lockdown.reg`

Reinicie o Explorer ou o PC quando solicitado.

---

## Camada 3 — Sempre iniciar pelo totem-kiosk.bat

**Não** abra o Chrome pelo ícone normal do Windows.

Use sempre:

- Atalho **“Ligeirinho Totem”** (criado pelo assistente), ou
- `totem-kiosk.bat` na raiz do projeto

Isso inicia o Chrome em modo **kiosk** (`--kiosk`), com proteções extras no site (`totem-kiosk-guard.js`).

Se o totem foi configurado com o assistente, ele **abre sozinho** ao ligar o PC.

---

## Como testar se deu certo

1. PC reiniciado após a configuração.
2. Totem aberto pelo atalho **Ligeirinho Totem** (não Chrome comum).
3. Na tela de boas-vindas, **deslize da borda esquerda para a direita** — **não** deve abrir multitarefa.
4. Toque em **botões, produtos, carrinho e teclado** — tudo deve responder normalmente.

---

## Solução de problemas

| Sintoma | O que verificar |
|---------|-----------------|
| Gestos ainda abrem Task View | Configurações: bordas desligadas? Reiniciou o PC? Rodou `totem-configurar-pc.bat`? |
| Totem abre no Chrome normal | Use só o atalho **Ligeirinho Totem** ou `totem-kiosk.bat` |
| Botões nas laterais não clicam | Atualize o site (`git pull`) e **Ctrl+F5** no totem — versão antiga tinha barreiras laterais largas |
| Gestos voltaram após update do Windows | Repita Camada 1 e 2 |

---

## Referência técnica (registro)

Chaves aplicadas pelo assistente / lockdown (usuário atual):

- `HKCU\Software\Microsoft\Wisp\Touch` → `Left_Edgy_Enabled` = 0  
- `HKCU\Software\Microsoft\Wisp\Touch` → `Right_Edgy_Enabled` = 0  
- `HKCU\Software\Microsoft\Windows\CurrentVersion\Touch` → `EnableC2DEdgyGesture` = 0  

---

## Contato / manutenção

Ao trocar de PC ou reinstalar o Windows, repita **Camada 1 + 2** e confirme o atalho na Inicialização.

Impressão silenciosa (sem tela para o cliente) depende também do **mesmo** `totem-kiosk.bat` (`--kiosk-printing`). Ver `totem-kiosk.bat` na raiz do projeto.
