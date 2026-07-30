// ---------------------------------------------------------------------------
// Canvas rendering: atlas decoding + the draw loop.
// ---------------------------------------------------------------------------

import {
    computeMetrics, visibleRows, pageOrigin, pagesInRow, rowCount,
} from "./layout.js";

// chunk = [type, x, y, w, h, ...]
export const CHUNK_SOLID = 0;
export const CHUNK_IMAGE = 1;
export const CHUNK_URL = 2;
export const CHUNK_NOTE = 3;

const DEBUG_STYLES = {
    [CHUNK_IMAGE]: { stroke: "rgba(255, 0, 0, 0.7)", fill: "red", label: (c) => `IMG:${c[7] || 0}` },
    [CHUNK_URL]: { stroke: "rgba(0, 200, 80, 0.8)", fill: "green", label: () => "URL" },
    [CHUNK_NOTE]: { stroke: "rgba(0, 130, 255, 0.8)", fill: "blue", label: () => "NOTE" },
};

/** Split one atlas image into per-channel canvases plus the raw bitmap. */
function decodeAtlas(blob, index, pool) {
    return new Promise((resolve) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(blob);

        img.onload = () => {
            const { width, height } = img;

            const full = document.createElement("canvas");
            full.width = width;
            full.height = height;
            const fullCtx = full.getContext("2d");
            fullCtx.drawImage(img, 0, 0);

            const source = fullCtx.getImageData(0, 0, width, height).data;
            const channels = [];

            for (let channel = 0; channel < 3; channel++) {
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext("2d");
                const imageData = ctx.createImageData(width, height);
                const target = imageData.data;

                for (let i = 0; i < source.length; i += 4) {
                    const value = source[i + channel];
                    target[i] = target[i + 1] = target[i + 2] = value;
                    target[i + 3] = 255;
                }

                ctx.putImageData(imageData, 0, 0);
                channels.push(canvas);
            }

            // channels: legacy atlas format. raw: MPS full-page chunks.
            pool.set(`atlas_${index}`, { channels, raw: full });
            URL.revokeObjectURL(objectUrl);
            resolve();
        };

        img.onerror = () => {
            console.error("Failed to decode image blob for atlas", index);
            URL.revokeObjectURL(objectUrl);
            resolve();
        };

        img.src = objectUrl;
    });
}

export function createMangaRenderer(state, dom) {
    const dpr = window.devicePixelRatio || 1;
    let ctx = null;
    let resizeRequired = true;
    let renderRequested = false;

    function initContext() {
        if (state.settings.webgl && typeof enableWebGLCanvas === "function") {
            try {
                ctx = enableWebGLCanvas(dom.canvas);
                if (ctx) {
                    console.log("MangaEngine: WebGL acceleration active.");
                    return;
                }
            } catch (err) {
                console.warn("MangaEngine: WebGL init failed, using 2D.", err);
            }
        }
        ctx = dom.canvas.getContext("2d");
        console.log("MangaEngine: Canvas2D mode active.");
    }

    initContext();

    function drawImageChunk(atlasIdx, chunk, x, y, w, h) {
        const atlas = state.imagePool.get(`atlas_${atlasIdx}`);
        if (!atlas) return;

        const [, , , srcW, srcH, ax, ay, rawChannel] = chunk;
        const channel = rawChannel ?? 0;

        // Legacy: draw one split RGB channel. MPS uses -1 = raw full page.
        if (channel >= 0 && atlas.channels?.[channel]) {
            ctx.drawImage(atlas.channels[channel], ax, ay, srcW, srcH, x, y, w, h);
        } else if (atlas.raw) {
            ctx.drawImage(atlas.raw, ax, ay, srcW, srcH, x, y, w, h);
        }
    }

    function drawDebugOverlay(chunk, x, y, w, h) {
        const style = DEBUG_STYLES[chunk[0]];
        if (!style) return;

        ctx.lineWidth = 1;
        ctx.font = "bold 10px monospace";
        ctx.strokeStyle = style.stroke;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = style.fill;
        ctx.fillText(style.label(chunk), x + 3, y + 11);
    }

    function drawChunk(page, chunk, baseX, baseY, viewport) {
        const [type, cx, cy, cw, ch] = chunk;
        if (type > CHUNK_IMAGE && !state.settings.debug) return;

        const x0 = Math.round(cx * state.scale);
        const y0 = Math.round(cy * state.scale);
        const x = x0 + baseX;
        const y = y0 + baseY;
        const w = Math.max(1, Math.round((cx + cw) * state.scale) - x0);
        const h = Math.max(1, Math.round((cy + ch) * state.scale) - y0);

        if (x + w <= 0 || x >= viewport.width || y + h <= 0 || y >= viewport.height) return;

        if (type === CHUNK_SOLID) {
            const value = chunk[5];
            ctx.fillStyle = `rgb(${value},${value},${value})`;
            ctx.fillRect(x, y, w, h);
        } else if (type === CHUNK_IMAGE) {
            drawImageChunk(page.atlasIdx, chunk, x, y, w, h);
        }

        if (state.settings.debug) drawDebugOverlay(chunk, x, y, w, h);
    }

    function renderPass() {
        if (!state.mangaData) return;

        const viewport = {
            width: dom.container.clientWidth,
            height: dom.container.clientHeight,
        };
        const metrics = computeMetrics(state.mangaData, state.settings, state.scale, viewport.width);

        if (resizeRequired) {
            dom.canvas.width = viewport.width * dpr;
            dom.canvas.height = viewport.height * dpr;
            dom.canvas.style.width = `${viewport.width}px`;
            dom.canvas.style.height = `${viewport.height}px`;
            if (ctx.viewport) ctx.viewport(0, 0, dom.canvas.width, dom.canvas.height);
            resizeRequired = false;
        }

        if (ctx.start2D) ctx.start2D();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, viewport.width, viewport.height);

        const { scrollTop, scrollLeft } = dom.container;
        const total = rowCount(state.mangaData, state.settings);
        const { start, end } = visibleRows(metrics, scrollTop, viewport.height, total);

        for (let row = start; row < end; row++) {
            for (const index of pagesInRow(row, state.settings)) {
                const page = state.mangaData.p[index];
                if (!page) continue;

                const origin = pageOrigin(
                    index, row, metrics, state.settings, state.scale, scrollLeft, scrollTop
                );
                for (const chunk of page.chunks) {
                    drawChunk(page, chunk, origin.x, origin.y, viewport);
                }
            }
        }

        if (ctx.finish2D) ctx.finish2D();
    }

    return {
        /** Swap in a fresh canvas - needed when toggling WebGL on/off. */
        reloadEngineContext() {
            const old = dom.canvas;
            const replacement = old.cloneNode(true);
            old.parentNode.replaceChild(replacement, old);
            dom.canvas = replacement;

            initContext();
            this.invalidateSize();
            this.requestRender();
            return replacement;
        },

        async preparePayload(blobs) {
            const pool = new Map();
            await Promise.all(blobs.map((blob, i) => decodeAtlas(blob, i, pool)));
            return pool;
        },

        invalidateSize() {
            resizeRequired = true;
        },

        requestRender() {
            if (renderRequested) return;
            renderRequested = true;
            requestAnimationFrame(() => {
                renderRequested = false;
                renderPass();
            });
        },
    };
}
