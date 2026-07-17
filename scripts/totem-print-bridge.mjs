/**
 * Ponte de impressão silenciosa para o totem no PC do depósito.
 *
 * USB no mesmo PC (Windows) — ex.: Elgin i9 (80mm, ESC/POS):
 *   set TOTEM_PRINTER_NAME=ELGIN i9
 *   npm run totem:print-bridge
 *
 * Elgin i9 Ethernet (porta RAW 9100):
 *   set TOTEM_BRIDGE_HOST=0.0.0.0
 *   set TOTEM_PRINTER_HOST=192.168.0.50
 *   npm run totem:print-bridge
 *
 * No tablet (Fully Kiosk), aponte printBridgeUrl para o IP do PC/RPi na mesma Wi‑Fi:
 *   http://192.168.0.10:8787/print
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import http from 'node:http';
import net from 'node:net';
import WebSocket from 'ws';
import { buildEscPosReceipt } from './lib/totem-escpos.mjs';

const execFileAsync = promisify(execFile);

const LISTEN_HOST =
    process.env.TOTEM_BRIDGE_HOST ||
    (String(process.env.TOTEM_PRINTER_HOST || '').trim() ? '0.0.0.0' : '127.0.0.1');
const LISTEN_PORT = Number(process.env.TOTEM_BRIDGE_PORT) || 8787;
const PRINTER_NAME = String(process.env.TOTEM_PRINTER_NAME || '').trim();
const PRINTER_HOST = String(process.env.TOTEM_PRINTER_HOST || '').trim();
const PRINTER_PORT = Number(process.env.TOTEM_PRINTER_PORT) || 9100;
const CHROME_DEBUG_URL = String(
    process.env.TOTEM_CHROME_DEBUG_URL || 'http://127.0.0.1:9222'
).replace(/\/$/, '');
const PRINT_PAGE_URL = String(
    process.env.TOTEM_PRINT_PAGE_URL || 'https://ligeirinhoparceiros.vercel.app/totem-print.html'
).trim();
const PREFER_CHROME_RENDERER =
    String(process.env.TOTEM_BRIDGE_RENDERER || 'chrome').toLowerCase() === 'chrome';
// Fallback ESC/POS ligado por padrao: tablet nunca fica sem cupom se o Chrome falhar.
const ALLOW_ESCPOS_FALLBACK = !['0', 'false', 'off', 'no'].includes(
    String(process.env.TOTEM_BRIDGE_ESCPOS_FALLBACK ?? '1').trim().toLowerCase()
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const chromeTargets = async () => {
    const response = await fetch(`${CHROME_DEBUG_URL}/json/list`, {
        signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) throw new Error(`Chrome DevTools HTTP ${response.status}`);
    return response.json();
};

const chromeDebugReady = async () => {
    try {
        const response = await fetch(`${CHROME_DEBUG_URL}/json/version`, {
            signal: AbortSignal.timeout(1500),
        });
        return response.ok;
    } catch {
        return false;
    }
};

const evaluateInChrome = (webSocketDebuggerUrl, expression) =>
    new Promise((resolve, reject) => {
        const socket = new WebSocket(webSocketDebuggerUrl);
        let id = 0;
        const pending = new Map();
        const timer = setTimeout(() => {
            socket.close();
            reject(new Error('Timeout ao imprimir pelo Chrome do Totem.'));
        }, 20000);

        const send = (method, params = {}) =>
            new Promise((res, rej) => {
                id += 1;
                pending.set(id, { res, rej });
                socket.send(JSON.stringify({ id, method, params }));
            });

        socket.addEventListener('open', async () => {
            try {
                await send('Runtime.enable');
                await send('Page.enable');
                const result = await send('Runtime.evaluate', {
                    expression,
                    awaitPromise: true,
                    returnByValue: true,
                    userGesture: true,
                });
                clearTimeout(timer);
                socket.close();
                if (result?.exceptionDetails) {
                    reject(
                        new Error(
                            result.exceptionDetails?.exception?.description ||
                                result.exceptionDetails?.text ||
                                'Falha ao imprimir no Chrome.'
                        )
                    );
                    return;
                }
                resolve(result?.result?.value);
            } catch (err) {
                clearTimeout(timer);
                socket.close();
                reject(err);
            }
        });
        socket.addEventListener('message', (event) => {
            const message = JSON.parse(String(event.data || '{}'));
            if (!message.id || !pending.has(message.id)) return;
            const { res, rej } = pending.get(message.id);
            pending.delete(message.id);
            if (message.error) rej(new Error(message.error.message || 'Erro CDP'));
            else res(message.result);
        });
        socket.addEventListener('error', () => {
            clearTimeout(timer);
            reject(new Error('Não foi possível conectar ao Chrome do Totem (porta 9222).'));
        });
    });

const pickPrintTarget = (targets) => {
    const pages = (targets || []).filter(
        (item) => item.type === 'page' && item.webSocketDebuggerUrl
    );
    return (
        pages.find((item) => /totem-print\.html/i.test(String(item.url || ''))) ||
        pages.find((item) => /\/totem(?:[-.]html|$)/i.test(String(item.url || ''))) ||
        pages.find((item) => /ligeirinhoparceiros\.vercel\.app/i.test(String(item.url || ''))) ||
        null
    );
};

const openPrintPage = async () => {
    // Chrome espera a URL crua no query: PUT /json/new?https://...
    const response = await fetch(`${CHROME_DEBUG_URL}/json/new?${PRINT_PAGE_URL}`, {
        method: 'PUT',
        signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error(`Falha ao abrir aba de impressao (${response.status}).`);
    return response.json();
};

const closeChromeTab = async (targetId) => {
    if (!targetId) return;
    try {
        await fetch(`${CHROME_DEBUG_URL}/json/close/${encodeURIComponent(targetId)}`, {
            method: 'GET',
            signal: AbortSignal.timeout(2000),
        });
    } catch {
        /* ignore */
    }
};

const waitForPrintTarget = async (preferredId = '') => {
    for (let i = 0; i < 20; i += 1) {
        const targets = await chromeTargets();
        const byId = preferredId
            ? targets.find((item) => item.id === preferredId && item.webSocketDebuggerUrl)
            : null;
        const target = byId || pickPrintTarget(targets);
        if (target?.webSocketDebuggerUrl) return target;
        await sleep(250);
    }
    throw new Error('Aba de impressao nao ficou pronta no Chrome.');
};

const printViaTotemChrome = async (order, opts = {}) => {
    if (!(await chromeDebugReady())) {
        throw new Error(
            'Chrome sem remote debugging na porta 9222. Feche o Chrome e abra pelo totem-kiosk.bat.'
        );
    }

    let openedId = '';
    try {
        const opened = await openPrintPage();
        openedId = String(opened?.id || '');
    } catch (err) {
        console.warn('[totem-print-bridge] json/new falhou, tentando aba existente:', err.message);
    }

    const target = await waitForPrintTarget(openedId);
    const orderJson = JSON.stringify(order).replace(/</g, '\\u003c');
    const optsJson = JSON.stringify({
        totemLabel: opts.totemLabel,
        printMarginLeftMm: opts.printMarginLeftMm,
        printMarginRightMm: opts.printMarginRightMm,
        printPaperWidthMm: opts.printPaperWidthMm,
    }).replace(/</g, '\\u003c');

    const expression = `(async () => {
        const started = Date.now();
        while (!window.ligeirinhoBridgePrint && Date.now() - started < 8000) {
            await new Promise((r) => setTimeout(r, 100));
        }
        if (typeof window.ligeirinhoBridgePrint === 'function') {
            return window.ligeirinhoBridgePrint(${orderJson}, ${optsJson});
        }
        const receipt = window.LigeirinhoTotemReceipt;
        if (!receipt?.printViaKiosk) throw new Error('Renderizador do comprovante nao carregado.');
        return receipt.printViaKiosk(${orderJson}, ${optsJson});
    })()`;

    try {
        const printed = await evaluateInChrome(target.webSocketDebuggerUrl, expression);
        if (printed !== true) throw new Error('O Chrome nao confirmou a impressao.');
    } finally {
        if (openedId) await closeChromeTab(openedId);
    }
};

const sendToNetworkPrinter = (data, host, port) =>
    new Promise((resolve, reject) => {
        const targetHost = String(host || PRINTER_HOST || '').trim();
        const targetPort = Number(port) || PRINTER_PORT;
        if (!targetHost) {
            reject(new Error('Impressora de rede não configurada.'));
            return;
        }
        const socket = net.createConnection({ host: targetHost, port: targetPort }, () => {
            socket.write(data, (err) => {
                socket.end();
                if (err) reject(err);
                else resolve();
            });
        });
        socket.setTimeout(8000, () => {
            socket.destroy();
            reject(new Error('Timeout ao conectar na impressora.'));
        });
        socket.on('error', reject);
    });

const sendToWindowsPrinter = async (data) => {
    const printer = PRINTER_NAME.replace(/'/g, "''");
    const base64 = data.toString('base64');
    const ps = `
$ErrorActionPreference = 'Stop'
$printer = '${printer}'
$bytes = [Convert]::FromBase64String('${base64}')
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class LigeirinhoRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFOA di);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
  public static bool Send(string name, byte[] payload) {
    IntPtr h;
    if (!OpenPrinter(name, out h, IntPtr.Zero)) return false;
    var di = new DOCINFOA { pDocName = "Ligeirinho Totem", pDataType = "RAW" };
    if (!StartDocPrinter(h, 1, di)) { ClosePrinter(h); return false; }
    StartPagePrinter(h);
    IntPtr p = Marshal.AllocCoTaskMem(payload.Length);
    Marshal.Copy(payload, 0, p, payload.Length);
    int written;
    WritePrinter(h, p, payload.Length, out written);
    Marshal.FreeCoTaskMem(p);
    EndPagePrinter(h);
    EndDocPrinter(h);
    ClosePrinter(h);
    return true;
  }
}
'@
if (-not [LigeirinhoRawPrinter]::Send($printer, $bytes)) {
  throw 'Falha ao enviar para a impressora Windows. Confira TOTEM_PRINTER_NAME.'
}
`;

    await execFileAsync(
        'powershell',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps],
        { maxBuffer: 10 * 1024 * 1024, windowsHide: true }
    );
};

const sendToPrinter = async (data, { printerHost, printerPort } = {}) => {
    const host = String(printerHost || PRINTER_HOST || '').trim();
    if (host) {
        await sendToNetworkPrinter(data, host, printerPort);
        return;
    }
    if (PRINTER_NAME) {
        if (process.platform !== 'win32') {
            throw new Error('TOTEM_PRINTER_NAME só funciona no Windows.');
        }
        await sendToWindowsPrinter(data);
        return;
    }
    throw new Error('Defina TOTEM_PRINTER_NAME (USB) ou TOTEM_PRINTER_HOST (rede).');
};

const readBody = (req) =>
    new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
            } catch (err) {
                reject(err);
            }
        });
        req.on('error', reject);
    });

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'GET' && req.url === '/health') {
        const chromeReady = PREFER_CHROME_RENDERER ? await chromeDebugReady() : false;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
            JSON.stringify({
                ok: true,
                printerName: PRINTER_NAME || null,
                printerHost: PRINTER_HOST || null,
                renderer: PREFER_CHROME_RENDERER ? 'chrome-html' : 'escpos',
                chromeDebugUrl: CHROME_DEBUG_URL,
                chromeReady,
                printPageUrl: PRINT_PAGE_URL,
                escposFallback: ALLOW_ESCPOS_FALLBACK,
            })
        );
        return;
    }

    if (req.method !== 'POST' || req.url !== '/print') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Use POST /print' }));
        return;
    }

    try {
        const body = await readBody(req);
        const order = body.order;
        if (!order?.id) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Pedido inválido' }));
            return;
        }

        let renderer = 'chrome-html';
        try {
            if (!PREFER_CHROME_RENDERER) throw new Error('Renderizador Chrome desativado.');
            await printViaTotemChrome(order, body);
        } catch (chromeError) {
            if (!ALLOW_ESCPOS_FALLBACK) throw chromeError;
            renderer = 'escpos-fallback';
            console.warn(
                '[totem-print-bridge] Chrome indisponível; usando ESC/POS:',
                chromeError.message || chromeError
            );
            const data = buildEscPosReceipt(order, {
                totemLabel: body.totemLabel,
                escposLineChars: body.escposLineChars,
            });
            await sendToPrinter(data, {
                printerHost: body.printerHost,
                printerPort: body.printerPort,
            });
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, renderer }));
    } catch (err) {
        console.error('[totem-print-bridge]', err.message || err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Erro ao imprimir' }));
    }
});

server.on('error', (err) => {
    if (err?.code === 'EADDRINUSE') {
        console.error(`[totem-print-bridge] Porta ${LISTEN_PORT} ja em uso — ponte provavelmente ja esta rodando.`);
        process.exit(0);
    }
    console.error('[totem-print-bridge]', err.message || err);
    process.exit(1);
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
    console.log(`[totem-print-bridge] http://${LISTEN_HOST}:${LISTEN_PORT}/print`);
    console.log(`[totem-print-bridge] renderer=chrome-html fallbackEscPos=${ALLOW_ESCPOS_FALLBACK}`);
    console.log(`[totem-print-bridge] chrome debug=${CHROME_DEBUG_URL}`);
    if (PRINTER_NAME) {
        console.log(`[totem-print-bridge] Windows RAW: ${PRINTER_NAME}`);
    } else if (PRINTER_HOST) {
        console.log(`[totem-print-bridge] rede ${PRINTER_HOST}:${PRINTER_PORT}`);
    } else {
        console.warn(
            '[totem-print-bridge] Sem TOTEM_PRINTER_HOST/NAME — use printerHost no POST (Tablets) ou defina a env.'
        );
    }
});
