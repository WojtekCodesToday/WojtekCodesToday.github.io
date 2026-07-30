// hamburger.js
let ham_toggle = true;

window.hamburger_click = () => {
    const ham_div = document.querySelector('.nav.manga_panel');
    const ham_content = document.getElementById('ham_content');
    ham_toggle = !ham_toggle;

    if (ham_div && ham_content) {
        ham_div.style.width = ham_toggle ? "20px" : "auto";
        ham_content.style.display = ham_toggle ? "none" : "block";
    }
};

function NavButton({ title, path }) {
    return <button onclick={`loadRoute('${path}')`}>{title}</button>;
}

function hamburger() {
    // Prevent duplicate rendering
    if (document.getElementById('ham_content')) return;

    const f = "return false;";

    const navbar = (
        <div class="manga_panel nav" style="display: flex; align-items: center;">
            <div
                id="ham"
                onclick="window.hamburger_click()"
                onmousedown={f}
                onselectstart={f}
            >
                ≡
            </div>
            <div id="ham_content" style="display: none; align-items: center; margin-left: 10px;">
                <NavButton title="home" path="/" />
                <NavButton title="blog" path="/blog" />
                <NavButton title="manga" path="/manga" />
                <NavButton title="art" path="/art" />
                <button onclick="theme_toggle()">toggle theme</button>
            </div>
        </div>
    );

    const navContainer = document.createElement("div");
    navContainer.innerHTML = roost.convert(navbar);

    const actualNav = navContainer.firstElementChild;
    if (actualNav) {
        document.body.prepend(actualNav);
    }
}

// Inject CSS
const css = document.createElement("link");
css.rel = "stylesheet";
css.href = "/hamburger.css";
document.head.appendChild(css);

// Automatically mount when DOM loads
document.addEventListener("DOMContentLoaded", hamburger);
