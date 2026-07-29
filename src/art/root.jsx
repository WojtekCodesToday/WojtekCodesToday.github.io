const ART_STYLE = `
.art-grid {
    column-count: 4;
    column-gap: 15px;
    width: 100%;
}

@media (max-width: 1024px) {
    .art-grid {
        column-count: 2;
    }
}

@media (max-width: 500px) {
    .art-grid {
        column-count: 1;
        column-gap: 0;
    }
}

.art-item {
    position: relative;
    display: inline-block;
    width: 100%;
    margin-bottom: 15px;
    overflow: hidden;
    background-color: #000;
}

.art-item img {
    width: 100%;
    height: auto;
    display: block;
    pointer-events: none;
}

.art-item:hover img {
    opacity: 0.3;
    filter: grayscale(30%);
}

.art-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;

    padding: 10px;
    box-sizing: border-box;

    opacity: 0;
    pointer-events: none;
}

.art-item:hover .art-overlay {
    opacity: 1;
}

.art-btn {
    pointer-events: auto;
    cursor: pointer;
}

.art-btn:hover {
    background: #ffffff;
    color: #000000;
}
`;

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

function art_display_all(json) {
    const container = document.getElementById("art_container");

    if (!container) {
        console.error("art_container not found");
        return;
    }

    container.innerHTML = "";

    json.forEach((element) => {
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

        const imageSource =
            parsedLinks.length > 0
                ? parsedLinks[0].url
                : fallbackUrl;

        if (!imageSource) return;

        const artItem = document.createElement("div");
        artItem.className = "art-item";

        const img = document.createElement("img");
        img.src = imageSource;
        img.loading = "lazy";
        img.alt = "Artwork";

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
        container.appendChild(artItem);
    });
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

    // your base index already loads /style.css and /index.css,
    // so this route only needs blog.css
    css: "/blog.css",

    render: () => {
        return (
            <>
                <style>{ART_STYLE}</style>

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
    }
};