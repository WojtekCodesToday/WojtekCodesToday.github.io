// ---------------------------------------------------------------------------
// MPS container parsing (+ the legacy .bin format).
// ---------------------------------------------------------------------------

import {
    canRead, readU32LE, readU64LEAsNumber, decodeUtf8, bytesEqualString,
    base64ToBytes, sniffBytes, whiteRgb,
} from "./bytes.js";
import { decodeMpsPrivateJpeg } from "./jpeg.js";
import { rgbToPngBlob } from "./png.js";

export const MPS_VERSION = 9;

const KIND_SOLID = 0;
const KIND_JPEG_GRAY = 1;
const KIND_JPEG_RGB = 2;

const PY_CHUNK_HEADER = "MPSPYCH1";
const PY_CHUNK_FOOTER = "MPSPYEND";

// Reader chunk types (renderer.js): URL = 2, NOTE = 3.
const READER_URL = 2;
const READER_NOTE = 3;

/** "MPS" followed by an ASCII digit. */
export const isMpsMagic = (u8) =>
    u8.length >= 5
    && u8[0] === 0x4d && u8[1] === 0x50 && u8[2] === 0x53
    && u8[3] >= 0x30 && u8[3] <= 0x39;

// --- python chunk trailer ----------------------------------------------------

/** libmps trailer types (URL = 0, NOTE = 1) -> reader types. */
function toReaderType(type) {
    if (type === 0 || type === READER_URL) return READER_URL;
    if (type === 1 || type === READER_NOTE) return READER_NOTE;
    return -1;
}

function normalizeTrailerChunk(item) {
    if (!Array.isArray(item) || item.length !== 6) return null;

    const type = toReaderType(Number(item[0]));
    if (type < 0) return null;

    let text;
    try {
        text = decodeUtf8(base64ToBytes(item[5])).replace(/\0+$/, "");
    } catch {
        text = String(item[5] ?? "");
    }

    return [
        type,
        Math.max(0, Number(item[1]) || 0),
        Math.max(0, Number(item[2]) || 0),
        Math.max(1, Number(item[3]) || 1),
        Math.max(1, Number(item[4]) || 1),
        text,
    ];
}

/**
 * Optional trailer appended by the Python writer holding URL/note overlays.
 * Layout: HEADER | deflated JSON | u64 length | FOOTER
 */
function parsePythonChunkTrailer(u8, expectedPages) {
    const tailSize = 8 + PY_CHUNK_FOOTER.length;
    if (u8.length < PY_CHUNK_HEADER.length + tailSize) return null;

    const lengthPos = u8.length - tailSize;
    if (!bytesEqualString(u8, lengthPos + 8, PY_CHUNK_FOOTER)) return null;

    const payloadLength = readU64LEAsNumber(u8, lengthPos);
    const start = lengthPos - payloadLength - PY_CHUNK_HEADER.length;
    if (start < 0) throw new Error("invalid libmps chunk trailer length");
    if (!bytesEqualString(u8, start, PY_CHUNK_HEADER)) {
        throw new Error("invalid libmps chunk trailer header");
    }

    const payload = u8.subarray(
        start + PY_CHUNK_HEADER.length,
        start + PY_CHUNK_HEADER.length + payloadLength
    );

    let decoded;
    try {
        decoded = JSON.parse(decodeUtf8(self.pako.inflate(payload)));
    } catch (err) {
        throw new Error(`invalid libmps chunk trailer: ${err?.message ?? err}`);
    }

    if (decoded?.version !== 1 || !Array.isArray(decoded.pages)) {
        throw new Error("invalid libmps chunk trailer JSON");
    }
    if (decoded.pages.length !== expectedPages) {
        throw new Error("chunk trailer page count does not match MPS page count");
    }

    let total = 0;
    const pages = decoded.pages.map((rawChunks) => {
        if (!Array.isArray(rawChunks)) return [];
        const chunks = rawChunks.map(normalizeTrailerChunk).filter(Boolean);
        total += chunks.length;
        return chunks;
    });

    return { start, payloadLength, pages, total };
}

// --- page bodies ---------------------------------------------------------------

function readSolidPage(b, pos, width, height, size) {
    if (!canRead(pos, 3, size)) throw new Error("Truncated solid color");

    const [r, g, blue] = [b[pos], b[pos + 1], b[pos + 2]];
    const rgb = new Uint8Array(width * height * 3);
    for (let i = 0; i < rgb.length; i += 3) {
        rgb[i] = r;
        rgb[i + 1] = g;
        rgb[i + 2] = blue;
    }
    return { rgb, pos: pos + 3 };
}

function readJpegPage(b, pos, width, height, size, isGray, pageIndex) {
    if (!canRead(pos, 4, size)) throw new Error("Truncated image length");
    const length = readU32LE(b, pos);
    pos += 4;
    if (!canRead(pos, length, size)) throw new Error("Truncated image payload");

    let rgb;
    try {
        rgb = decodeMpsPrivateJpeg(b.subarray(pos, pos + length), isGray, width, height).rgb;
    } catch (err) {
        console.warn(`MPS image decode failed on page ${pageIndex}, using white page.`, err);
        rgb = whiteRgb(width, height);
    }
    return { rgb, pos: pos + length };
}

// --- container -------------------------------------------------------------------

export function parseMpsFile(buffer) {
    const b = new Uint8Array(buffer);
    const size = b.length;

    if (!canRead(0, 6, size) || !isMpsMagic(b)) {
        throw new Error(`Invalid MPS file. Header: ${sniffBytes(b)}`);
    }

    const magic = String.fromCharCode(b[0], b[1], b[2], b[3]);
    if (b[4] !== MPS_VERSION) {
        console.warn(
            `MPS version mismatch (${magic}): expected ${MPS_VERSION}, got ${b[4]}. Continuing.`
        );
    }

    let pos = 5;
    const ptype = b[pos++];

    if (!canRead(pos, 4, size)) throw new Error("Truncated title length");
    const titleLength = readU32LE(b, pos);
    pos += 4;

    let title = "";
    if (titleLength > 0) {
        if (!canRead(pos, titleLength, size)) throw new Error("Truncated title");
        title = decodeUtf8(b.subarray(pos, pos + titleLength));
        pos += titleLength;
    }

    if (!canRead(pos, 4, size)) throw new Error("Truncated page count");
    const pageCount = readU32LE(b, pos);
    pos += 4;

    const pages = [];
    const blobs = [];

    for (let i = 0; i < pageCount; i++) {
        if (!canRead(pos, 9, size)) throw new Error(`Truncated page header at page ${i}`);

        const width = readU32LE(b, pos);
        pos += 4;
        const height = readU32LE(b, pos);
        pos += 4;
        const kind = b[pos++];

        let result;
        if (kind === KIND_SOLID) {
            result = readSolidPage(b, pos, width, height, size);
        } else if (kind === KIND_JPEG_GRAY || kind === KIND_JPEG_RGB) {
            result = readJpegPage(b, pos, width, height, size, kind === KIND_JPEG_GRAY, i);
        } else {
            throw new Error(`Unknown MPS page kind ${kind} at page ${i}`);
        }
        pos = result.pos;

        blobs.push(rgbToPngBlob(result.rgb, width, height));
        pages.push({
            w: width,
            h: height,
            atlasIdx: i,
            // -1 in the channel slot means "draw the raw full page".
            chunks: [[1, 0, 0, width, height, 0, 0, -1]],
        });
    }

    const trailer = parsePythonChunkTrailer(b, pageCount);
    if (trailer) {
        trailer.pages.forEach((chunks, i) => pages[i].chunks.push(...chunks));
        console.log(
            `Loaded libmps trailer: ${trailer.total} chunks, ${trailer.payloadLength} bytes`
        );
    }

    return { data: { title, ptype, p: pages }, blobs };
}

/** Older format: deflated JSON header, then a run of length-prefixed WebP blobs. */
export function parseLegacyBin(buffer) {
    if (!self.pako?.inflate) throw new Error("pako is required for legacy bin format");
    if (buffer.byteLength < 8) {
        throw new Error(`File too small for legacy bin. Header: ${sniffBytes(buffer)}`);
    }

    const view = new DataView(buffer);
    let pos = 0;

    const jsonLength = view.getUint32(pos, false);
    pos += 4;
    if (jsonLength <= 0 || jsonLength > buffer.byteLength - pos) {
        throw new Error(
            `Not MPS and not legacy bin. jsonLen=${jsonLength}, `
            + `fileSize=${buffer.byteLength}, header=${sniffBytes(buffer)}`
        );
    }

    const data = JSON.parse(
        decodeUtf8(self.pako.inflate(new Uint8Array(buffer, pos, jsonLength)))
    );
    pos += jsonLength;

    if (pos + 4 > buffer.byteLength) throw new Error("Legacy bin truncated before blob count");
    const blobCount = view.getUint32(pos, false);
    pos += 4;

    const blobs = [];
    for (let i = 0; i < blobCount; i++) {
        if (pos + 4 > buffer.byteLength) {
            throw new Error(`Legacy bin truncated before blob size ${i}`);
        }
        const length = view.getUint32(pos, false);
        pos += 4;
        if (pos + length > buffer.byteLength) throw new Error(`Legacy bin truncated at blob ${i}`);

        blobs.push(new Blob([new Uint8Array(buffer, pos, length)], { type: "image/webp" }));
        pos += length;
    }

    if (data.p) {
        data.p = data.p.map(([w, h, atlasIdx, chunks]) => ({ w, h, atlasIdx, chunks }));
    }

    return { data, blobs };
}
