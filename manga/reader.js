let providerBase = "";
function addToCache(mangaId, vol, chap, data, images) {
    const key = `${mangaId}_v${vol}_c${chap}`;
    if (chapterCache.has(key)) chapterCache.delete(key);

    chapterCache.set(key, { data, images });
    if (chapterCache.size > MAX_CACHE_SIZE) {
        const oldestKey = chapterCache.keys().next().value;
        const oldestContent = chapterCache.get(oldestKey);

        oldestContent.images.forEach(img => URL.revokeObjectURL(img.src));
        oldestContent.images.clear();

        chapterCache.delete(oldestKey);
        console.log(`Cache cleared for: ${oldestKey}`);
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
    const step = e.deltaY;
    const maxScroll = buffer.clientHeight - container.clientHeight;
    render()
    let targetY = container.scrollTop + step;
    container.scrollTop = Math.min(targetY, maxScroll);
}, { passive: false });

window.addEventListener("keydown", (e) => {
    if (
        e.key === "PrintScreen" ||
        (e.ctrlKey && e.key === "s") ||
        (e.ctrlKey && e.key === "p")
    ) {
        e.preventDefault();
    }
    if (!isZoomed) {
        const step = container.clientHeight;
        const maxScroll = buffer.clientHeight - container.clientHeight;
        if (e.key === "ArrowDown" || e.key === "PageDown") {
            e.preventDefault();
            let targetY = container.scrollTop + step;
            container.scrollTop = Math.min(targetY, maxScroll);

            render();
        }
        if (e.key === "ArrowUp" || e.key === "PageUp") {
            e.preventDefault();
            render();
            container.scrollBy(0, -container.clientHeight);
        }
    }
});

function vzb() {
    //visible = !(document.hidden || !document.hasFocus());
    visible=true;
    if (visible) {
        render();
    } else {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function jumpToPage() {
    container.scrollTop = 0;

    container.scrollBy(0, mangas.h * startPage);
    visible = true;
}

function changehist() {
    const query = prsy.params();
    const url = `/manga/reader${query ? '?' + query : ''}`;
    if(window.history.pushState)window.history.pushState("", "", url);
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

        if (currentChapterIdx !== -1) {
            ch = chaptersList[currentChapterIdx];
        } else {
            ch = { n: "Unknown", v: volume, c: chapter };
        }

        updateNavButtons();
    } catch (e) {
        console.error("Navigation failed to load", e);
        ch = { n: "Error Loading", v: volume, c: chapter };
    }
}
let ch;
function l_chap(chc) {
    volume = chc.v;
    chapter = chc.c;
    ch = chc;
    changehist();
    currentChapterIdx = chaptersList.findIndex(x => x.v == volume && x.c == chapter);
    updateNavButtons(); 
    
    mangaData = null;
    isZoomed = false;
    container.scrollTop = 0;
    container.scrollLeft = 0;

    loadManga();
}

async function processImage(b64, idx, total, newPool) {
    try {
        const binaryString = atob(b64.trim());
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        let blob = new Blob([bytes], { type: 'image/jpeg' });

        return new Promise((resolve) => {
            const img = new Image();
            img.src = URL.createObjectURL(blob);
            img.onload = async () => {
                if (settings.upscale) {
                    const enhancedCanvas = document.createElement('canvas');
                    enhancedCanvas.width = img.width;
                    enhancedCanvas.height = img.height;
                    const eCtx = enhancedCanvas.getContext('2d');

                    eCtx.filter = "contrast(1.1) brightness(1.03)";
                    eCtx.drawImage(img, 0, 0);

                    const sharpenedImg = new Image();
                    sharpenedImg.src = enhancedCanvas.toDataURL('image/webp', 0.8);
                    sharpenedImg.onload = () => {
                        newPool.set(`img_${idx}`, sharpenedImg);
                        URL.revokeObjectURL(img.src);
                        resolve();
                    };
                } else {
                    newPool.set(`img_${idx}`, img);
                    resolve();
                }
            };
        });
    } catch (e) {
        console.error("Decode fail", e);
    }
}

function applyLightSharpen(imageData) {
    const w = imageData.width;
    const h = imageData.height;
    const mix = 0.5;
    const weights = [0, -mix, 0, -mix, 1 + (mix * 4), -mix, 0, -mix, 0];
    const kat = Math.round(Math.sqrt(weights.length));
    const half = (kat / 2) | 0;
    const dstData = new Uint8ClampedArray(imageData.data.length);
    const src = imageData.data;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const sy = y;
            const sx = x;
            const dstOff = (y * w + x) * 4;
            let r = 0, g = 0, b = 0;

            for (let cy = 0; cy < kat; cy++) {
                for (let cx = 0; cx < kat; cx++) {
                    const scy = sy + cy - half;
                    const scx = sx + cx - half;
                    if (scy >= 0 && scy < h && scx >= 0 && scx < w) {
                        const srcOff = (scy * w + scx) * 4;
                        const wt = weights[cy * kat + cx];
                        r += src[srcOff] * wt;
                        g += src[srcOff + 1] * wt;
                        b += src[srcOff + 2] * wt;
                    }
                }
            }
            dstData[dstOff] = r;
            dstData[dstOff + 1] = g;
            dstData[dstOff + 2] = b;
            dstData[dstOff + 3] = src[dstOff + 3]; // Keep alpha
            console.log("test")
        }
    }
    return new ImageData(dstData, w, h);
}

function updateNavButtons() {
    if (currentChapterIdx === -1) {
        console.warn("Chapter not found in list");
        previous.style.display = "none";
        next.style.display = "none";
        return;
    }

    ch = chaptersList[currentChapterIdx];

    // Previous Button
    if (currentChapterIdx > 0) {
        previous.style.display = "block";
        previous.onclick = () => l_chap(chaptersList[currentChapterIdx - 1]);
    } else {
        previous.style.display = "none";
    }

    // Next Button
    if (currentChapterIdx < chaptersList.length - 1) {
        next.style.display = "block";
        next.onclick = () => l_chap(chaptersList[currentChapterIdx + 1]);
    } else {
        next.style.display = "none";
    }
}

const bitmapPool = new Map();

async function findActiveProvider() {
    const isLocal = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
    const localBase = isLocal ? (window.location.origin + "/") : (window.location.origin + "/manga/");
    
    let providers = [];
    try {
        const resp = await fetch('providers.json?v=' + Date.now());
        if (resp.ok && resp.headers.get("content-type")?.includes("json")) {
            providers = await resp.json();
        }
    } catch (e) {
        console.warn("providers.json fetch failed, using fallback logic.");
    }

    const normalize = (u) => {
        if (!u || u === "self") return localBase;
        let t = u.trim();
        if (!t.startsWith('http')) t = 'https://' + t;
        return t.endsWith('/') ? t : t + '/';
    };

    const searchList = providers.length ? providers : ["self"];
    const fileName = `${manga}/v${volume}_c${chapter}.bin`;

    for (let p of searchList) {
        const baseUrl = normalize(p);
        try {
            const check = await fetch(`${baseUrl}${fileName}`, { 
                method: 'GET', 
                headers: { 'Range': 'bytes=0-0' } 
            });

            const contentType = check.headers.get("Content-Type") || "";
            
            if ((check.ok || check.status === 206) && !contentType.includes("text/html")) {
                console.log(`Matched Provider: ${baseUrl}`);
                const foundIdx = providers.indexOf(p);
                activeProvider = (p === "self") ? null : (foundIdx !== -1 ? foundIdx : p);
                return baseUrl;
            }
        } catch (e) {
            console.warn(`Provider ${baseUrl} unreachable.`);
        }
    }

    return localBase;
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
    worker.postMessage({ fileUrl });

    worker.onmessage = async (e) => {
        const result = e.data;
        if (!result.success) { ui.innerText = "Error loading."; return; }

        mangaData = result.data;
        const newPool = new Map();
        
        const promises = result.blobs.map((blob, idx) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.src = URL.createObjectURL(blob);
                img.onload = () => {
                    newPool.set(`img_${idx}`, img);
                    resolve();
                };
                img.onerror = resolve;
            });
        });

        changehist();
        await Promise.all(promises);

        imagePool = newPool;
        addToCache(manga, volume, chapter, mangaData, newPool);
        finishLoading();
    };
}
let rx;
let opts = [];
let show = false;
function m_settings(){
    show = !show;
    settingsEl.style.display = show?"block":"none";
}
function chkbox(e, c){
    console.log(c, e.checked)
    settings[c]=e.checked;
    changehist();
    render();
    
}
function loadsettings(){
    opts = [
        document.getElementById("selread"),
        document.getElementById("chkhq"),
        document.getElementById("chkdebug"),
    ]
    opts[0].selectedIndex=settings.mode;
    opts[0].addEventListener("change", function(){
        settings.mode = parseInt(opts[0].value);
        render();
        changehist();
        setupLayout();
    })
    opts[1].addEventListener("change", ()=>chkbox(opts[1], "upscale"))
    opts[2].addEventListener("change", ()=>chkbox(opts[2], "debug"))
}

function finishLoading() {
    container.style.display = "block";
    setupLayout();
    jumpToPage();
    render();
    rx = `"${ch.n}" Vol ${ch.v} Ch ${ch.c}`
    document.title = rx;
    ui.innerHTML = `<button onclick='m_settings()'>Settings</button>`;
}

ui.addEventListener("mouseover", ()=>{
    ui.innerHTML = `${rx?`${rx} `:""}<button onclick='m_settings()'>Settings</button>`;
})

ui.addEventListener("mouseleave", ()=>{
    ui.innerHTML = `<button onclick='m_settings()'>Settings</button>`;
})

let scale;

function setupLayout() {
    if (!mangaData) return;
    const vH = container.clientHeight;
    const vW = container.clientWidth;
    const p0 = mangaData.p[0];

    const isManga = settings.mode === 0;
    const worldW = isManga ? p0.w * 2 : p0.w;
    const worldH = p0.h;

    if (isZoomed) {
        scale = vW / p0.w;
    } else {
        scale = Math.min(vW / worldW, vH / worldH);
    }

    const totalRows = isManga ? Math.ceil(mangaData.p.length / 2) : mangaData.p.length;
    mangas.h = (worldH * scale);
    mangas.w = (worldW * scale);
    buffer.style.height = (180 + (totalRows * worldH) * scale) + "px";
    buffer.style.width = (worldW * scale) + "px";

    resize_canv = true;
    render();
}

window.addEventListener("orientationchange", () => {
    setTimeout(setupLayout, 500);
});

let render_call = () => { };

function render() {
    if (!mangaData || !visible) return;
    currentHitBoxes = [];

    const vW = container.clientWidth;
    const vH = container.clientHeight;
    const p0 = mangaData.p[0];
    const isManga = settings.mode === 0;

    const spreadWidth = (isManga ? p0.w * 2 : p0.w) * scale;
    const rowH = p0.h * scale;

    if (resize_canv) {
        const newW = vW * dpr;
        const newH = vH * dpr;
        if (canvas.width !== newW || canvas.height !== newH) {
            canvas.style.width = vW + "px";
            canvas.style.height = vH + "px";
            canvas.width = newW;
            canvas.height = newH;
            if(ctx.viewport)ctx.viewport(0, 0, canvas.width, canvas.height)
        }
        resize_canv = false;
    }
    if(ctx.start2D)ctx.start2D();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, vW, vH);
    const vY = container.scrollTop;
    const vX = container.scrollLeft;

    const centerOffset = Math.max(0, (vW - spreadWidth) / 2);

    const startRow = Math.max(0, Math.floor((vY - 400) / rowH));
    const endRow = Math.min(
        isManga ? Math.ceil(mangaData.p.length / 2) : mangaData.p.length,
        Math.ceil((vY + vH + 400) / rowH)
    );

    const offset = [0, 130 * scale];

    for (let rowIdx = startRow; rowIdx < endRow; rowIdx++) {
        const pagesInRow = isManga ? [rowIdx * 2, rowIdx * 2 + 1] : [rowIdx];

        pagesInRow.forEach((i) => {
            const page = mangaData.p[i];
            if (!page) return;

            const isRight = isManga ? (i % 2 === 0) : false;
            const yPagePos = rowIdx * rowH;
            const xPageOff = isRight ? (p0.w * scale) : 0;
            
            page.c.forEach((chunk) => {
                const [type, cX, cY, cW, cH, data] = chunk;
                if (type > 1) return;

                const dx = (cX * scale) + xPageOff - vX + centerOffset + offset[0];
                const dy = (cY * scale) + yPagePos - vY + offset[1];
                const dw = cW * scale + 0.9;
                const dh = cH * scale + 0.9;

                if (dx + dw > 0 && dx < vW && dy + dh > 0 && dy < vH) {
                    if (type === 0) {
                        ctx.fillStyle = `rgb(${data},${data},${data})`;
                        ctx.fillRect(dx, dy, dw, dh);
                    } else if (type === 1) {
                        ctx.globalCompositeOperation = 'multiply';
                        drawChunk(i, cX, cY, data, dx, dy, dw, dh, false);
                        ctx.globalCompositeOperation = 'source-over';
                    }
                }
            });

            page.c.forEach((chunk) => {
                const [type, cX, cY, cW, cH, data] = chunk;

                const dx = (cX * scale) + xPageOff - vX + centerOffset + offset[0];
                const dy = (cY * scale) + yPagePos - vY + offset[1];
                const dw = cW * scale + 0.9;
                const dh = cH * scale + 0.9;

                if (dx + dw > 0 && dx < vW && dy + dh > 0 && dy < vH) {
                    if (type >= 2) {
                        currentHitBoxes.push({ x: dx, y: dy, w: dw, h: dh, type, data });
                    }

                    if (settings.debug) {
                        ctx.font = "bold 10px monospace";
                        ctx.lineWidth = 1;
                        if (type === 1) {
                            // img chunks
                            ctx.strokeStyle = "rgba(255, 0, 0, 0.7)";
                            ctx.fillStyle = "red";
                        } else if (type >= 2) {
                            // metadata
                            ctx.strokeStyle = "rgba(0, 150, 255, 0.8)";
                            ctx.fillStyle = "blue";
                        }
                        ctx.strokeRect(dx, dy, dw, dh);
                        ctx.fillText(`${data}`, dx + 2, dy + 10);
                    }
                }
            });
        });
    }
    uiHandle();
    if(ctx.finish2D)ctx.finish2D();
}

let imagePool = new Map();

function drawChunk(pageIdx, cX, cY, dictIdx, x, y, w, h) {
    const id = `img_${dictIdx}`;
    const img = imagePool.get(id);

    if (img && img.complete) {
        // 1. Draw the actual image chunk
        ctx.drawImage(img, x, y, w, h);

        if (settings.debug) {
            // Save state to ensure debug info doesn't inherit 'multiply' or other effects
            ctx.save();
            ctx.font = "20px Arial";
            
            // Reset composite operation so text is always solid red
            // Draw the border
            ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
            ctx.lineWidth = 2;
            
            if (scale > 0.1) {
                ctx.fillStyle = "blue";
            }
            ctx.strokeRect(x, y, w, h);
            
            ctx.restore(); // Return to previous state (like 'multiply')
        }
    }
}

// Interactivity: Drag & Zoom
canvas.addEventListener("mousedown", (e) => {
    isDragging = true;
    startX = e.pageX - canvas.offsetLeft;
    startY = e.pageY - canvas.offsetTop;
    startScrollTop = container.scrollTop;
    startScrollLeft = container.scrollLeft;
});

canvas.addEventListener("contextmenu", (e) => { e.preventDefault(); return false })

window.addEventListener("mouseup", () => (isDragging = false));

function getCoords(e) {
    // If we passed our own object with x/y, return it directly
    if (e.isFake) return { x: e.x, y: e.y };

    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].pageX, y: e.touches[0].pageY };
    }
    return { x: e.pageX, y: e.pageY };
}

canvas.addEventListener("click", (e) => {
    if (Math.abs(startX - (e.pageX - canvas.offsetLeft)) < 5) {
        // Use getBoundingClientRect to get the true local coordinates
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const hit = getMetadataAt(x, y);

        if (hit && hit.type === 2) window.open(hit.data, "_blank");
    }
});


function getMetadataAt(mouseX, mouseY) {
    // Search the boxes we actually drew on screen
    for (const box of currentHitBoxes) {
        if (mouseX >= box.x && mouseX <= box.x + box.w &&
            mouseY >= box.y && mouseY <= box.y + box.h) {
            return { type: box.type, data: box.data };
        }
    }
    return null;
}

// 3. Unified Input Handler (Mouse + Touch)
function handleInputStart(e) {
    isDragging = true;
    const coords = getCoords(e);

    startX = coords.x - canvas.offsetLeft;
    startY = coords.y - canvas.offsetTop;
    startScrollTop = container.scrollTop;
    startScrollLeft = container.scrollLeft;
}

canvas.addEventListener("mousemove", (e) => {
    if (!isDragging) {
        noteMove(e);
    }
});
// Fixed noteMove function
function noteMove(e) {
    // Calculate local X/Y from page coordinates if offsetX/Y are missing (like in fake events)
    const rect = canvas.getBoundingClientRect();
    const localX = (e.offsetX !== undefined) ? e.offsetX : (e.pageX - rect.left - window.scrollX);
    const localY = (e.offsetY !== undefined) ? e.offsetY : (e.pageY - rect.top - window.scrollY);

    const hit = getMetadataAt(localX, localY);

    if (hit) {
        canvas.style.cursor = hit.type === 2 ? "pointer" : "help";
        if (hit.type === 3) {
            tooltipEl.innerText = hit.data;
            tooltipEl.style.display = "block";
            // Position tooltip using clientX/Y to avoid scroll offset issues
            const clientX = (e.clientX !== undefined) ? e.clientX : (e.x - window.scrollX);
            const clientY = (e.clientY !== undefined) ? e.clientY : (e.y - window.scrollY);
            tooltipEl.style.left = (clientX + 15) + "px";
            tooltipEl.style.top = (clientY + 15) + "px";
            tooltipEl.style.fontSize = `${scale * 3 * 16}px`;
        } else {
            tooltipEl.style.display = "none";
        }
    } else {
        canvas.style.cursor = "grab";
        tooltipEl.style.display = "none";
    }
}


function handleInputMove(e) {
    if (!isDragging) return; // noteMove is now handled by the listener above

    canvas.style.cursor = "grabbing";
    if (e.cancelable) e.preventDefault();

    const coords = getCoords(e);
    const currentX = coords.x - canvas.offsetLeft;
    const currentY = coords.y - canvas.offsetTop;
    const sensitivity = e.touches ? 2 : 1.8;
    const dx = (startX - currentX) / sensitivity;
    const dy = (startY - currentY) / sensitivity;

    let targetLeft = startScrollLeft + dx;
    let targetTop = startScrollTop + dy;

    const maxScrollLeft = Math.max(0, buffer.clientWidth - container.clientWidth);
    container.scrollLeft = Math.max(0, Math.min(targetLeft, maxScrollLeft));

    const maxScrollTop = Math.max(0, buffer.clientHeight - container.clientHeight);
    container.scrollTop = Math.max(0, Math.min(targetTop, maxScrollTop));

    if (!renderRequested) {
        renderRequested = true;
        requestAnimationFrame(() => {
            render();
            renderRequested = false;
        });
    }
}
let renderRequested = false;

function endDrag(e) {
    isDragging = false;
    ctx.imageSmoothingQuality = "high";
    render();
};

canvas.addEventListener("mousedown", handleInputStart);
canvas.addEventListener("touchstart", handleInputStart, { passive: false });

window.addEventListener("mousemove", handleInputMove);
window.addEventListener("touchmove", handleInputMove, { passive: false });

window.addEventListener("mouseup", endDrag);
window.addEventListener("touchend", endDrag);

canvas.addEventListener("dblclick", (e) => {
    const vW = container.clientWidth;
    const vH = container.clientHeight;
    const p0 = mangaData.p[0];

    // 1. Capture CURRENT state before changing anything
    const worldW = settings.mode === 0 ? p0.w * 2 : p0.w;
    const currentSpreadWidth = worldW * scale;
    const currentTotalHeight = buffer.clientHeight;

    // Calculate click percentage relative to the content, NOT the screen
    const pctX = (e.offsetX + container.scrollLeft) / currentSpreadWidth;
    const pctY = (e.offsetY + container.scrollTop) / currentTotalHeight;

    // 2. Toggle Zoom
    isZoomed = !isZoomed;

    // 3. Update Layout (This changes 'scale' and buffer sizes)
    setupLayout();

    // 4. Calculate NEW state
    const newSpreadWidth = worldW * scale;
    const newTotalHeight = buffer.clientHeight;

    // 5. Scroll to the same percentage spot
    // We subtract (vW / 2) to ensure the clicked point ends up in the CENTER
    container.scrollLeft = (pctX * newSpreadWidth) - (vW / 2);
    container.scrollTop = (pctY * newTotalHeight) - (vH / 2);

    render();
});
//container.onscroll = () => requestAnimationFrame(render);

setInterval(vzb, 500);

window.onresize = () => {
    if (!mangaData) return;

    // Save current drag state to restore it after simulation
    const oldStartX = startX;
    const oldStartY = startY;

    setupLayout();

    const fakeEvent = {
        x: lastMousePos.x,
        y: lastMousePos.y,
        pageX: lastMousePos.x, // Add these for noteMove
        pageY: lastMousePos.y,
        isFake: true,
        preventDefault: () => { }
    };

    handleInputStart(fakeEvent);
    handleInputMove(fakeEvent);
    endDrag(fakeEvent);
    noteMove(fakeEvent);
    startX = oldStartX;
    startY = oldStartY;

    render();
};

const workerCode = `
    importScripts('https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js');

    self.onmessage = async (e) => {
        const { fileUrl } = e.data;
        try {
            const resp = await fetch(fileUrl);
            if (!resp.ok) throw new Error("fetch fail: " + resp.status);
            
            const arrayBuffer = await resp.arrayBuffer();
            let uint8 = new Uint8Array(arrayBuffer);

            if (uint8[0] === 101) {
                const b64 = new TextDecoder().decode(uint8).trim();
                const binary = atob(b64);
                uint8 = Uint8Array.from(binary, c => c.charCodeAt(0));
            }

            let decompressed;
            if (uint8[0] === 0x1f && uint8[1] === 0x8b) {
                decompressed = pako.ungzip(uint8);
            } else {
                try { decompressed = pako.inflate(uint8); } 
                catch (e) { decompressed = pako.inflate(uint8, { raw: true }); }
            }

            const reverseMap = { 200: '{', 201: '}', 202: '[', 203: ']', 204: ':', 205: ',', 206: '"' };
            const latinDecoder = new TextDecoder('latin1');
            let jsonStr = "";
            let start = 0;
            for (let i = 0; i < decompressed.length; i++) {
                const b = decompressed[i];
                if (reverseMap[b]) {
                    if (i > start) jsonStr += latinDecoder.decode(decompressed.subarray(start, i));
                    jsonStr += reverseMap[b];
                    start = i + 1;
                }
            }
            if (start < decompressed.length) jsonStr += latinDecoder.decode(decompressed.subarray(start));
            
            let data = JSON.parse(jsonStr);

            // NEW: Prepare Blobs in the background
            const blobs = [];
            for (let i = 0; i < data.dict.length; i++) {
                const b64 = data.dict[i];
                const binaryString = atob(b64.trim());
                const bytes = new Uint8Array(binaryString.length);
                for (let j = 0; j < binaryString.length; j++) bytes[j] = binaryString.charCodeAt(j);
                blobs.push(new Blob([bytes], { type: 'image/jpeg' }));
            }

            if (data.p && data.p.length > 0 && Array.isArray(data.p[0])) {
                data.p = data.p.map(pageArr => ({
                    w: pageArr[0],
                    h: pageArr[1],
                    c: pageArr[2]
                }));
            }

            self.postMessage({ success: true, data, blobs });
        } catch (err) {
            self.postMessage({ success: false, error: err.toString() });
        }
    };
`;
(async () => {
    providerBase = await findActiveProvider();
    const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
    worker = new Worker(URL.createObjectURL(workerBlob));
    loadManga();
})();