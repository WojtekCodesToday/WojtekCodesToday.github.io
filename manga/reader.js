/**
 * Manga Stream Reader Architecture
 * Powered by Functional Object Factories
 */

// --- 1. STATE MANAGEMENT FACTORY ---
function createMangaState() {
    var params;
    if (typeof window !== "undefined" && typeof window.URLSearchParams !== "undefined") {
        params = new window.URLSearchParams(window.location.search);
    } else {
        params = {
            _data: {},
            parse: function() {
                var search = (window.location.search || "").substring(1);
                if (!search) return;
                var pairs = search.split("&");
                for (var i = 0; i < pairs.length; i++) {
                    var parts = pairs[i].split("=");
                    if (parts[0]) this._data[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || "");
                }
            },
            get: function(key) {
                if (!this._initialized) { this.parse(); this._initialized = true; }
                return this._data.hasOwnProperty(key) ? this._data[key] : null;
            }
        };
    }

    var defaultv = ["wchan", 1];
    var cache = new Map();
    var MAX_CACHE_SIZE = 3;

    var manga = params.get("m") || defaultv[0];
    var volume = parseInt(params.get("v"), 10) || defaultv[1];
    var chapter = parseInt(params.get("c"), 10) || defaultv[1];
    var startPage = parseInt(params.get("p"), 10) || 0;
    var activeProvider = params.get("prov") || null;
    var isZoomed = false;
    var scale = 1.0;
    
    var chaptersList = [];
    var currentChapterIdx = -1;
    var mangaData = null;
    var imagePool = new Map();

    var settings = {
        mode: (params.get("mobile") === "true" || window.innerWidth < 768) ? 1 : 0,
        debug: false,
        webgl: true
    };

    try {
        var urlSettings = params.get("settings");
        if (urlSettings) {
            if (typeof Object.assign === 'function') {
                Object.assign(settings, JSON.parse(urlSettings));
            } else {
                var parsed = JSON.parse(urlSettings);
                for (var prop in parsed) {
                    if (parsed.hasOwnProperty(prop)) settings[prop] = parsed[prop];
                }
            }
        }
    } catch(e) { console.warn("Invalid settings payload string parameter.", e); }

    var queryEncoder = {
        configs: [],
        add: function(key, getFn, def) { this.configs.push({ key: key, getFn: getFn, def: def }); },
        build: function() {
            return this.configs
                .map(function(c) {
                    var val = c.getFn();
                    return (val !== c.def && val !== null) ? (c.key + "=" + encodeURIComponent(val)) : null;
                })
                .filter(Boolean)
                .join("&");
        }
    };

    queryEncoder.add("m", function() { return manga; }, defaultv[0]);
    queryEncoder.add("v", function() { return volume; }, defaultv[1]);
    queryEncoder.add("c", function() { return chapter; }, defaultv[1]);
    queryEncoder.add("prov", function() { return activeProvider; }, null);
    queryEncoder.add("settings", function() { return JSON.stringify(settings); }, null);

    return {
        get manga() { return manga; },
        get volume() { return volume; },
        get chapter() { return chapter; },
        get startPage() { return startPage; },
        get activeProvider() { return activeProvider; },
        set activeProvider(val) { activeProvider = val; },
        get isZoomed() { return isZoomed; },
        set isZoomed(val) { isZoomed = val; },
        get scale() { return scale; },
        set scale(val) { scale = val; },
        get settings() { return settings; },
        get chaptersList() { return chaptersList; },
        set chaptersList(val) { chaptersList = val; },
        get currentChapterIdx() { return currentChapterIdx; },
        set currentChapterIdx(val) { currentChapterIdx = val; },
        get mangaData() { return mangaData; },
        set mangaData(val) { mangaData = val; },
        get imagePool() { return imagePool; },
        set imagePool(val) { imagePool = val; },
        
        changeChapter: function(chObj) {
            volume = chObj.v;
            chapter = chObj.c;
            mangaData = null;
            isZoomed = false;
        },
        getHistoryUrl: function() {
            var query = queryEncoder.build();
            return "/manga/reader" + (query ? '?' + query : '');
        },
        addToCache: function(data, images) {
            var key = manga + "_v" + volume + "_c" + chapter;
            if (cache.has(key)) cache.delete(key);
            cache.set(key, { data: data, images: images });
            
            if (cache.size > MAX_CACHE_SIZE) {
                var oldestKey = cache.keys().next().value;
                var oldest = cache.get(oldestKey);
                oldest.images.forEach(function(entry) {
                    if (entry?.channels) entry.channels.forEach(function(c) { if (c) { c.width = 0; c.height = 0; } });
                    if (entry?.raw?.src) URL.revokeObjectURL(entry.raw.src);
                });
                cache.delete(oldestKey);
            }
        },
        getFromCache: function() {
            return cache.get(manga + "_v" + volume + "_c" + chapter) || null;
        }
    };
}

// --- 2. PROVIDER UTILITY FACTORY ---
function createProviderManager(state) {
    var localBase = window.location.origin + "/manga/";

    var normalize = function(u) {
        if (!u || u === "self") return localBase;
        var t = u.trim();
        if (!t.startsWith('http')) t = 'https://' + t;
        return t.endsWith('/') ? t : t + '/';
    };

    return {
        resolveBase: async function() {
            var providers = [];
            try {
                var resp = await fetch(localBase + 'providers.json');
                if (resp.ok) providers = await resp.json();
            } catch (e) { console.warn("Fallback: standard offline tracking fallback loop initialization active."); }

            if (state.activeProvider !== null) {
                var idx = parseInt(state.activeProvider, 10);
                return normalize(!isNaN(idx) && providers[idx] ? providers[idx] : state.activeProvider);
            }

            var searchList = ["self"].concat(providers);
            var fileName = state.manga + "/v" + state.volume + "_c" + state.chapter + ".bin";

            for (var i = 0; i < searchList.length; i++) {
                var baseUrl = normalize(searchList[i]);
                try {
                    var check = await fetch(baseUrl + fileName, { method: 'HEAD' });
                    if (check.ok) {
                        var foundIdx = providers.indexOf(searchList[i]);
                        state.activeProvider = (searchList[i] === "self") ? null : (foundIdx !== -1 ? foundIdx : searchList[i]);
                        return baseUrl;
                    }
                } catch (e) { console.warn("Unreachable server endpoint pipeline: " + baseUrl); }
            }
            return localBase;
        }
    };
}

// --- 3. RENDERING ENGINE FACTORY (DYNAMIC WEBGL FALLBACK PATCH) ---
function createMangaRenderer(state, dom) {
    var dpr = window.devicePixelRatio || 1;
    var ctx = null;
    var resizeRequired = true;
    var renderRequested = false;

    var initRenderingContext = function() {
        if (state.settings.webgl && typeof enableWebGLCanvas === "function") {
            try {
                ctx = enableWebGLCanvas(dom.canvas);
                if (ctx) {
                    console.log("MangaEngine: WebGL Acceleration Activated.");
                    return;
                }
            } catch (glError) {
                console.warn("MangaEngine: WebGL Initialization crashed. Falling back to native 2D.", glError);
            }
        }
        ctx = dom.canvas.getContext("2d");
        console.log("MangaEngine: Native Canvas2D Mode Activated.");
    };

    initRenderingContext();

    var processAtlasImage = async function(blob, idx, poolMap) {
        return new Promise(function(resolve) {
            var img = new Image();
            img.src = URL.createObjectURL(blob);
            img.onload = function() {
                var w = img.width, h = img.height;
                var tmp = document.createElement("canvas");
                tmp.width = w; tmp.height = h;
                var tctx = tmp.getContext("2d");

                tctx.drawImage(img, 0, 0);

                var idata = tctx.getImageData(0, 0, w, h);
                var src = idata.data;
                var channels = [];
                for (var c = 0; c < 3; c++) {
                    var chCanvas = document.createElement("canvas");
                    chCanvas.width = w; chCanvas.height = h;
                    var chCtx = chCanvas.getContext("2d");
                    var chData = chCtx.createImageData(w, h);
                    var dst = chData.data;
                    for (var i = 0; i < src.length; i += 4) {
                        var val = src[i + c];
                        dst[i] = dst[i+1] = dst[i+2] = val;
                        dst[i+3] = 255;
                    }
                    chCtx.putImageData(chData, 0, 0);
                    channels.push(chCanvas);
                }

                poolMap.set("atlas_" + idx, { channels: channels, raw: null });
                URL.revokeObjectURL(img.src);
                resolve();
            };
            img.onerror = function() { resolve(); };
        });
    };

    var drawChunk = function(atlasIdx, chunk, x, y, w, h) {
        var atlas = state.imagePool.get("atlas_" + atlasIdx);
        if (!atlas) return;
        var srcW = chunk[3], srcH = chunk[4], ax = chunk[5], ay = chunk[6], chan = chunk[7] || 0;

        if (atlas.channels?.[chan]) {
            ctx.drawImage(atlas.channels[chan], ax, ay, srcW, srcH, x, y, w, h);
        } else if (atlas.raw) {
            ctx.drawImage(atlas.raw, ax, ay, srcW, srcH, x, y, w, h);
        }
    };

    var executeRenderPass = function() {
        if (!state.mangaData) return;

        var vW = dom.container.clientWidth, vH = dom.container.clientHeight;
        var p0 = state.mangaData.p[0];
        var isMangaMode = state.settings.mode === 0;
        var spreadWidth = (isMangaMode ? p0.w * 2 : p0.w) * state.scale;
        var rowH = p0.h * state.scale;

        if (resizeRequired) {
            dom.canvas.width = vW * dpr; dom.canvas.height = vH * dpr;
            dom.canvas.style.width = vW + "px"; dom.canvas.style.height = vH + "px";
            if (ctx.viewport) ctx.viewport(0, 0, dom.canvas.width, dom.canvas.height);
            resizeRequired = false;
        }

        if (ctx.start2D) ctx.start2D();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, vW, vH);

        var vY = dom.container.scrollTop, vX = dom.container.scrollLeft;
        var centerOffset = Math.max(0, (vW - spreadWidth) / 2);
        var startRow = Math.max(0, Math.floor((vY - 400) / rowH));
        var endRow = Math.min(isMangaMode ? Math.ceil(state.mangaData.p.length / 2) : state.mangaData.p.length, Math.ceil((vY + vH + 400) / rowH));
        var offsetY = 130 * state.scale;

        for (var r = startRow; r < endRow; r++) {
            var pages = isMangaMode ? [r * 2, r * 2 + 1] : [r];
            pages.forEach(function(i) {
                var page = state.mangaData.p[i]; if (!page) return;
                var isRight = isMangaMode && (i % 2 === 0);
                var baseX = (isRight ? p0.w * state.scale : 0) - vX + centerOffset;
                var baseY = r * rowH - vY + offsetY;

                page.chunks.forEach(function(chunk) {
                    var t = chunk[0];
                    if (t > 1 && !state.settings.debug) return;

                    var cX = chunk[1], cY = chunk[2], cW = chunk[3], cH = chunk[4];

                    var x0 = Math.round(cX * state.scale);
                    var y0 = Math.round(cY * state.scale);
                    var x1 = Math.round((cX + cW) * state.scale);
                    var y1 = Math.round((cY + cH) * state.scale);

                    var dx = x0 + baseX;
                    var dy = y0 + baseY;
                    var dw = Math.max(1, x1 - x0);
                    var dh = Math.max(1, y1 - y0);

                    if (dx + dw <= 0 || dx >= vW || dy + dh <= 0 || dy >= vH) return;

                    if (t === 0) {
                        var v = chunk[5];
                        ctx.fillStyle = "rgb(" + v + "," + v + "," + v + ")";
                        ctx.fillRect(dx, dy, dw, dh);
                    } else if (t === 1) {
                        drawChunk(page.atlasIdx, chunk, dx, dy, dw, dh);
                    }

                    if (state.settings.debug) {
                        ctx.lineWidth = 1;
                        ctx.font = "bold 10px monospace";
                        
                        if (t === 1) {
                            ctx.strokeStyle = "rgba(255, 0, 0, 0.7)";
                            ctx.strokeRect(dx, dy, dw, dh);
                            ctx.fillStyle = "red";
                            ctx.fillText("IMG:" + (chunk[7]||0), dx + 3, dy + 11);
                        } else if (t === 2) {
                            ctx.strokeStyle = "rgba(0, 200, 80, 0.8)";
                            ctx.strokeRect(dx, dy, dw, dh);
                            ctx.fillStyle = "green";
                            ctx.fillText("URL", dx + 3, dy + 11);
                        } else if (t === 3) {
                            ctx.strokeStyle = "rgba(0, 130, 255, 0.8)";
                            ctx.strokeRect(dx, dy, dw, dh);
                            ctx.fillStyle = "blue";
                            ctx.fillText("NOTE", dx + 3, dy + 11);
                        }
                    }
                });
            });
        }
        if (ctx.finish2D) ctx.finish2D();
    };

    return {
        reloadEngineContext: function() {
            var oldCanvas = dom.canvas;
            var newCanvas = oldCanvas.cloneNode(true);
            
            oldCanvas.parentNode.replaceChild(newCanvas, oldCanvas);
            dom.canvas = newCanvas; 
            
            initRenderingContext();
            
            dom.canvas.dispatchEvent(new CustomEvent("canvasReplaced"));
            
            this.invalidateSize();
            this.requestRender();
        },
        preparePayload: async function(blobs) {
            var poolMap = new Map();
            await Promise.all(blobs.map(function(b, i) { return processAtlasImage(b, i, poolMap); }));
            return poolMap;
        },
        invalidateSize: function() { resizeRequired = true; },
        requestRender: function() {
            if (renderRequested) return;
            renderRequested = true;
            requestAnimationFrame(function() {
                executeRenderPass();
                renderRequested = false;
            });
        }
    };
}

// --- 4. ENGINE INTERACTION HANDLER (DELEGATED ARCHITECTURE) ---
function createInteractionHandler(state, renderer, dom) {
    var isDragging = false;
    var startX, startY, startScrollLeft, startScrollTop;
    var lastMousePos = { x: 0, y: 0 };
    var activeChapterTitle = "";

    var tooltip = dom.tooltip;

    var getCoords = function(e) {
        if (e.touches?.[0]) return { x: e.touches[0].pageX, y: e.touches[0].pageY };
        return { x: e.pageX, y: e.pageY };
    };

    var getMetadataAt = function(mouseX, mouseY) {
        if (!state.mangaData) return null;
        var p0 = state.mangaData.p[0];
        var isMangaMode = state.settings.mode === 0;
        var spreadWidth = (isMangaMode ? p0.w * 2 : p0.w) * state.scale;
        var rowH = p0.h * state.scale;
        
        var absoluteX = mouseX + dom.container.scrollLeft - Math.max(0, (dom.container.clientWidth - spreadWidth) / 2);
        var absoluteY = mouseY + dom.container.scrollTop - (130 * state.scale);
        
        var rowIdx = Math.floor(absoluteY / rowH);
        if (rowIdx < 0 || rowIdx >= (isMangaMode ? Math.ceil(state.mangaData.p.length / 2) : state.mangaData.p.length)) return null;

        var relativeY = (absoluteY - (rowIdx * rowH)) / state.scale;
        var pagesInRow = isMangaMode ? [rowIdx * 2, rowIdx * 2 + 1] : [rowIdx];

        for (var idx = 0; idx < pagesInRow.length; idx++) {
            var i = pagesInRow[idx];
            var page = state.mangaData.p[i]; if (!page) continue;
            var isRight = isMangaMode && (i % 2 === 0);
            var relativeX = (absoluteX - (isRight ? p0.w * state.scale : 0)) / state.scale;

            for (var j = 0; j < page.chunks.length; j++) {
                var chunk = page.chunks[j];
                if (chunk[0] < 2) continue; 
                if (relativeX >= chunk[1] && relativeX <= chunk[1] + chunk[3] && relativeY >= chunk[2] && relativeY <= chunk[2] + chunk[4]) {
                    return { type: chunk[0], data: chunk[5] };
                }
            }
        }
        return null;
    };

    var handleDragStart = function(e) {
        // Only trigger dragging if interacting with the active canvas instance directly
        if (e.target !== dom.canvas) return;

        isDragging = true;
        var c = getCoords(e);
        startX = c.x - dom.canvas.offsetLeft;
        startY = c.y - dom.canvas.offsetTop;
        startScrollTop = dom.container.scrollTop;
        startScrollLeft = dom.container.scrollLeft;
    };

    var handleDragMove = function(e) {
        if (!dom.canvas) return;
        var rect = dom.canvas.getBoundingClientRect();
        
        if (!isDragging) {
            // Check targets safely during delegation routing pass
            if (e.target !== dom.canvas) {
                if (dom.canvas) dom.canvas.style.cursor = "grab";
                tooltip.style.display = "none";
                return;
            }
            var localX = e.offsetX !== undefined ? e.offsetX : e.pageX - rect.left;
            var localY = e.offsetY !== undefined ? e.offsetY : e.pageY - rect.top;
            var hit = getMetadataAt(localX, localY);
            
            if (hit) {
                dom.canvas.style.cursor = hit.type === 2 ? "pointer" : "help";
                if (hit.type === 3) {
                    tooltip.innerText = hit.data;
                    tooltip.style.display = "block";
                    tooltip.style.left = (e.clientX + 15) + "px";
                    tooltip.style.top = (e.clientY + 15) + "px";
                } else tooltip.style.display = "none";
            } else {
                dom.canvas.style.cursor = "grab";
                tooltip.style.display = "none";
            }
            return;
        }

        dom.canvas.style.cursor = "grabbing";
        if (e.cancelable) e.preventDefault();
        var c = getCoords(e);
        
        var dx = (startX - (c.x - dom.canvas.offsetLeft)) / (e.touches ? 2 : 1.8);
        var dy = (startY - (c.y - dom.canvas.offsetTop)) / (e.touches ? 2 : 1.8);
        
        dom.container.scrollLeft = Math.max(0, Math.min(startScrollLeft + dx, dom.buffer.clientWidth - dom.container.clientWidth));
        dom.container.scrollTop = Math.max(0, Math.min(startScrollTop + dy, dom.buffer.clientHeight - dom.container.clientHeight));
        renderer.requestRender();
    };

    var handleDragEnd = function() {
        isDragging = false;
        if (dom.canvas) dom.canvas.style.cursor = "grab";
        renderer.requestRender();
    };

    return {
        bindEvents: function(onRefreshCall) {
            window.addEventListener("mousemove", function(e) { lastMousePos.x = e.pageX; lastMousePos.y = e.pageY; });
            
            dom.container.addEventListener("wheel", function(e) {
                e.preventDefault();
                dom.container.scrollTop += e.deltaY;
                renderer.requestRender();
                if (onRefreshCall) onRefreshCall();
            }, { passive: false });

            window.addEventListener("keydown", function(e) {
                if (e.key === "PrintScreen" || (e.ctrlKey && (e.key === "s" || e.key === "p"))) e.preventDefault();
                if (state.isZoomed) return;
                
                if (e.key === "ArrowDown" || e.key === "PageDown") {
                    e.preventDefault(); dom.container.scrollTop += dom.container.clientHeight;
                    renderer.requestRender(); if (onRefreshCall) onRefreshCall();
                }
                if (e.key === "ArrowUp" || e.key === "PageUp") {
                    e.preventDefault(); dom.container.scrollTop -= dom.container.clientHeight;
                    renderer.requestRender(); if (onRefreshCall) onRefreshCall();
                }
            });

            // Event Delegation: Bind to outer container window hooks safely 
            dom.container.addEventListener("mousedown", handleDragStart);
            dom.container.addEventListener("touchstart", handleDragStart, { passive: false });

            window.addEventListener("mousemove", handleDragMove);
            window.addEventListener("touchmove", handleDragMove, { passive: false });
            window.addEventListener("mouseup", handleDragEnd);
            window.addEventListener("touchend", handleDragEnd);

            dom.container.addEventListener("click", function(e) {
                if (e.target !== dom.canvas) return;
                if (Math.abs(startX - (e.pageX - dom.canvas.offsetLeft)) < 5) {
                    var rect = dom.canvas.getBoundingClientRect();
                    var hit = getMetadataAt(e.clientX - rect.left, e.clientY - rect.top);
                    if (hit?.type === 2) window.open(hit.data, "_blank");
                }
            });

            dom.container.addEventListener("dblclick", function(e) {
                if (e.target !== dom.canvas) return;
                var p0 = state.mangaData.p[0];
                var worldW = state.settings.mode === 0 ? p0.w * 2 : p0.w;
                var pctX = (e.offsetX + dom.container.scrollLeft) / (worldW * state.scale);
                var pctY = (e.offsetY + dom.container.scrollTop) / dom.buffer.clientHeight;
                
                state.isZoomed = !state.isZoomed;
                dom.canvas.dispatchEvent(new CustomEvent("layoutChange"));
                
                dom.container.scrollLeft = pctX * (worldW * state.scale) - dom.container.clientWidth / 2;
                dom.container.scrollTop = pctY * dom.buffer.clientHeight - dom.container.clientHeight / 2;
                renderer.requestRender();
            });

            window.addEventListener("resize", function() {
                if (state.mangaData) {
                    dom.canvas.dispatchEvent(new CustomEvent("layoutChange"));
                    renderer.requestRender();
                }
            });
        },
        rebindCanvasEvents: function() {
            // Left intentionally structural; Event Delegation eliminates node binding re-initialization passes completely
        },
        setChapterTitle: function(t) { activeChapterTitle = t; }
    };
}

// --- 5. CENTRAL APPLICATION BOOTSTRAPPER ---
document.addEventListener("DOMContentLoaded", function() {
    var dom = {
        canvas: document.getElementById("mangaCanvas"),
        container: document.getElementById("container"),
        buffer: document.getElementById("scroll-buffer"),
        ui: document.getElementById("ui"),
        next: document.getElementById("next"),
        previous: document.getElementById("previous"),
        settingsEl: document.getElementById("settings"),
        selRead: document.getElementById("selread"),
        chkDebug: document.getElementById("chkdebug"),
        chkWebgl: document.getElementById("chkwebgl"),
        tooltip: (function() {
            var t = document.createElement("div");
            t.id = "manga-tooltip"; t.className = "manga_panel"; t.style.display = "none";
            document.body.appendChild(t);
            return t;
        })()
    };

    var state = createMangaState();
    var renderer = createMangaRenderer(state, dom);
    var network = createProviderManager(state);
    var interaction = createInteractionHandler(state, renderer, dom);

    var providerBase = "";
    var showSettingsMenu = false;
    var worker = null;

    var syncHistoryState = function() {
        var url = state.getHistoryUrl();
        if (window.history.pushState) window.history.pushState("", "", url);
    };

    var computeLayoutGeometry = function() {
        if (!state.mangaData) return;
        var vH = dom.container.clientHeight, vW = dom.container.clientWidth;
        var p0 = state.mangaData.p[0];
        var isMangaMode = state.settings.mode === 0;
        var worldW = isMangaMode ? p0.w * 2 : p0.w;

        state.scale = state.isZoomed ? (vW / p0.w) : Math.min(vW / worldW, vH / p0.h);
        var totalRows = isMangaMode ? Math.ceil(state.mangaData.p.length / 2) : state.mangaData.p.length;
        
        dom.buffer.style.height = (180 + totalRows * (p0.h * state.scale)) + "px";
        dom.buffer.style.width = (worldW * state.scale) + "px";
        
        renderer.invalidateSize();
        renderer.requestRender();
    };

    var refreshFooterUiPosition = function() {
        if (!state.mangaData) return;
        var p0 = state.mangaData.p[0];
        var totalRows = (state.settings.mode === 0) ? Math.ceil(state.mangaData.p.length / 2) : state.mangaData.p.length;
        var contentHeight = totalRows * p0.h * state.scale;
        
        var topPos = ((dom.container.scrollTop > 40 * state.scale) ? (contentHeight - dom.container.scrollTop) + 50 : 20);
        
        dom.previous.style.top = dom.next.style.top = topPos + "px";
        dom.next.style.left = "65%";
        dom.previous.style.left = "30%";
    };

    var updateNavigationTree = function() {
        if (state.currentChapterIdx === -1) {
            dom.previous.style.display = dom.next.style.display = "none";
            return;
        }
        dom.previous.style.display = state.currentChapterIdx > 0 ? "block" : "none";
        dom.next.style.display = state.currentChapterIdx < state.chaptersList.length - 1 ? "block" : "none";
    };

    var executeChapterLoad = async function(chTarget) {
        state.changeChapter(chTarget);
        syncHistoryState();
        state.currentChapterIdx = state.chaptersList.findIndex(function(x) { return x.v == state.volume && x.c == state.chapter; });
        updateNavigationTree();
        dom.container.scrollTop = dom.container.scrollLeft = 0;
        await dispatchLoadPipeline();
    };

    var completeEngineRenderInit = function() {
        dom.container.style.display = "block";
        computeLayoutGeometry();
        dom.container.scrollTop = (state.mangaData.p[0].h * state.scale) * state.startPage;
        renderer.requestRender();
        
        var currentChapter = state.chaptersList[state.currentChapterIdx] || { n: "Unknown", v: state.volume, c: state.chapter };
        var label = '"' + currentChapter.n + '" Vol ' + currentChapter.v + ' Ch ' + currentChapter.c;
        document.title = label;
        interaction.setChapterTitle(label);
        
        dom.ui.innerHTML = '<button id="toggle-settings-btn">Settings</button>';
        document.getElementById("toggle-settings-btn").onclick = function() {
            showSettingsMenu = !showSettingsMenu;
            dom.settingsEl.style.display = showSettingsMenu ? "block" : "none";
        };
        refreshFooterUiPosition();
    };

    var processLoadedPayload = async function(result) {
        state.mangaData = result.data;
        state.imagePool = await renderer.preparePayload(result.blobs);
        state.addToCache(state.mangaData, state.imagePool);
        completeEngineRenderInit();
    };

    var dispatchLoadPipeline = async function() {
        if (state.chaptersList.length === 0) {
            try {
                var resp = await fetch(providerBase + state.manga + "/ch.json");
                state.chaptersList = await resp.json();
            } catch (e) { console.error("Navigation tree manifest structural failure.", e); }
        }

        state.currentChapterIdx = state.chaptersList.findIndex(function(item) {
            return Number(item.v) === Number(state.volume) && Number(item.c) === Number(state.chapter);
        });
        updateNavigationTree();

        var cachedData = state.getFromCache();
        if (cachedData) {
            state.mangaData = cachedData.data;
            state.imagePool = cachedData.images;
            completeEngineRenderInit();
            return;
        }

        var fileUrl = providerBase + state.manga + "/v" + state.volume + "_c" + state.chapter + ".bin";
        if (worker) {
            worker.postMessage({ fileUrl: fileUrl });
        }
    };

    dom.selRead.selectedIndex = state.settings.mode;
    dom.selRead.addEventListener("change", function() {
        state.settings.mode = parseInt(dom.selRead.value, 10);
        syncHistoryState();
        computeLayoutGeometry();
    });

    var bindCheckboxControl = function(element, key, forceReload) {
        element.checked = state.settings[key];
        element.addEventListener("change", function() {
            state.settings[key] = element.checked;
            syncHistoryState();
            if (forceReload) {
                state.addToCache(null, new Map()); 
                dispatchLoadPipeline();
            }
            renderer.requestRender();
        });
    };

    bindCheckboxControl(dom.chkDebug, "debug", false);
    bindCheckboxControl(dom.chkWebgl, "webgl", false);
    
    dom.chkWebgl.addEventListener("change", function() {
        renderer.reloadEngineContext();
    });

    window.addEventListener("canvasReplaced", function() {
        if (dom.canvas) {
            dom.canvas.addEventListener("layoutChange", computeLayoutGeometry);
        }
    });

    dom.previous.onclick = function() { if (state.currentChapterIdx > 0) executeChapterLoad(state.chaptersList[state.currentChapterIdx - 1]); };
    dom.next.onclick = function() { if (state.currentChapterIdx < state.chaptersList.length - 1) executeChapterLoad(state.chaptersList[state.currentChapterIdx + 1]); };

    if (dom.canvas) {
        dom.canvas.addEventListener("layoutChange", computeLayoutGeometry);
    }
    interaction.bindEvents(refreshFooterUiPosition);

    setInterval(function() { renderer.requestRender(); }, 500);

    // --- INSTANTIATE INTERNAL THREAD WORKER EMBED ---
    var workerBlob = new Blob([`
        importScripts('https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js');
        self.onmessage = async function(e) {
            var fileUrl = e.data.fileUrl;
            try {
                var resp = await fetch(fileUrl);
                if (!resp.ok) throw new Error("HTTP " + resp.status);
                var buffer = await resp.arrayBuffer();
                var view = new DataView(buffer);
                var ptr = 0;

                var jsonLen = view.getUint32(ptr, false); ptr += 4;
                var jsonBytes = new Uint8Array(buffer, ptr, jsonLen); ptr += jsonLen;
                var data = JSON.parse(new TextDecoder().decode(pako.inflate(jsonBytes)));

                var blobCount = view.getUint32(ptr, false); ptr += 4;
                var blobs = [];
                for (var i = 0; i < blobCount; i++) {
                    var size = view.getUint32(ptr, false); ptr += 4;
                    var bytes = new Uint8Array(buffer, ptr, size); ptr += size;
                    blobs.push(new Blob([bytes], {type: 'image/webp'}));
                }

                if (data.p) {
                    data.p = data.p.map(function(p) { return { w: p[0], h: p[1], atlasIdx: p[2], chunks: p[3] }; });
                }

                self.postMessage({ success: true, data: data, blobs: blobs });
            } catch (err) {
                self.postMessage({ success: false, error: err.toString() });
            }
        };
    `], { type: "text/javascript" });

    try {
        worker = new Worker(URL.createObjectURL(workerBlob));
        worker.onmessage = function(e) {
            if (e.data.success) {
                processLoadedPayload(e.data);
            } else {
                console.error("Worker processing pipeline broken.", e.data.error);
            }
        };
    } catch(err) {
        console.error("Critical Thread Failure: Web Worker creation blocked.", err);
    }

    network.resolveBase().then(function(base) {
        providerBase = base;
        dispatchLoadPipeline();
    });
});
