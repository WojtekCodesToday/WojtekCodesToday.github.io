// ---------------------------------------------------------------------------
// Pure geometry. No DOM, no state mutation - so it can be reasoned about and
// tested on its own. Both the renderer and the hit-tester use these, which is
// what keeps "what's drawn" and "what's clickable" in agreement.
// ---------------------------------------------------------------------------

import { MODE_SPREAD } from "./state.js";

export const TOP_MARGIN = 130; // scaled gap above the first row
export const OVERSCAN = 400; // px drawn beyond the viewport

export const isSpread = (settings) => settings.mode === MODE_SPREAD;

/** Pages per row: 2 in spread mode, 1 otherwise. */
export const pagesPerRow = (settings) => (isSpread(settings) ? 2 : 1);

export const rowCount = (mangaData, settings) =>
    Math.ceil(mangaData.p.length / pagesPerRow(settings));

/** Page indices that make up a given row. */
export const pagesInRow = (row, settings) =>
    isSpread(settings) ? [row * 2, row * 2 + 1] : [row];

/**
 * In spread mode even-indexed pages sit on the right (right-to-left reading).
 */
export const isRightPage = (index, settings) => isSpread(settings) && index % 2 === 0;

/** Everything the drawing/hit-testing code needs about current dimensions. */
export function computeMetrics(mangaData, settings, scale, viewportWidth) {
    const first = mangaData.p[0];
    const worldWidth = first.w * pagesPerRow(settings);
    const spreadWidth = worldWidth * scale;

    return {
        pageWidth: first.w,
        pageHeight: first.h,
        worldWidth,
        spreadWidth,
        rowHeight: first.h * scale,
        centerOffset: Math.max(0, (viewportWidth - spreadWidth) / 2),
        topOffset: TOP_MARGIN * scale,
    };
}

/** Scale that fits the content to the viewport (or one page when zoomed). */
export function fitScale(mangaData, settings, isZoomed, viewportWidth, viewportHeight) {
    const first = mangaData.p[0];
    const worldWidth = first.w * pagesPerRow(settings);

    return isZoomed
        ? viewportWidth / first.w
        : Math.min(viewportWidth / worldWidth, viewportHeight / first.h);
}

/** Row range worth drawing for the current scroll position. */
export function visibleRows(metrics, scrollTop, viewportHeight, totalRows) {
    return {
        start: Math.max(0, Math.floor((scrollTop - OVERSCAN) / metrics.rowHeight)),
        end: Math.min(totalRows, Math.ceil((scrollTop + viewportHeight + OVERSCAN) / metrics.rowHeight)),
    };
}

/** Top-left corner of a page, in viewport coordinates. */
export function pageOrigin(index, row, metrics, settings, scale, scrollLeft, scrollTop) {
    const x = (isRightPage(index, settings) ? metrics.pageWidth * scale : 0)
        - scrollLeft + metrics.centerOffset;
    const y = row * metrics.rowHeight - scrollTop + metrics.topOffset;
    return { x, y };
}

/**
 * Inverse of pageOrigin: viewport point -> page index + page-local coords.
 * Returns null outside the content.
 */
export function hitTestPoint(mouseX, mouseY, mangaData, settings, scale, metrics, scrollLeft, scrollTop) {
    const absoluteX = mouseX + scrollLeft - metrics.centerOffset;
    const absoluteY = mouseY + scrollTop - metrics.topOffset;

    const row = Math.floor(absoluteY / metrics.rowHeight);
    if (row < 0 || row >= rowCount(mangaData, settings)) return null;

    const localY = (absoluteY - row * metrics.rowHeight) / scale;

    return pagesInRow(row, settings)
        .map((index) => {
            const page = mangaData.p[index];
            if (!page) return null;
            const offsetX = isRightPage(index, settings) ? metrics.pageWidth * scale : 0;
            return { page, x: (absoluteX - offsetX) / scale, y: localY };
        })
        .filter(Boolean);
}
