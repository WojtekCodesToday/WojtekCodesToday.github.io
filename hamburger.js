import roost from "https://cdn.jsdelivr.net/gh/WojtekCodesToday/roostjs@master/roost.min.mjs"

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
    const f = "return false;";
    
    const navbar = {
        "div-nav": {
            class: "manga_panel nav",
            style: "display: flex; align-items: center;",
            child: {
                "div-ham": {
                    id: "ham",
                    child: "≡",
                    onclick: "window.hamburger_click()",
                    onmousedown: f,
                    onselectstart: f
                },
                "div-content": {
                    id: "ham_content",
                    style: "display: none; align-items: center; margin-left: 10px;",
                    child: {
                        "button-home": { 
                            child: "home", 
                            onclick: "window.location.href='/'" 
                        },
                        "button-blog": { 
                            child: "blog", 
                            onclick: "window.location.href='/blog'" 
                        },
                        "button-manga": { 
                            child: "manga", 
                            onclick: "window.location.href='/manga'" 
                        },
                        "button-theme": { 
                            child: "toggle theme", 
                            onclick: "theme_toggle()" 
                        }
                    }
                }
            }
        }
    };

    const navContainer = document.createElement("div");
    navContainer.innerHTML = roost.convert(navbar);

    const actualNav = navContainer.firstElementChild;
    document.body.prepend(actualNav);
}

const css = document.createElement("link");
css.rel = "stylesheet";
css.href = window.location.origin + "/hamburger.css";
document.head.appendChild(css);

document.addEventListener("DOMContentLoaded", hamburger);