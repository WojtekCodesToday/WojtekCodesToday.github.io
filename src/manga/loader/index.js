// ---------------------------------------------------------------------------
// Web Worker entry point: fetch a chapter file, parse it, hand back pages.
//
// This is a MODULE worker - it must be constructed as
//     new Worker("/manga/loader/index.js", { type: "module" })
// because importScripts() cannot load ES modules.
// ---------------------------------------------------------------------------

import pako from "https://cdn.jsdelivr.net/npm/pako@2.1.0/+esm";
import { sniffBytes } from "./bytes.js";
import { isMpsMagic, parseMpsFile, parseLegacyBin } from "./mps.js";

// png.js and mps.js reach for self.pako, matching the old global-script setup.
self.pako = pako;

self.onmessage = async (event) => {
    const { fileUrl } = event.data;
    let buffer = null;

    try {
        const response = await fetch(fileUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} while fetching ${fileUrl}`);
        }

        buffer = await response.arrayBuffer();
        const u8 = new Uint8Array(buffer);
        console.log("loader fetched:", fileUrl, "size:", buffer.byteLength);

        const result = isMpsMagic(u8) ? parseMpsFile(buffer) : parseLegacyBin(buffer);
        self.postMessage({ success: true, data: result.data, blobs: result.blobs });
    } catch (err) {
        self.postMessage({
            success: false,
            error: [
                `URL: ${fileUrl}`,
                `Size: ${buffer ? buffer.byteLength : "no buffer"}`,
                `Header: ${buffer ? sniffBytes(buffer) : "no header"}`,
                `Name: ${err?.name ?? "Error"}`,
                `Message: ${err?.message ?? String(err)}`,
                `Stack:\n${err?.stack ?? ""}`,
            ].join("\n"),
        });
    }
};
