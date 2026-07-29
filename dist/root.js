import { page } from "./_page.js";
export default {
  title: "hom",
  render: () => {
    return roost.convertJSX(roost.convertJSX, null, roost.convertJSX("div", {
      id: "page"
    }, roost.convertJSX("div", {
      class: "manga_panel"
    }, "Hello, i'm Wojtek. And i'm a programmer and a (hopefully(?) future) mangaka.", roost.convertJSX("br", null), roost.convertJSX("br", null), "I might share my manga in this website, hopefully updated...", roost.convertJSX("br", null), " ", roost.convertJSX("br", null), "I will also use this as my personal website, so anyone visiting, thanks.", roost.convertJSX("br", null), " ", roost.convertJSX("br", null), roost.convertJSX("img", {
      src: "https://unavatar.io/x/wojtekgame",
      onerror: "this.onerror=null; this.src='';"
    }))));
  }
};