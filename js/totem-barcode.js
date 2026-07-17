(function () {
    const TOTEM_CODE_HEX_LENGTH = 4;

    /** Payload do leitor PDV (Code 128): PED + 4 hex, sem espaço — ex.: PED4F4F */
    const scannerTotemCode = (orderId) => {
        const hex = String(orderId || '')
            .replace(/[^a-fA-F0-9]/gi, '')
            .slice(0, TOTEM_CODE_HEX_LENGTH)
            .toUpperCase();
        return hex ? `PED${hex}` : '';
    };

  /** Padrões Code 128 (ISO/IEC 15417) — índices 0–106. */
    const CODE128 = [
        '11011001100', '11001101100', '11001100110', '10010011000', '10010001100',
        '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
        '11001000100', '11000100100', '10110011100', '10011011100', '10011001110',
        '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
        '11001001110', '11011100100', '11001110100', '11101101110', '11101001100',
        '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
        '11011011000', '11011000110', '11000110110', '10100011000', '10001011000',
        '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
        '11000101000', '11000100010', '10110111000', '10110001110', '10001101110',
        '10111011000', '10111000110', '10001110110', '11101110110', '11010001110',
        '11000101110', '11011101000', '11011100010', '11011101110', '11101011000',
        '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
        '11101111010', '11001000010', '11110001010', '10100110000', '10100001100',
        '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
        '10110000100', '10011010000', '10011000010', '10000110100', '10000110010',
        '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
        '10100111100', '10010111100', '10010011110', '10111100100', '10011110100',
        '10011110010', '11110100100', '11110010100', '11110010010', '11011011110',
        '11011110110', '11110110110', '10101111000', '10100011110', '10001011110',
        '10111101000', '10111100010', '11110101000', '11110100010', '10111011110',
        '10111101110', '11101011110', '11110101110', '11010000100', '11010010000',
        '11010011100', '1100011101011',
    ];

    const START_B = 104;
    const STOP = 106;

    const encodeCode128B = (text) => {
        const payload = String(text || '');
        const codes = [START_B];
        for (let i = 0; i < payload.length; i += 1) {
            const code = payload.charCodeAt(i);
            if (code < 32 || code > 126) {
                throw new Error('Caractere inválido para Code 128');
            }
            codes.push(code - 32);
        }
        let checksum = codes[0];
        for (let i = 1; i < codes.length; i += 1) {
            checksum += codes[i] * i;
        }
        codes.push(checksum % 103);
        codes.push(STOP);
        return codes;
    };

    const code128Svg = (text, opts = {}) => {
        const height = Number(opts.height) || 44;
        const barWidth = Number(opts.barWidth) || 1.35;
        const codes = encodeCode128B(text);
        let bits = '';
        codes.forEach((code) => {
            bits += CODE128[code] || '';
        });

        let x = 0;
        const rects = [];
        for (let i = 0; i < bits.length; i += 1) {
            if (bits[i] === '1') {
                rects.push(
                    `<rect x="${x.toFixed(2)}" y="0" width="${barWidth}" height="${height}" fill="#000"/>`
                );
            }
            x += barWidth;
        }

        const width = x;
        const label = String(text).replace(/"/g, '&quot;');
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(2)} ${height}" width="100%" height="${height}" role="img" aria-label="${label}">${rects.join('')}</svg>`;
    };

    const appendEscPosCode128 = (out, text, opts = {}) => {
        const data = '{B' + String(text || '');
        const GS = '\x1D';
        const height = Number(opts.height) || 110;
        const width = Number(opts.moduleWidth) || 3;
        const hri = opts.hri === false ? 0 : 2;
        out += GS + 'h' + String.fromCharCode(Math.min(255, Math.max(1, height)));
        out += GS + 'w' + String.fromCharCode(Math.min(6, Math.max(1, width)));
        out += GS + 'H' + String.fromCharCode(hri);
        out += GS + 'k' + '\x49' + String.fromCharCode(data.length) + data;
        return out;
    };

    window.LigeirinhoTotemBarcode = {
        scannerTotemCode,
        code128Svg,
        appendEscPosCode128,
        encodeCode128B,
    };
})();
