// ---------------------------------------------------------------------------
// Byte-level helpers shared by the parsers.
// ---------------------------------------------------------------------------

export const clamp = (value, lo, hi) => (value < lo ? lo : value > hi ? hi : value);
export const clampU8 = (value) => clamp(Math.floor(value + 0.5), 0, 255);

/** Is a read of `length` bytes at `pos` inside a buffer of `size`? */
export const canRead = (pos, length, size) => pos <= size && length <= size - pos;

export const readU32LE = (u8, p) =>
    (u8[p] | (u8[p + 1] << 8) | (u8[p + 2] << 16) | (u8[p + 3] << 24)) >>> 0;

export function readU64LEAsNumber(u8, p) {
    const value = readU32LE(u8, p + 4) * 4294967296 + readU32LE(u8, p);
    if (!Number.isSafeInteger(value)) throw new Error("MPS chunk trailer is too large");
    return value;
}

export const decodeUtf8 = (u8) => new TextDecoder().decode(u8);

export function asciiBytes(text) {
    const out = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 255;
    return out;
}

export function bytesEqualString(u8, pos, text) {
    if (!canRead(pos, text.length, u8.length)) return false;
    for (let i = 0; i < text.length; i++) {
        if (u8[pos + i] !== (text.charCodeAt(i) & 255)) return false;
    }
    return true;
}

export function base64ToBytes(text) {
    const binary = atob(String(text || ""));
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i) & 255;
    return out;
}

export function concatArrays(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    for (const part of parts) {
        out.set(part, pos);
        pos += part.length;
    }
    return out;
}

/** First 32 bytes as hex + ASCII - the single most useful debugging line. */
export function sniffBytes(buffer) {
    const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const count = Math.min(u8.length, 32);
    const hex = [];
    const text = [];

    for (let i = 0; i < count; i++) {
        hex.push(u8[i].toString(16).padStart(2, "0"));
        text.push(u8[i] >= 32 && u8[i] <= 126 ? String.fromCharCode(u8[i]) : ".");
    }
    return `${hex.join(" ")} | ${text.join("")}`;
}

export function whiteRgb(width, height) {
    const rgb = new Uint8Array(width * height * 3);
    rgb.fill(255);
    return rgb;
}
