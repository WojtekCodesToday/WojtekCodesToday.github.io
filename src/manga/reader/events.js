// ---------------------------------------------------------------------------
// Tiny in-app event bus.
//
// The old code signalled layout changes with
//     dom.canvas.dispatchEvent(new CustomEvent("canvasReplaced"))
// and listened on `window`. CustomEvent does not bubble unless you ask it to,
// so those listeners never fired. Rather than sprinkling { bubbles: true }
// around, app-internal signals go through here - they are not DOM concerns.
// ---------------------------------------------------------------------------

export function createEventBus() {
    const handlers = new Map();

    return {
        on(name, handler) {
            if (!handlers.has(name)) handlers.set(name, new Set());
            handlers.get(name).add(handler);
            return () => handlers.get(name)?.delete(handler);
        },

        emit(name, payload) {
            for (const handler of handlers.get(name) ?? []) {
                try {
                    handler(payload);
                } catch (err) {
                    console.error(`Handler for "${name}" threw.`, err);
                }
            }
        },

        clear() {
            handlers.clear();
        },
    };
}
