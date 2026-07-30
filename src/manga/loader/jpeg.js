// ---------------------------------------------------------------------------
// MPS private baseline-JPEG-style decoder.
//
// Differs from real JPEG: no markers, no headers - just a quality byte then
// entropy-coded data using the standard Annex K tables.
// ---------------------------------------------------------------------------

import {
    ZIGZAG, STD_LUMA_QUANT, STD_CHROMA_QUANT,
    STD_DC_LUMA_BITS, STD_DC_LUMA_VALS, STD_DC_CHROMA_BITS, STD_DC_CHROMA_VALS,
    STD_AC_LUMA_BITS, STD_AC_LUMA_VALS, STD_AC_CHROMA_BITS, STD_AC_CHROMA_VALS,
} from "./tables.js";
import { clamp, clampU8 } from "./bytes.js";

const BLOCK = 8;
const BLOCK_SIZE = BLOCK * BLOCK;

// --- IDCT ------------------------------------------------------------------

let cosTable = null;

function initCosTable() {
    if (cosTable) return;
    cosTable = Array.from({ length: BLOCK }, (_, x) =>
        Array.from({ length: BLOCK }, (_, u) => Math.cos(((2 * x + 1) * u * Math.PI) / 16))
    );
}

/** Separable 2-D inverse DCT. */
function idct8x8(block) {
    initCosTable();
    const tmp = new Float64Array(BLOCK_SIZE);
    const out = new Float64Array(BLOCK_SIZE);

    for (let y = 0; y < BLOCK; y++) {
        for (let x = 0; x < BLOCK; x++) {
            let sum = 0;
            for (let u = 0; u < BLOCK; u++) {
                const cu = u === 0 ? 1 / Math.SQRT2 : 1;
                sum += cu * block[y * BLOCK + u] * cosTable[x][u];
            }
            tmp[y * BLOCK + x] = 0.5 * sum;
        }
    }

    for (let x = 0; x < BLOCK; x++) {
        for (let y = 0; y < BLOCK; y++) {
            let sum = 0;
            for (let v = 0; v < BLOCK; v++) {
                const cv = v === 0 ? 1 / Math.SQRT2 : 1;
                sum += cv * tmp[v * BLOCK + x] * cosTable[y][v];
            }
            out[y * BLOCK + x] = 0.5 * sum;
        }
    }
    return out;
}

// --- tables ----------------------------------------------------------------

/** Scale a base quant table by quality, in zigzag order. */
function buildQuantTable(base, quality) {
    const q = clamp(quality | 0, 1, 100);
    const scale = q < 50 ? Math.floor(5000 / q) : 200 - q * 2;

    const out = new Int32Array(BLOCK_SIZE);
    for (let i = 0; i < BLOCK_SIZE; i++) {
        out[i] = clamp(Math.floor((base[ZIGZAG[i]] * scale + 50) / 100), 1, 255);
    }
    return out;
}

function buildHuffTable(bits, vals) {
    const table = {
        mincode: new Int32Array(17),
        maxcode: new Int32Array(17).fill(-1),
        valptr: new Int32Array(17),
        vals,
    };

    let code = 0;
    let k = 0;
    for (let length = 1; length <= 16; length++) {
        if (bits[length] === 0) {
            code <<= 1;
            continue;
        }
        table.valptr[length] = k;
        table.mincode[length] = code;
        code += bits[length];
        k += bits[length];
        table.maxcode[length] = code - 1;
        code <<= 1;
    }
    return table;
}

// --- bit reader --------------------------------------------------------------

class BitReader {
    constructor(data, pos = 0) {
        this.data = data;
        this.pos = pos;
        this.buffer = 0;
        this.count = 0;
    }

    getBit() {
        if (this.count === 0) {
            this.buffer = this.pos < this.data.length ? this.data[this.pos++] : 0;
            this.count = 8;
        }
        this.count--;
        return (this.buffer >> this.count) & 1;
    }

    receiveBits(length) {
        let value = 0;
        for (let i = 0; i < length; i++) value = (value << 1) | this.getBit();
        return value;
    }
}

function huffDecode(reader, table) {
    let code = 0;
    for (let length = 1; length <= 16; length++) {
        code = (code << 1) | reader.getBit();
        if (table.maxcode[length] !== -1
            && code <= table.maxcode[length]
            && code >= table.mincode[length]) {
            return table.vals[table.valptr[length] + (code - table.mincode[length])];
        }
    }
    return -1;
}

/** Sign-extend a `length`-bit magnitude, per JPEG's EXTEND. */
const extend = (value, length) =>
    length === 0 ? 0 : value < 1 << (length - 1) ? value - (1 << length) + 1 : value;

// --- decoder -----------------------------------------------------------------

/** Decode one entropy-coded 8x8 block into spatial samples. */
function decodeBlock(reader, dcTable, acTable, quant, predictor) {
    const coefficients = new Int32Array(BLOCK_SIZE);

    const dcLength = huffDecode(reader, dcTable);
    if (dcLength < 0) throw new Error("bad DC huffman code");
    const diff = dcLength === 0 ? 0 : extend(reader.receiveBits(dcLength), dcLength);

    const dc = predictor + diff;
    coefficients[0] = dc;

    let k = 1;
    while (k < BLOCK_SIZE) {
        const rs = huffDecode(reader, acTable);
        if (rs < 0) throw new Error("bad AC huffman code");

        const run = rs >> 4;
        const size = rs & 15;

        if (size === 0) {
            if (run === 15) {
                k += 16; // ZRL: sixteen zeroes
                continue;
            }
            break; // EOB
        }

        k += run;
        if (k >= BLOCK_SIZE) break;
        coefficients[k] = extend(reader.receiveBits(size), size);
        k++;
    }

    const block = new Float64Array(BLOCK_SIZE);
    for (let i = 0; i < BLOCK_SIZE; i++) {
        block[ZIGZAG[i]] = coefficients[i] * quant[i];
    }

    return { pixels: idct8x8(block), dc };
}

function yCbCrToRgb(y, cb, cr) {
    return [
        y + 1.402 * cr,
        y - 0.344136 * cb - 0.714136 * cr,
        y + 1.772 * cb,
    ];
}

/**
 * @param {Uint8Array} data  quality byte followed by entropy-coded data
 * @returns {{rgb: Uint8Array, consumed: number}}
 */
export function decodeMpsPrivateJpeg(data, isGray, width, height) {
    if (width <= 0 || height <= 0 || data.length < 1) {
        throw new Error("bad image dimensions/data");
    }

    const componentCount = isGray ? 1 : 3;
    const quality = data[0];

    const quant = [
        buildQuantTable(STD_LUMA_QUANT, quality),
        isGray ? null : buildQuantTable(STD_CHROMA_QUANT, quality),
    ];
    const dcTables = [
        buildHuffTable(STD_DC_LUMA_BITS, STD_DC_LUMA_VALS),
        isGray ? null : buildHuffTable(STD_DC_CHROMA_BITS, STD_DC_CHROMA_VALS),
    ];
    const acTables = [
        buildHuffTable(STD_AC_LUMA_BITS, STD_AC_LUMA_VALS),
        isGray ? null : buildHuffTable(STD_AC_CHROMA_BITS, STD_AC_CHROMA_VALS),
    ];

    const blocksX = Math.ceil(width / BLOCK);
    const blocksY = Math.ceil(height / BLOCK);
    const planeWidth = blocksX * BLOCK;
    const planes = Array.from(
        { length: componentCount },
        () => new Float64Array(planeWidth * blocksY * BLOCK)
    );

    const predictors = new Int32Array(3);
    const reader = new BitReader(data, 1);

    for (let by = 0; by < blocksY; by++) {
        for (let bx = 0; bx < blocksX; bx++) {
            for (let c = 0; c < componentCount; c++) {
                const tableIdx = c === 0 ? 0 : 1;
                const { pixels, dc } = decodeBlock(
                    reader, dcTables[tableIdx], acTables[tableIdx],
                    quant[tableIdx], predictors[c]
                );
                predictors[c] = dc;

                for (let y = 0; y < BLOCK; y++) {
                    const row = (by * BLOCK + y) * planeWidth + bx * BLOCK;
                    for (let x = 0; x < BLOCK; x++) {
                        planes[c][row + x] = clamp(pixels[y * BLOCK + x] + 128, 0, 255);
                    }
                }
            }
        }
    }

    const rgb = new Uint8Array(width * height * 3);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = y * planeWidth + x;
            const luma = planes[0][index];
            const [r, g, b] = isGray
                ? [luma, luma, luma]
                : yCbCrToRgb(luma, planes[1][index] - 128, planes[2][index] - 128);

            const out = (y * width + x) * 3;
            rgb[out] = clampU8(r);
            rgb[out + 1] = clampU8(g);
            rgb[out + 2] = clampU8(b);
        }
    }

    return { rgb, consumed: reader.pos };
}
