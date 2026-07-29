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

function hamburger() {
    // Prevent duplicate rendering
    if (document.getElementById('ham_content')) return;

    const f = "return false;";
    
    // 1. Create a simple JS function that returns JSX.
    // It accepts arguments just like React props!
    const NavButton = (title, path) => (
        <button onclick={`window.loadRoute('${path}')`}>{title}</button>
    );

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
                {/* 2. Call the function directly to inject the converted Roost JSON */}
                { NavButton("home", "/") }
                { NavButton("blog", "/blog") }
                { NavButton("manga", "/manga") }
                { NavButton("art", "/art") }
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