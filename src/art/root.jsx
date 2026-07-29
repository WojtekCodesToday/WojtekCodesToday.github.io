const PLATFORMS = {
    twitter: {
        label: "Twitter / X",
        urlFunc: (id) => `https://d.fxtwitter.com/i/status/${id}`,
        srcFunc: (id) => `https://x.com/i/status/${id}`,
        priority: 1
    },
    postimg: {
        label: "Postimage",
        urlFunc: (path) => `https://i.postimg.cc/${path}`,
        srcFunc: (path) => `https://i.postimg.cc/${path}`,
        priority: 2
    },
    discord: {
        label: "Discord",
        urlFunc: (path) => `https://cdn.discordapp.com/attachments/${path}`,
        srcFunc: (path) => `https://cdn.discordapp.com/attachments/${path}`,
        priority: 3
    }
};

// --- LAZY / BATCH LOGIC ---
let artCache = [];
let displayedCount = 0;
const BATCH_SIZE = 20;
let imgObserver = null;
let sentinelObserver = null;
let sentinelEl = null;

function parseElement(element) {
    const entries = Object.entries(element);
    let parsedLinks = [];
    let fallbackUrl = "";

    entries.forEach(([key, value]) => {
        if (PLATFORMS[key]) {
            parsedLinks.push({
                label: PLATFORMS[key].label,
                url: PLATFORMS[key].urlFunc(value),
                src: PLATFORMS[key].srcFunc(value),
                priority: PLATFORMS[key].priority
            });
        } else {
            fallbackUrl = value;
        }
    });

    parsedLinks.sort((a, b) => a.priority - b.priority);

    const imageSource = parsedLinks.length > 0 ? parsedLinks[0].url : fallbackUrl;

    return { parsedLinks, fallbackUrl, imageSource };
}

function createArtItemNode(element) {
    const { parsedLinks, fallbackUrl, imageSource } = parseElement(element);
    if (!imageSource) return null;

    const artItem = document.createElement("div");
    artItem.className = "art-item";

    const img = document.createElement("img");
    // tiny placeholder, real src goes to data-src
    img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3C/svg%3E";
    img.dataset.src = imageSource;
    img.dataset.index = "0";
    img.dataset.links = JSON.stringify(parsedLinks);
    if (fallbackUrl) img.dataset.fallback = fallbackUrl;
    img.alt = "Artwork";
    img.loading = "lazy";
    img.decoding = "async";
    img.className = "is-loading";

    img.onerror = () => {
        // try next fallback link if current fails
        let idx = parseInt(img.dataset.index || "0", 10) + 1;
        const links = JSON.parse(img.dataset.links || "[]");
        if (idx < links.length) {
            img.dataset.index = String(idx);
            img.dataset.src = links[idx].url;
            // re-observe to load immediately
            if (imgObserver) imgObserver.observe(img);
            else img.src = links[idx].url;
        } else if (img.dataset.fallback && img.src !== img.dataset.fallback) {
            img.src = img.dataset.fallback;
        } else {
            img.style.display = "none";
        }
    };

    img.onload = () => {
        img.classList.remove("is-loading");
        img.classList.add("is-loaded");
    };

    artItem.appendChild(img);

    const overlay = document.createElement("div");
    overlay.className = "art-overlay";

    parsedLinks.forEach((linkInfo) => {
        const btn = document.createElement("button");
        btn.className = "art-btn";
        btn.textContent = linkInfo.label;
        btn.onclick = () => {
            window.open(linkInfo.src, "_blank");
        };
        overlay.appendChild(btn);
    });

    if (parsedLinks.length === 0 && fallbackUrl) {
        const generalBtn = document.createElement("button");
        generalBtn.className = "art-btn";
        generalBtn.textContent = "View Link";
        generalBtn.onclick = () => {
            window.open(fallbackUrl, "_blank");
        };
        overlay.appendChild(generalBtn);
    }

    artItem.appendChild(overlay);
    return artItem;
}

function onImgIntersect(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            const realSrc = img.dataset.src;
            if (realSrc && img.src !== realSrc && !realSrc.startsWith('data:')) {
                img.src = realSrc;
            }
            imgObserver.unobserve(img);
        }
    });
}

function renderNextBatch() {
    const container = document.getElementById("art_container");
    if (!container) return;
    if (displayedCount >= artCache.length) {
        if (sentinelEl) sentinelEl.style.display = "none";
        if (sentinelObserver) sentinelObserver.disconnect();
        return;
    }

    const fragment = document.createDocumentFragment();
    const next = Math.min(displayedCount + BATCH_SIZE, artCache.length);

    for (let i = displayedCount; i < next; i++) {
        const node = createArtItemNode(artCache[i]);
        if (node) {
            fragment.appendChild(node);
            const img = node.querySelector('img');
            if (img && imgObserver) imgObserver.observe(img);
        }
    }

    displayedCount = next;
    container.appendChild(fragment);

    // move sentinel to bottom
    if (sentinelEl) container.appendChild(sentinelEl);
}

function art_display_all(json) {
    const container = document.getElementById("art_container");
    if (!container) {
        console.error("art_container not found");
        return;
    }

    container.innerHTML = "";
    artCache = json;
    displayedCount = 0;

    // cleanup old observers
    if (imgObserver) imgObserver.disconnect();
    if (sentinelObserver) sentinelObserver.disconnect();

    imgObserver = new IntersectionObserver(onImgIntersect, {
        root: null,
        rootMargin: "600px 0px",
        threshold: 0.01
    });

    // sentinel for infinite scroll
    sentinelEl = document.createElement("div");
    sentinelEl.id = "art-sentinel";

    sentinelObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                renderNextBatch();
            }
        });
    }, {
        root: null,
        rootMargin: "400px 0px",
        threshold: 0
    });

    renderNextBatch();
    sentinelObserver.observe(sentinelEl);
}

async function art_get_all() {
    try {
        const response = await fetch("/art/arts.json");
        if (!response.ok) {
            throw new Error(`arts.json: ${response.status}`);
        }
        const result = await response.json();
        art_display_all(result);
    } catch (error) {
        console.error(error.message);
    }
}

export default {
    title: "Art",
    css: "/blog.css",
    render: () => {
        return (
            <>
                <link rel="stylesheet" href="art/art.css" />
                <div id="page">
                    <div className="manga_panel" id="art">
                        <h1>Art</h1>
                        I won't be surprised if they suddenly dissapear or even worse...
                        <br />
                        Some of these are put to Postimages by myself incase it's gone,
                        i hope they're fine with that...
                        <br />
                        <a href="/manga">
                            For extra look at what i've made
                        </a>
                        <br />
                        <br />
                        <div id="art_container" className="art-grid"> </div>
                    </div>
                </div>
            </>
        );
    },

    mount: async () => {
        await art_get_all();
    },

    unmount: () => {
        if (imgObserver) imgObserver.disconnect();
        if (sentinelObserver) sentinelObserver.disconnect();
        artCache = [];
        displayedCount = 0;
    }
};
