// ---------------------------------------------------------------------------
// Minimal PNG encoder - the decoder produces raw RGB, canvas wants an image.
// ---------------------------------------------------------------------------

import { asciiBytes, concatArrays } from "./bytes.js";

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const COLOR_TYPE_RGB = 2;
const BIT_DEPTH = 8;

let crcTable = null;

function buildCrcTable() {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        }
        crcTable[n] = c >>> 0;
    }
}

function crc32(bytes) {
    if (!crcTable) buildCrcTable();
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
        c = crcTable[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
}

const u32be = (value) =>
    new Uint8Array([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]);

function chunk(type, payload) {
    const typeBytes = asciiBytes(type);
    return concatArrays([
        u32be(payload.length),
        typeBytes,
        payload,
        u32be(crc32(concatArrays([typeBytes, payload]))),
    ]);
}

/** Encode raw RGB as a PNG Blob. Requires pako for deflate. */
export function rgbToPngBlob(rgb, width, height) {
    if (!self.pako?.deflate) throw new Error("pako is required for PNG output");

    // Each scanline is prefixed with its filter type (0 = None).
    const stride = width * 3;
    const raw = new Uint8Array(height * (1 + stride));
    for (let y = 0; y < height; y++) {
        const target = y * (1 + stride);
        raw[target] = 0;
        raw.set(rgb.subarray(y * stride, y * stride + stride), target + 1);
    }

    const ihdr = concatArrays([
        u32be(width),
        u32be(height),
        new Uint8Array([BIT_DEPTH, COLOR_TYPE_RGB, 0, 0, 0]),
    ]);

    const png = concatArrays([
        new Uint8Array(PNG_SIGNATURE),
        chunk("IHDR", ihdr),
        chunk("IDAT", self.pako.deflate(raw)),
        chunk("IEND", new Uint8Array(0)),
    ]);

    return new Blob([png], { type: "image/png" });
}
