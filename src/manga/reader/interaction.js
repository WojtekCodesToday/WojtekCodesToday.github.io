// ---------------------------------------------------------------------------
// Pointer / keyboard input: drag-scrolling, hover tooltips, link clicks, zoom.
// ---------------------------------------------------------------------------

import { computeMetrics, hitTestPoint } from "./layout.js";
import { CHUNK_URL, CHUNK_NOTE } from "./renderer.js";

const DRAG_DIVISOR_MOUSE = 1.8;
const DRAG_DIVISOR_TOUCH = 2;
const CLICK_SLOP = 5; // px of movement still counted as a click

const coordsOf = (event) =>
    event.touches?.[0]
        ? { x: event.touches[0].pageX, y: event.touches[0].pageY }
        : { x: event.pageX, y: event.pageY };

export function createInteractionHandler(state, renderer, dom, events) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;

    const metrics = () =>
        computeMetrics(state.mangaData, state.settings, state.scale, dom.container.clientWidth);

    /** Topmost URL/NOTE chunk under a viewport point, or null. */
    function metadataAt(mouseX, mouseY) {
        if (!state.mangaData) return null;

        const hits = hitTestPoint(
            mouseX, mouseY, state.mangaData, state.settings, state.scale,
            metrics(), dom.container.scrollLeft, dom.container.scrollTop
        );
        if (!hits) return null;

        for (const { page, x, y } of hits) {
            for (const chunk of page.chunks) {
                const [type, cx, cy, cw, ch, payload] = chunk;
                if (type < CHUNK_URL) continue;
                if (x >= cx && x <= cx + cw && y >= cy && y <= cy + ch) {
                    return { type, data: payload };
                }
            }
        }
        return null;
    }

    function showTooltip(text, event) {
        dom.tooltip.innerText = text;
        dom.tooltip.style.display = "block";
        dom.tooltip.style.left = `${event.clientX + 15}px`;
        dom.tooltip.style.top = `${event.clientY + 15}px`;
    }

    const hideTooltip = () => {
        dom.tooltip.style.display = "none";
    };

    function onHover(event) {
        if (event.target !== dom.canvas) {
            dom.canvas.style.cursor = "grab";
            hideTooltip();
            return;
        }

        const rect = dom.canvas.getBoundingClientRect();
        const localX = event.offsetX ?? event.pageX - rect.left;
        const localY = event.offsetY ?? event.pageY - rect.top;
        const hit = metadataAt(localX, localY);

        if (!hit) {
            dom.canvas.style.cursor = "grab";
            hideTooltip();
            return;
        }

        dom.canvas.style.cursor = hit.type === CHUNK_URL ? "pointer" : "help";
        if (hit.type === CHUNK_NOTE) showTooltip(hit.data, event);
        else hideTooltip();
    }

    function onDragStart(event) {
        if (event.target !== dom.canvas) return;
        dragging = true;

        const { x, y } = coordsOf(event);
        startX = x - dom.canvas.offsetLeft;
        startY = y - dom.canvas.offsetTop;
        startScrollLeft = dom.container.scrollLeft;
        startScrollTop = dom.container.scrollTop;
    }

    function onDragMove(event) {
        if (!dom.canvas) return;
        if (!dragging) {
            onHover(event);
            return;
        }

        dom.canvas.style.cursor = "grabbing";
        if (event.cancelable) event.preventDefault();

        const { x, y } = coordsOf(event);
        const divisor = event.touches ? DRAG_DIVISOR_TOUCH : DRAG_DIVISOR_MOUSE;
        const dx = (startX - (x - dom.canvas.offsetLeft)) / divisor;
        const dy = (startY - (y - dom.canvas.offsetTop)) / divisor;

        const maxLeft = dom.buffer.clientWidth - dom.container.clientWidth;
        const maxTop = dom.buffer.clientHeight - dom.container.clientHeight;
        dom.container.scrollLeft = Math.max(0, Math.min(startScrollLeft + dx, maxLeft));
        dom.container.scrollTop = Math.max(0, Math.min(startScrollTop + dy, maxTop));

        renderer.requestRender();
    }

    function onDragEnd() {
        dragging = false;
        if (dom.canvas) dom.canvas.style.cursor = "grab";
        renderer.requestRender();
    }

    function onClick(event) {
        if (event.target !== dom.canvas) return;
        if (Math.abs(startX - (event.pageX - dom.canvas.offsetLeft)) >= CLICK_SLOP) return;

        const rect = dom.canvas.getBoundingClientRect();
        const hit = metadataAt(event.clientX - rect.left, event.clientY - rect.top);
        if (hit?.type === CHUNK_URL) window.open(hit.data, "_blank", "noopener");
    }

    /** Double click toggles zoom, keeping the clicked point roughly centred. */
    function onDoubleClick(event) {
        if (event.target !== dom.canvas || !state.mangaData) return;

        const before = metrics();
        const pctX = (event.offsetX + dom.container.scrollLeft) / before.spreadWidth;
        const pctY = (event.offsetY + dom.container.scrollTop) / dom.buffer.clientHeight;

        state.isZoomed = !state.isZoomed;
        events.emit("layoutChange");

        const after = metrics();
        dom.container.scrollLeft = pctX * after.spreadWidth - dom.container.clientWidth / 2;
        dom.container.scrollTop = pctY * dom.buffer.clientHeight - dom.container.clientHeight / 2;
        renderer.requestRender();
    }

    return {
        bindEvents(onScrollChange, signal) {
            const scrolled = () => {
                renderer.requestRender();
                onScrollChange?.();
            };

            // dom.container is rebuilt with #root's innerHTML on every route
            // change, so its listeners die with the element. Only window and
            // document listeners need the abort signal.
            dom.container.addEventListener("wheel", (event) => {
                event.preventDefault();
                dom.container.scrollTop += event.deltaY;
                scrolled();
            }, { passive: false });

            dom.container.addEventListener("mousedown", onDragStart);
            dom.container.addEventListener("touchstart", onDragStart, { passive: false });
            dom.container.addEventListener("click", onClick);
            dom.container.addEventListener("dblclick", onDoubleClick);

            window.addEventListener("mousemove", onDragMove, { signal });
            window.addEventListener("touchmove", onDragMove, { passive: false, signal });
            window.addEventListener("mouseup", onDragEnd, { signal });
            window.addEventListener("touchend", onDragEnd, { signal });

            window.addEventListener("keydown", (event) => {
                if (event.key === "PrintScreen" || (event.ctrlKey && "sp".includes(event.key))) {
                    event.preventDefault();
                }
                if (state.isZoomed) return;

                const down = event.key === "ArrowDown" || event.key === "PageDown";
                const up = event.key === "ArrowUp" || event.key === "PageUp";
                if (!down && !up) return;

                event.preventDefault();
                dom.container.scrollTop += down
                    ? dom.container.clientHeight
                    : -dom.container.clientHeight;
                scrolled();
            }, { signal });

            window.addEventListener("resize", () => {
                if (state.mangaData) {
                    events.emit("layoutChange");
                    renderer.requestRender();
                }
            }, { signal });
        },
    };
}
