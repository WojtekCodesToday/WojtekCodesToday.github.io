async function findActiveProvider() {
    const localBase = window.location.origin + "/manga/";
    
    let providers = [];
    try {
        const resp = await fetch(localBase + 'providers.json');
        if (resp.ok) providers = await resp.json();
    } catch (e) {
        console.warn("providers.json not found, continuing with 'self' only.");
    }

    const normalize = (u) => {
        if (!u || u === "self") return localBase;
        let t = u.trim();
        if (!t.startsWith('http')) t = 'https://' + t;
        return t.endsWith('/') ? t : t + '/';
    };

    if (activeProvider !== null && activeProvider !== undefined && activeProvider !== "") {
        const idx = parseInt(activeProvider);
        if (!isNaN(idx) && providers[idx]) {
            return normalize(providers[idx]);
        }
        return normalize(activeProvider);
    }

    const searchList = ["self", ...providers];
    const fileName = `${manga}/v${volume}_c${chapter}.bin`;

    for (let p of searchList) {
        const baseUrl = normalize(p);
        try {
            const check = await fetch(`${baseUrl}${fileName}`, { method: 'HEAD' });
            if (check.ok) {
                const foundIdx = providers.indexOf(p);
                activeProvider = (p === "self") ? null : (foundIdx !== -1 ? foundIdx : p);
                return baseUrl;
            }
        } catch (e) {
            console.warn(`Provider ${baseUrl} is unreachable.`);
        }
    }

    return localBase;
}
let providerBase = "";

function addToCache(mangaId, vol, chap, data, images) {
    const key = `${mangaId}_v${vol}_c${chap}`;
    if (chapterCache.has(key)) chapterCache.delete(key);

    chapterCache.set(key, { data, images });
    if (chapterCache.size > MAX_CACHE_SIZE) {
        const oldestKey = chapterCache.keys().next().value;
        const oldest = chapterCache.get(oldestKey);
        oldest.images.forEach((entry) => {
            if (entry && entry.channels) entry.channels.forEach(c => { if (c) { c.width = 0; c.height = 0; } });
            if (entry && entry.raw && entry.raw.src) URL.revokeObjectURL(entry.raw.src);
        });
        oldest.images.clear();
        chapterCache.delete(oldestKey);
    }
}

document.body.appendChild(tooltipEl);
let lastMousePos = { x: 0, y: 0 };

window.addEventListener("mousemove", (e) => {
    lastMousePos.x = e.pageX;
    lastMousePos.y = e.pageY;
});

container.addEventListener("wheel", (e) => {
    e.preventDefault();
    container.scrollTop += e.deltaY;
    requestRender();
}, { passive: false });

window.addEventListener("keydown", (e) => {
    if (e.key === "PrintScreen" || (e.ctrlKey && (e.key === "s" || e.key === "p"))) e.preventDefault();
    if (!isZoomed) {
        if (e.key === "ArrowDown" || e.key === "PageDown") {
            e.preventDefault();
            container.scrollTop += container.clientHeight;
            requestRender();
        }
        if (e.key === "ArrowUp" || e.key === "PageUp") {
            e.preventDefault();
            container.scrollTop -= container.clientHeight;
            requestRender();
        }
    }
});

function vzb() {
    visible = true;
    requestRender();
}

function jumpToPage() {
    container.scrollTop = mangas.h * startPage;
    visible = true;
}

function changehist() {
    const query = prsy.params();
    const url = `/manga/reader${query ? '?' + query : ''}`;
    if (window.history.pushState) window.history.pushState("", "", url);
}

async function initNavigation() {
    try {
        if (!fetched) {
            const resp = await fetch(`${providerBase}${manga}/ch.json`);
            chaptersList = await resp.json();
            fetched = true;
        }
        currentChapterIdx = chaptersList.findIndex(item =>
            Number(item.v) === Number(volume) && Number(item.c) === Number(chapter)
        );
        ch = currentChapterIdx !== -1 ? chaptersList[currentChapterIdx] : { n: "Unknown", v: volume, c: chapter };
        updateNavButtons();
    } catch (e) {
        ch = { n: "Error Loading", v: volume, c: chapter };
    }
}
let ch;

function l_chap(chc) {
    volume = chc.v; chapter = chc.c; ch = chc;
    changehist();
    currentChapterIdx = chaptersList.findIndex(x => x.v == volume && x.c == chapter);
    updateNavButtons();
    mangaData = null; isZoomed = false;
    container.scrollTop = 0; container.scrollLeft = 0;
    loadManga();
}

// -------------------------------------------------------------------
// ATLAS CHANNEL PRE-SPLITTING (fast path)
// -------------------------------------------------------------------
async function processImage(blob, idx, newPool) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = URL.createObjectURL(blob);
        img.onload = () => {
            const w = img.width, h = img.height;
            const tmp = document.createElement("canvas");
            tmp.width = w; tmp.height = h;
            const tctx = tmp.getContext("2d");

            if (settings.upscale) tctx.filter = "contrast(1.06) brightness(1.03)";
            tctx.drawImage(img, 0, 0);

            let idata = tctx.getImageData(0, 0, w, h);
            if (settings.upscale) idata = applyLightSharpen(idata);

            const src = idata.data;
            const channels = [];
            for (let c = 0; c < 3; c++) {
                const chCanvas = document.createElement("canvas");
                chCanvas.width = w; chCanvas.height = h;
                const chCtx = chCanvas.getContext("2d");
                const chData = chCtx.createImageData(w, h);
                const dst = chData.data;
                for (let i = 0; i < src.length; i += 4) {
                    const val = src[i + c];
                    dst[i] = dst[i+1] = dst[i+2] = val;
                    dst[i+3] = 255;
                }
                chCtx.putImageData(chData, 0, 0);
                channels.push(chCanvas);
            }

            newPool.set(`atlas_${idx}`, { channels, raw: null });
            URL.revokeObjectURL(img.src);
            resolve();
        };
        img.onerror = () => resolve();
    });
}

function applyLightSharpen(imageData) {
    const w = imageData.width, h = imageData.height, mix = 0.28;
    const weights = [0, -mix, 0, -mix, 1+(mix*4), -mix, 0, -mix, 0];
    const dst = new Uint8ClampedArray(imageData.data.length);
    const src = imageData.data;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const off = (y*w + x)*4;
            let r=0,g=0,b=0;
            for (let ky=0; ky<3; ky++) for (let kx=0; kx<3; kx++) {
                const sy = Math.min(h-1, Math.max(0, y+ky-1));
                const sx = Math.min(w-1, Math.max(0, x+kx-1));
                const sOff = (sy*w + sx)*4;
                const wt = weights[ky*3 + kx];
                r += src[sOff]*wt; g += src[sOff+1]*wt; b += src[sOff+2]*wt;
            }
            dst[off] = Math.max(0, Math.min(255, r));
            dst[off+1] = Math.max(0, Math.min(255, g));
            dst[off+2] = Math.max(0, Math.min(255, b));
            dst[off+3] = src[off+3];
        }
    }
    return new ImageData(dst, w, h);
}

function updateNavButtons() {
    if (currentChapterIdx === -1) {
        previous.style.display = next.style.display = "none";
        return;
    }
    ch = chaptersList[currentChapterIdx];
    previous.style.display = currentChapterIdx > 0 ? "block" : "none";
    if (currentChapterIdx > 0) previous.onclick = () => l_chap(chaptersList[currentChapterIdx-1]);
    next.style.display = currentChapterIdx < chaptersList.length-1 ? "block" : "none";
    if (currentChapterIdx < chaptersList.length-1) next.onclick = () => l_chap(chaptersList[currentChapterIdx+1]);
}

function requestRender() {
    if (!renderRequested) {
        renderRequested = true;
        requestAnimationFrame(() => { render(); renderRequested = false; });
    }
}

async function handleMangaPayload(result) {
    mangaData = result.data;
    const newPool = new Map();
    await Promise.all(result.blobs.map((blob, i) => processImage(blob, i, newPool)));
    imagePool = newPool;
    addToCache(manga, volume, chapter, mangaData, newPool);
    finishLoading();
}

async function loadManga() {
    await initNavigation();
    const cacheKey = `${manga}_v${volume}_c${chapter}`;
    if (chapterCache.has(cacheKey)) {
        const cached = chapterCache.get(cacheKey);
        mangaData = cached.data;
        imagePool = cached.images;
        finishLoading();
        return;
    }

    const fileUrl = `${providerBase}${manga}/v${volume}_c${chapter}.bin`;
    loadsettings();

    if (worker) {
        worker.postMessage({ fileUrl });
        worker.onmessage = (e) => {
            if (!e.data.success) {
                ui.innerText = "Error: " + (e.data.error || "unknown");
                console.error("Worker error:", e.data.error);
                return;
            }
            handleMangaPayload(e.data);
        };
    }
}

let rx; let opts = []; let show = false;
function m_settings(){ show = !show; settingsEl.style.display = show?"block":"none"; }

async function chkbox(e, c){
    settings[c] = e.checked;
    changehist();
    if (c === "upscale" && mangaData) {
        chapterCache.delete(`${manga}_v${volume}_c${chapter}`);
        loadManga();
    }
    requestRender();
}

function loadsettings(){
    opts = [document.getElementById("selread"), document.getElementById("chkhq"), document.getElementById("chkdebug")];
    opts[0].selectedIndex = settings.mode;
    opts[0].addEventListener("change", () => {
        settings.mode = parseInt(opts[0].value);
        changehist(); setupLayout();
    });
    opts[1].addEventListener("change", () => chkbox(opts[1], "upscale"));
    opts[2].addEventListener("change", () => chkbox(opts[2], "debug"));
}

function finishLoading() {
    container.style.display = "block";
    setupLayout();
    jumpToPage();
    requestRender();
    rx = `"${ch.n}" Vol ${ch.v} Ch ${ch.c}`;
    document.title = rx;
    ui.innerHTML = `<button onclick='m_settings()'>Settings</button>`;
}

ui.addEventListener("mouseover", () => ui.innerHTML = `${rx?rx+" ":""}<button onclick='m_settings()'>Settings</button>`);
ui.addEventListener("mouseleave", () => ui.innerHTML = `<button onclick='m_settings()'>Settings</button>`);

let scale;
function setupLayout() {
    if (!mangaData) return;
    const vH = container.clientHeight, vW = container.clientWidth, p0 = mangaData.p[0];
    const isManga = settings.mode === 0;
    const worldW = isManga ? p0.w*2 : p0.w;
    scale = isZoomed ? (vW / p0.w) : Math.min(vW/worldW, vH/p0.h);
    const totalRows = isManga ? Math.ceil(mangaData.p.length/2) : mangaData.p.length;
    mangas.h = p0.h * scale; mangas.w = worldW * scale;
    buffer.style.height = (180 + totalRows * mangas.h) + "px";
    buffer.style.width = mangas.w + "px";
    resize_canv = true; requestRender();
}

const textureUnpackCanvas = document.createElement("canvas");
const textureUnpackCtx = textureUnpackCanvas.getContext("2d", {willReadFrequently:true});

function render() {
    if (!mangaData || !visible) return;

    const vW = container.clientWidth, vH = container.clientHeight, p0 = mangaData.p[0];
    const isManga = settings.mode === 0;
    const spreadWidth = (isManga ? p0.w*2 : p0.w) * scale;
    const rowH = p0.h * scale;

    if (resize_canv) {
        canvas.width = vW*dpr; canvas.height = vH*dpr;
        canvas.style.width = vW+"px"; canvas.style.height = vH+"px";
        if(ctx.viewport)ctx.viewport(0, 0, canvas.width, canvas.height)
        resize_canv = false;
    }
    if(ctx.start2D)ctx.start2D();
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0,0,vW,vH);

    const vY = container.scrollTop, vX = container.scrollLeft;
    const centerOffset = Math.max(0, (vW - spreadWidth)/2);
    const startRow = Math.max(0, Math.floor((vY-400)/rowH));
    const endRow = Math.min(isManga?Math.ceil(mangaData.p.length/2):mangaData.p.length, Math.ceil((vY+vH+400)/rowH));

    const offsetY = 130 * scale;

    for (let r = startRow; r < endRow; r++) {
        const pages = isManga ? [r*2, r*2+1] : [r];
        pages.forEach(i => {
            const page = mangaData.p[i]; if (!page) return;
            const isRight = isManga && (i%2 === 0);
            const baseX = (isRight ? p0.w*scale : 0) - vX + centerOffset;
            const baseY = r*rowH - vY + offsetY;

            page.chunks.forEach(chunk => {
                const t = chunk[0];
                if (t > 1) return;
                const cX=chunk[1], cY=chunk[2], cW=chunk[3], cH=chunk[4];

                // Edge-consistent rounding — eliminates seams
                const x0 = Math.round(cX * scale);
                const y0 = Math.round(cY * scale);
                const x1 = Math.round((cX + cW) * scale);
                const y1 = Math.round((cY + cH) * scale);

                const dx = x0 + baseX;
                const dy = y0 + baseY;
                const dw = Math.max(1, x1 - x0);
                const dh = Math.max(1, y1 - y0);

                if (dx+dw > 0 && dx < vW && dy+dh > 0 && dy < vH) {
                    if (t === 0) {
                        const v = chunk[5];
                        ctx.fillStyle = `rgb(${v},${v},${v})`;
                        ctx.fillRect(dx, dy, dw, dh);
                    } else if (t === 1) {
                        drawChunk(page.atlasIdx, chunk, dx, dy, dw, dh);
                    }
                }
            });
        });
    }
    if(ctx.finish2D)ctx.finish2D();
}

function drawChunk(atlasIdx, chunk, x, y, w, h) {
    const atlas = imagePool.get(`atlas_${atlasIdx}`);
    if (!atlas) return;

    const srcW = chunk[3];
    const srcH = chunk[4];
    const ax = chunk[5];
    const ay = chunk[6];
    const chan = chunk[7] || 0;

    if (atlas.channels && atlas.channels[chan]) {
        ctx.drawImage(atlas.channels[chan], ax, ay, srcW, srcH, x, y, w, h);
    } else if (atlas.raw) {
        ctx.drawImage(atlas.raw, ax, ay, srcW, srcH, x, y, w, h);
    }
}

// === ALL EVENT LISTENERS BELOW (unchanged from your last version) ===
canvas.addEventListener("mousedown", (e) => { isDragging = true; startX = e.pageX - canvas.offsetLeft; startY = e.pageY - canvas.offsetTop; startScrollTop = container.scrollTop; startScrollLeft = container.scrollLeft; });
canvas.addEventListener("contextmenu", (e) => { e.preventDefault(); return false; });
window.addEventListener("mouseup", () => isDragging = false);

function getCoords(e) {
    if (e.isFake) return { x: e.x, y: e.y };
    if (e.touches && e.touches.length > 0) return { x: e.touches[0].pageX, y: e.touches[0].pageY };
    return { x: e.pageX, y: e.pageY };
}

canvas.addEventListener("click", (e) => {
    if (Math.abs(startX - (e.pageX - canvas.offsetLeft)) < 5) {
        const rect = canvas.getBoundingClientRect();
        const hit = getMetadataAt(e.clientX - rect.left, e.clientY - rect.top);
        if (hit && hit.type === 2) window.open(hit.data, "_blank");
    }
});

function getMetadataAt(mouseX, mouseY) {
    if (!mangaData) return null;
    const p0 = mangaData.p[0];
    const isManga = settings.mode === 0;
    const spreadWidth = (isManga ? p0.w * 2 : p0.w) * scale;
    const rowH = p0.h * scale;
    const vX = container.scrollLeft, vY = container.scrollTop;
    const centerOffset = Math.max(0, (container.clientWidth - spreadWidth) / 2);
    const offset = [0, 130 * scale];

    const absoluteX = mouseX + vX - centerOffset - offset[0];
    const absoluteY = mouseY + vY - offset[1];
    const rowIdx = Math.floor(absoluteY / rowH);
    if (rowIdx < 0 || rowIdx >= (isManga ? Math.ceil(mangaData.p.length / 2) : mangaData.p.length)) return null;

    const yPagePos = rowIdx * rowH;
    const relativeY = (absoluteY - yPagePos) / scale;
    const pagesInRow = isManga ? [rowIdx*2, rowIdx*2+1] : [rowIdx];

    for (let i of pagesInRow) {
        const page = mangaData.p[i]; if (!page) continue;
        const isRight = isManga && (i % 2 === 0);
        const xPageOff = isRight ? (p0.w * scale) : 0;
        const relativeX = (absoluteX - xPageOff) / scale;

        for (let chunk of page.chunks) {
            const type = chunk[0];
            if (type < 2) continue;
            const cX = chunk[1], cY = chunk[2], cW = chunk[3], cH = chunk[4];
            if (relativeX >= cX && relativeX <= cX+cW && relativeY >= cY && relativeY <= cY+cH) {
                return { type, data: chunk[5] };
            }
        }
    }
    return null;
}

function handleInputStart(e) { isDragging = true; const c = getCoords(e); startX = c.x - canvas.offsetLeft; startY = c.y - canvas.offsetTop; startScrollTop = container.scrollTop; startScrollLeft = container.scrollLeft; }
canvas.addEventListener("mousemove", (e) => { if (!isDragging) noteMove(e); });
function noteMove(e) {
    const rect = canvas.getBoundingClientRect();
    const localX = e.offsetX !== undefined ? e.offsetX : e.pageX - rect.left;
    const localY = e.offsetY !== undefined ? e.offsetY : e.pageY - rect.top;
    const hit = getMetadataAt(localX, localY);
    if (hit) {
        canvas.style.cursor = hit.type === 2 ? "pointer" : "help";
        if (hit.type === 3) {
            tooltipEl.innerText = hit.data;
            tooltipEl.style.display = "block";
            tooltipEl.style.left = (e.clientX + 15) + "px";
            tooltipEl.style.top = (e.clientY + 15) + "px";
        } else tooltipEl.style.display = "none";
    } else {
        canvas.style.cursor = "grab";
        tooltipEl.style.display = "none";
    }
}
function handleInputMove(e) {
    if (!isDragging) return;
    canvas.style.cursor = "grabbing";
    if (e.cancelable) e.preventDefault();
    const c = getCoords(e);
    const dx = (startX - (c.x - canvas.offsetLeft)) / (e.touches ? 2 : 1.8);
    const dy = (startY - (c.y - canvas.offsetTop)) / (e.touches ? 2 : 1.8);
    container.scrollLeft = Math.max(0, Math.min(startScrollLeft + dx, buffer.clientWidth - container.clientWidth));
    container.scrollTop = Math.max(0, Math.min(startScrollTop + dy, buffer.clientHeight - container.clientHeight));
    requestRender();
}
let renderRequested = false;
function endDrag() { isDragging = false; requestRender(); }

canvas.addEventListener("mousedown", handleInputStart);
canvas.addEventListener("touchstart", handleInputStart, { passive: false });
window.addEventListener("mousemove", handleInputMove);
window.addEventListener("touchmove", handleInputMove, { passive: false });
window.addEventListener("mouseup", endDrag);
window.addEventListener("touchend", endDrag);

canvas.addEventListener("dblclick", (e) => {
    const vW = container.clientWidth, vH = container.clientHeight, p0 = mangaData.p[0];
    const worldW = settings.mode === 0 ? p0.w*2 : p0.w;
    const pctX = (e.offsetX + container.scrollLeft) / (worldW * scale);
    const pctY = (e.offsetY + container.scrollTop) / buffer.clientHeight;
    isZoomed = !isZoomed;
    setupLayout();
    container.scrollLeft = pctX * (worldW * scale) - vW/2;
    container.scrollTop = pctY * buffer.clientHeight - vH/2;
    requestRender();
});

setInterval(vzb, 500);

window.onresize = () => { if (mangaData) { setupLayout(); requestRender(); } };

const workerCode = `
    importScripts('https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js');
    self.onmessage = async (e) => {
        const { fileUrl } = e.data;
        try {
            const resp = await fetch(fileUrl);
            if (!resp.ok) throw new Error("HTTP " + resp.status);
            const buffer = await resp.arrayBuffer();
            const view = new DataView(buffer);
            let ptr = 0;

            const jsonLen = view.getUint32(ptr, false); ptr += 4;
            const jsonBytes = new Uint8Array(buffer, ptr, jsonLen); ptr += jsonLen;
            const data = JSON.parse(new TextDecoder().decode(pako.inflate(jsonBytes)));

            const blobCount = view.getUint32(ptr, false); ptr += 4;
            const blobs = [];
            for (let i = 0; i < blobCount; i++) {
                const size = view.getUint32(ptr, false); ptr += 4;
                const bytes = new Uint8Array(buffer, ptr, size); ptr += size;
                blobs.push(new Blob([bytes], {type: 'image/webp'}));
            }

            if (data.p) {
                data.p = data.p.map(p => ({ w: p[0], h: p[1], atlasIdx: p[2], chunks: p[3] }));
            }

            self.postMessage({ success: true, data, blobs });
        } catch (err) {
            self.postMessage({ success: false, error: err.toString() });
        }
    };
`;

let worker;
(async () => {
    providerBase = await findActiveProvider();
    const blob = new Blob([workerCode], {type: 'application/javascript'});
    worker = new Worker(URL.createObjectURL(blob));
    loadManga();
})();
