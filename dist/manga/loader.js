try {
  importScripts("https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js");
} catch (_) {}
var MPS_VERSION = 9;
var MPS_KIND_SOLID = 0;
var MPS_KIND_JPEG_GRAY = 1;
var MPS_KIND_JPEG_RGB = 2;
var PY_CHUNK_HEADER = "MPSPYCH1";
var PY_CHUNK_FOOTER = "MPSPYEND";
var zigzag = [0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63];
var std_luma_natural = [16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99];
var std_chroma_natural = [17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99, 24, 26, 56, 99, 99, 99, 99, 99, 47, 66, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99];
var std_dc_luma_bits = [0, 0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
var std_dc_luma_vals = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
var std_dc_chroma_bits = [0, 0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
var std_dc_chroma_vals = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
var std_ac_luma_bits = [0, 0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 125];
var std_ac_luma_vals = [0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08, 0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9, 0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA];
var std_ac_chroma_bits = [0, 0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 119];
var std_ac_chroma_vals = [0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71, 0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91, 0xA1, 0xB1, 0xC1, 0x09, 0x23, 0x33, 0x52, 0xF0, 0x15, 0x62, 0x72, 0xD1, 0x0A, 0x16, 0x24, 0x34, 0xE1, 0x25, 0xF1, 0x17, 0x18, 0x19, 0x1A, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7A, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9, 0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF2, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA];
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function clampU8(v) {
  return clamp(Math.floor(v + 0.5), 0, 255);
}
function okread(pos, n, z) {
  return pos <= z && n <= z - pos;
}
function readU32LE(u8, p) {
  return (u8[p] | u8[p + 1] << 8 | u8[p + 2] << 16 | u8[p + 3] << 24) >>> 0;
}
function readU32BE(u8, p) {
  return (u8[p] << 24 >>> 0 | u8[p + 1] << 16 | u8[p + 2] << 8 | u8[p + 3]) >>> 0;
}
function decodeUtf8(u8) {
  return new TextDecoder().decode(u8);
}
function whiteRgb(w, h) {
  var rgb = new Uint8Array(w * h * 3);
  rgb.fill(255);
  return rgb;
}
function asciiBytes(s) {
  var out = new Uint8Array(s.length);
  for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 255;
  return out;
}
function bytesEqualString(u8, pos, s) {
  if (!okread(pos, s.length, u8.length)) return false;
  for (var i = 0; i < s.length; i++) {
    if (u8[pos + i] !== (s.charCodeAt(i) & 255)) return false;
  }
  return true;
}
function sniffBytes(buffer) {
  var u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  var n = Math.min(u8.length, 32);
  var hex = [];
  var text = [];
  for (var i = 0; i < n; i++) {
    hex.push(u8[i].toString(16).padStart(2, "0"));
    text.push(u8[i] >= 32 && u8[i] <= 126 ? String.fromCharCode(u8[i]) : ".");
  }
  return hex.join(" ") + " | " + text.join("");
}
function isMpsMagic(u8) {
  return u8.length >= 5 && u8[0] === 0x4d &&
  // M
  u8[1] === 0x50 &&
  // P
  u8[2] === 0x53 &&
  // S
  u8[3] >= 0x30 && u8[3] <= 0x39; // 0-9: MPS1, MPS9, etc.
}
var cost = null;
function initCost() {
  if (cost) return;
  cost = new Array(8);
  for (var x = 0; x < 8; x++) {
    cost[x] = new Array(8);
    for (var u = 0; u < 8; u++) cost[x][u] = Math.cos((2 * x + 1) * u * Math.PI / 16);
  }
}
function buildQuantTable(base, quality) {
  quality = clamp(quality | 0, 1, 100);
  var scale = quality < 50 ? Math.floor(5000 / quality) : 200 - quality * 2;
  var out = new Int32Array(64);
  for (var i = 0; i < 64; i++) {
    var natural = zigzag[i];
    out[i] = clamp(Math.floor((base[natural] * scale + 50) / 100), 1, 255);
  }
  return out;
}
function buildHuffDec(bits, vals) {
  var t = {
    mincode: new Int32Array(17),
    maxcode: new Int32Array(17),
    valptr: new Int32Array(17),
    vals: vals
  };
  var code = 0,
    k = 0;
  for (var i = 0; i <= 16; i++) t.maxcode[i] = -1;
  for (i = 1; i <= 16; i++) {
    if (bits[i] === 0) {
      code <<= 1;
      continue;
    }
    t.valptr[i] = k;
    t.mincode[i] = code;
    code += bits[i];
    k += bits[i];
    t.maxcode[i] = code - 1;
    code <<= 1;
  }
  return t;
}
function BitReader(data, pos) {
  this.data = data;
  this.pos = pos || 0;
  this.bitbuf = 0;
  this.bitcount = 0;
}
BitReader.prototype.nextByte = function () {
  return this.pos < this.data.length ? this.data[this.pos++] : 0;
};
BitReader.prototype.getBit = function () {
  if (this.bitcount === 0) {
    this.bitbuf = this.nextByte();
    this.bitcount = 8;
  }
  this.bitcount--;
  return this.bitbuf >> this.bitcount & 1;
};
BitReader.prototype.receiveBits = function (cat) {
  var v = 0;
  for (var i = 0; i < cat; i++) v = v << 1 | this.getBit();
  return v;
};
function huffDecode(br, t) {
  var code = 0;
  for (var i = 1; i <= 16; i++) {
    code = code << 1 | br.getBit();
    if (t.maxcode[i] !== -1 && code <= t.maxcode[i] && code >= t.mincode[i]) {
      return t.vals[t.valptr[i] + (code - t.mincode[i])];
    }
  }
  return -1;
}
function extend(v, cat) {
  if (cat === 0) return 0;
  return v < 1 << cat - 1 ? v - (1 << cat) + 1 : v;
}
function idct8x8(block) {
  initCost();
  var tmp = new Float64Array(64);
  var out = new Float64Array(64);
  var x, y, u, v, sum, cu, cv;
  for (y = 0; y < 8; y++) {
    for (x = 0; x < 8; x++) {
      sum = 0;
      for (u = 0; u < 8; u++) {
        cu = u === 0 ? 1 / Math.SQRT2 : 1;
        sum += cu * block[y * 8 + u] * cost[x][u];
      }
      tmp[y * 8 + x] = 0.5 * sum;
    }
  }
  for (x = 0; x < 8; x++) {
    for (y = 0; y < 8; y++) {
      sum = 0;
      for (v = 0; v < 8; v++) {
        cv = v === 0 ? 1 / Math.SQRT2 : 1;
        sum += cv * tmp[v * 8 + x] * cost[y][v];
      }
      out[y * 8 + x] = 0.5 * sum;
    }
  }
  return out;
}
function decodeMpsPrivateJpeg(data, gray, w, h) {
  if (w <= 0 || h <= 0 || data.length < 1) throw new Error("bad image dimensions/data");
  var ncomp = gray ? 1 : 3;
  var quality = data[0];
  var qtab = [buildQuantTable(std_luma_natural, quality), gray ? null : buildQuantTable(std_chroma_natural, quality)];
  var dcL = buildHuffDec(std_dc_luma_bits, std_dc_luma_vals);
  var acL = buildHuffDec(std_ac_luma_bits, std_ac_luma_vals);
  var dcC = gray ? null : buildHuffDec(std_dc_chroma_bits, std_dc_chroma_vals);
  var acC = gray ? null : buildHuffDec(std_ac_chroma_bits, std_ac_chroma_vals);
  var bwid = Math.ceil(w / 8),
    bhei = Math.ceil(h / 8),
    planew = bwid * 8,
    planeh = bhei * 8;
  var planes = [];
  for (var ci = 0; ci < ncomp; ci++) planes[ci] = new Float64Array(planew * planeh);
  var pred = [0, 0, 0];
  var br = new BitReader(data, 1);
  for (var by = 0; by < bhei; by++) {
    for (var bx = 0; bx < bwid; bx++) {
      for (ci = 0; ci < ncomp; ci++) {
        var dct = ci === 0 ? dcL : dcC;
        var act = ci === 0 ? acL : acC;
        var qt = ci === 0 ? qtab[0] : qtab[1];
        var coef = new Int32Array(64);
        var s = huffDecode(br, dct);
        if (s < 0) throw new Error("bad DC huffman code");
        var diff = s === 0 ? 0 : extend(br.receiveBits(s), s);
        pred[ci] += diff;
        coef[0] = pred[ci];
        var k = 1;
        while (k < 64) {
          var rs = huffDecode(br, act);
          if (rs < 0) throw new Error("bad AC huffman code");
          var run = rs >> 4;
          var size = rs & 15;
          if (size === 0) {
            if (run === 15) {
              k += 16;
              continue;
            }
            break;
          }
          k += run;
          if (k >= 64) break;
          coef[k] = extend(br.receiveBits(size), size);
          k++;
        }
        var block = new Float64Array(64);
        for (k = 0; k < 64; k++) {
          var natural = zigzag[k];
          block[natural] = coef[k] * qt[k];
        }
        var pix = idct8x8(block);
        for (var i = 0; i < 8; i++) {
          for (var j = 0; j < 8; j++) {
            planes[ci][(by * 8 + i) * planew + (bx * 8 + j)] = clamp(pix[i * 8 + j] + 128, 0, 255);
          }
        }
      }
    }
  }
  var rgb = new Uint8Array(w * h * 3);
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var idx = y * planew + x;
      var Y = planes[0][idx],
        r,
        g,
        b;
      if (gray) {
        r = g = b = Y;
      } else {
        var Cb = planes[1][idx] - 128;
        var Cr = planes[2][idx] - 128;
        r = Y + 1.402 * Cr;
        g = Y - 0.344136 * Cb - 0.714136 * Cr;
        b = Y + 1.772 * Cb;
      }
      var o = (y * w + x) * 3;
      rgb[o] = clampU8(r);
      rgb[o + 1] = clampU8(g);
      rgb[o + 2] = clampU8(b);
    }
  }
  return {
    rgb: rgb,
    consumed: br.pos
  };
}
var crcTable = null;
function makeCrcTable() {
  crcTable = new Uint32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ c >>> 1 : c >>> 1;
    crcTable[n] = c >>> 0;
  }
}
function crc32(bytes) {
  if (!crcTable) makeCrcTable();
  var c = 0xffffffff;
  for (var i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 255] ^ c >>> 8;
  return (c ^ 0xffffffff) >>> 0;
}
function u32be(v) {
  return [v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255];
}
function concatArrays(parts) {
  var len = 0,
    i;
  for (i = 0; i < parts.length; i++) len += parts[i].length;
  var out = new Uint8Array(len),
    pos = 0;
  for (i = 0; i < parts.length; i++) {
    out.set(parts[i], pos);
    pos += parts[i].length;
  }
  return out;
}
function pngChunk(type, payload) {
  var t = asciiBytes(type);
  var len = new Uint8Array(u32be(payload.length));
  var crc = new Uint8Array(u32be(crc32(concatArrays([t, payload]))));
  return concatArrays([len, t, payload, crc]);
}
function rgbToPngBlob(rgb, w, h) {
  if (!self.pako || !pako.deflate) throw new Error("pako is required for PNG output");
  var raw = new Uint8Array(h * (1 + w * 3));
  var p = 0,
    s = 0;
  for (var y = 0; y < h; y++) {
    raw[p++] = 0;
    raw.set(rgb.subarray(s, s + w * 3), p);
    p += w * 3;
    s += w * 3;
  }
  var ihdr = new Uint8Array(13);
  ihdr.set(u32be(w), 0);
  ihdr.set(u32be(h), 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  var png = concatArrays([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("IHDR", ihdr), pngChunk("IDAT", pako.deflate(raw)), pngChunk("IEND", new Uint8Array(0))]);
  return new Blob([png], {
    type: "image/png"
  });
}
function base64ToBytes(s) {
  var bin = atob(String(s || ""));
  var out = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 255;
  return out;
}
function mpsChunkTypeToReaderType(t) {
  // libmps trailer uses native types: URL=0, NOTE=1.
  // reader uses: URL=2, NOTE=3.
  if (t === 0) return 2;
  if (t === 1) return 3;
  if (t === 2) return 2;
  if (t === 3) return 3;
  return -1;
}
function normalizeTrailerChunk(item) {
  if (!Array.isArray(item) || item.length !== 6) return null;
  var readerType = mpsChunkTypeToReaderType(Number(item[0]));
  if (readerType < 0) return null;
  var x = Math.max(0, Number(item[1]) || 0);
  var y = Math.max(0, Number(item[2]) || 0);
  var w = Math.max(1, Number(item[3]) || 1);
  var h = Math.max(1, Number(item[4]) || 1);
  var text;
  try {
    text = decodeUtf8(base64ToBytes(item[5])).replace(/\0+$/, "");
  } catch (e) {
    text = String(item[5] == null ? "" : item[5]);
  }
  return [readerType, x, y, w, h, text];
}
function readU64LEAsNumber(u8, p) {
  var lo = readU32LE(u8, p);
  var hi = readU32LE(u8, p + 4);
  var n = hi * 4294967296 + lo;
  if (!Number.isSafeInteger(n)) throw new Error("MPS chunk trailer is too large");
  return n;
}
function parsePythonChunkTrailer(u8, expectedPages) {
  var z = u8.length;
  var footerLen = PY_CHUNK_FOOTER.length;
  var headerLen = PY_CHUNK_HEADER.length;
  var tailSize = 8 + footerLen;
  if (z < headerLen + tailSize) return null;
  var lenPos = z - tailSize;
  var footerPos = lenPos + 8;
  if (!bytesEqualString(u8, footerPos, PY_CHUNK_FOOTER)) return null;
  var payloadLen = readU64LEAsNumber(u8, lenPos);
  var start = z - tailSize - payloadLen - headerLen;
  if (start < 0) throw new Error("invalid libmps chunk trailer length");
  if (!bytesEqualString(u8, start, PY_CHUNK_HEADER)) {
    throw new Error("invalid libmps chunk trailer header");
  }
  var payload = u8.subarray(start + headerLen, start + headerLen + payloadLen);
  var decoded;
  try {
    decoded = JSON.parse(decodeUtf8(pako.inflate(payload)));
  } catch (e) {
    throw new Error("invalid libmps chunk trailer: " + (e && e.message ? e.message : e));
  }
  if (!decoded || decoded.version !== 1 || !Array.isArray(decoded.pages)) {
    throw new Error("invalid libmps chunk trailer JSON");
  }
  if (decoded.pages.length !== expectedPages) {
    throw new Error("chunk trailer page count does not match MPS page count");
  }
  var pages = [];
  var total = 0;
  for (var pi = 0; pi < decoded.pages.length; pi++) {
    var rawChunks = decoded.pages[pi];
    var chunks = [];
    if (Array.isArray(rawChunks)) {
      for (var ci = 0; ci < rawChunks.length; ci++) {
        var chunk = normalizeTrailerChunk(rawChunks[ci]);
        if (chunk) {
          chunks.push(chunk);
          total++;
        }
      }
    }
    pages.push(chunks);
  }
  return {
    start: start,
    payloadLen: payloadLen,
    pages: pages,
    total: total
  };
}
function parseMpsFile(buffer) {
  var b = new Uint8Array(buffer);
  var z = b.length;
  var pos = 0;
  if (!okread(0, 6, z) || !isMpsMagic(b)) {
    throw new Error("Invalid MPS file. Header: " + sniffBytes(b));
  }
  var magic = String.fromCharCode(b[0], b[1], b[2], b[3]);
  if (b[4] !== MPS_VERSION) {
    console.warn("MPS version mismatch. Magic:", magic, "expected version byte", MPS_VERSION, "file has", b[4], "continuing.");
  }
  pos = 5;
  var ptype = b[pos++];
  if (!okread(pos, 4, z)) throw new Error("Truncated title length");
  var titleLen = readU32LE(b, pos);
  pos += 4;
  var title = "";
  if (titleLen > 0) {
    if (!okread(pos, titleLen, z)) throw new Error("Truncated title");
    title = decodeUtf8(b.subarray(pos, pos + titleLen));
    pos += titleLen;
  }
  if (!okread(pos, 4, z)) throw new Error("Truncated page count");
  var npages = readU32LE(b, pos);
  pos += 4;
  var pages = [];
  var blobs = [];
  for (var pi = 0; pi < npages; pi++) {
    if (!okread(pos, 9, z)) throw new Error("Truncated page header at page " + pi);
    var w = readU32LE(b, pos);
    pos += 4;
    var h = readU32LE(b, pos);
    pos += 4;
    var kind = b[pos++];
    var rgb;
    if (kind === MPS_KIND_SOLID) {
      if (!okread(pos, 3, z)) throw new Error("Truncated solid color at page " + pi);
      var r = b[pos++],
        g = b[pos++],
        bl = b[pos++];
      rgb = new Uint8Array(w * h * 3);
      for (var px = 0; px < w * h; px++) {
        var o = px * 3;
        rgb[o] = r;
        rgb[o + 1] = g;
        rgb[o + 2] = bl;
      }
    } else if (kind === MPS_KIND_JPEG_GRAY || kind === MPS_KIND_JPEG_RGB) {
      if (!okread(pos, 4, z)) throw new Error("Truncated image length at page " + pi);
      var dlen = readU32LE(b, pos);
      pos += 4;
      if (!okread(pos, dlen, z)) throw new Error("Truncated image payload at page " + pi);
      try {
        var decoded = decodeMpsPrivateJpeg(b.subarray(pos, pos + dlen), kind === MPS_KIND_JPEG_GRAY, w, h);
        rgb = decoded.rgb;
      } catch (err) {
        console.warn("MPS image decode failed on page " + pi + ", using white page.", err);
        rgb = whiteRgb(w, h);
      }
      pos += dlen;
    } else {
      throw new Error("Unknown MPS page kind " + kind + " at page " + pi);
    }
    blobs.push(rgbToPngBlob(rgb, w, h));
    pages.push({
      w: w,
      h: h,
      atlasIdx: pi,
      chunks: [[1, 0, 0, w, h, 0, 0, -1]]
    });
  }
  var trailer = parsePythonChunkTrailer(b, npages);
  if (trailer) {
    for (var ti = 0; ti < trailer.pages.length; ti++) {
      for (var cj = 0; cj < trailer.pages[ti].length; cj++) {
        pages[ti].chunks.push(trailer.pages[ti][cj]);
      }
    }
    console.log("Loaded Python libmps URL/note chunk trailer:", trailer.total, "chunks, payload", trailer.payloadLen, "bytes");
  } else {
    console.log("No Python libmps URL/note chunk trailer found.");
  }
  var totalMetaChunks = 0;
  for (var mi = 0; mi < pages.length; mi++) {
    totalMetaChunks += Math.max(0, pages[mi].chunks.length - 1);
  }
  console.log("MPS parsed:", "magic=", magic, "pages=", pages.length, "metadata chunks=", totalMetaChunks, "native end offset=", pos, "file size=", z);
  return {
    data: {
      title: title,
      ptype: ptype,
      p: pages
    },
    blobs: blobs
  };
}
function parseLegacyBin(buffer) {
  if (!self.pako || !pako.inflate) throw new Error("pako is required for legacy bin format");
  if (buffer.byteLength < 8) {
    throw new Error("File too small for legacy bin. Header: " + sniffBytes(buffer));
  }
  var view = new DataView(buffer);
  var ptr = 0;
  var jsonLen = view.getUint32(ptr, false);
  ptr += 4;
  if (jsonLen <= 0 || jsonLen > buffer.byteLength - ptr) {
    throw new Error("Not MPS and not legacy bin. jsonLen=" + jsonLen + ", fileSize=" + buffer.byteLength + ", header=" + sniffBytes(buffer));
  }
  var jsonBytes = new Uint8Array(buffer, ptr, jsonLen);
  ptr += jsonLen;
  var data = JSON.parse(decodeUtf8(pako.inflate(jsonBytes)));
  if (ptr + 4 > buffer.byteLength) throw new Error("Legacy bin truncated before blob count");
  var blobCount = view.getUint32(ptr, false);
  ptr += 4;
  var blobs = [];
  for (var i = 0; i < blobCount; i++) {
    if (ptr + 4 > buffer.byteLength) throw new Error("Legacy bin truncated before blob size " + i);
    var size = view.getUint32(ptr, false);
    ptr += 4;
    if (ptr + size > buffer.byteLength) throw new Error("Legacy bin truncated at blob " + i);
    var bytes = new Uint8Array(buffer, ptr, size);
    ptr += size;
    blobs.push(new Blob([bytes], {
      type: "image/webp"
    }));
  }
  if (data.p) {
    data.p = data.p.map(function (p) {
      return {
        w: p[0],
        h: p[1],
        atlasIdx: p[2],
        chunks: p[3]
      };
    });
  }
  return {
    data: data,
    blobs: blobs
  };
}
self.onmessage = async function (e) {
  var fileUrl = e.data.fileUrl;
  var buffer = null;
  try {
    var resp = await fetch(fileUrl);
    if (!resp.ok) throw new Error("HTTP " + resp.status + " while fetching " + fileUrl);
    buffer = await resp.arrayBuffer();
    var u8 = new Uint8Array(buffer);
    console.log("loader fetched:", fileUrl, "size:", buffer.byteLength, "header:", sniffBytes(u8));
    var result;
    if (isMpsMagic(u8)) {
      result = parseMpsFile(buffer);
    } else {
      result = parseLegacyBin(buffer);
    }
    self.postMessage({
      success: true,
      data: result.data,
      blobs: result.blobs
    });
  } catch (err) {
    self.postMessage({
      success: false,
      error: "URL: " + fileUrl + "\n" + "Size: " + (buffer ? buffer.byteLength : "no buffer") + "\n" + "Header: " + (buffer ? sniffBytes(buffer) : "no header") + "\n" + "Name: " + (err && err.name ? err.name : "Error") + "\n" + "Message: " + (err && err.message ? err.message : String(err)) + "\n" + "Stack:\n" + (err && err.stack ? err.stack : "")
    });
  }
};