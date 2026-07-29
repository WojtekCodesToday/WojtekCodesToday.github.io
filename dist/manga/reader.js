export default {
  title: "reader",
  css: "/manga/manga.css",
  render: () => {
    return roost.convertJSX(roost.convertJSX, null, roost.convertJSX("div", {
      id: "ui",
      className: "manga_panel"
    }, "loading..."), roost.convertJSX("div", {
      id: "container"
    }, roost.convertJSX("canvas", {
      id: "mangaCanvas"
    }, " "), roost.convertJSX("div", {
      id: "scroll-buffer"
    }, " ")), roost.convertJSX("div", {
      id: "nav-footer",
      className: "chapterbtns",
      style: {
        display: "none"
      }
    }, roost.convertJSX("button", {
      id: "previous",
      className: "chapter_button",
      style: {
        display: "none"
      }
    }, "Previous chapter"), roost.convertJSX("button", {
      id: "next",
      className: "chapter_button",
      style: {
        display: "none"
      }
    }, "Next chapter")), roost.convertJSX("div", {
      id: "settings",
      className: "manga_panel",
      style: {
        display: "none"
      }
    }, roost.convertJSX("h2", null, "Settings"), roost.convertJSX("label", {
      htmlFor: "selread"
    }, "Reading mode:"), roost.convertJSX("select", {
      id: "selread"
    }, roost.convertJSX("option", {
      value: "0"
    }, "On two pages"), roost.convertJSX("option", {
      value: "1"
    }, "Comic strip")), roost.convertJSX("hr", null), roost.convertJSX("h3", null, "Other"), roost.convertJSX("input", {
      type: "checkbox",
      name: "chkwebgl",
      id: "chkwebgl"
    }), roost.convertJSX("label", {
      htmlFor: "chkwebgl"
    }, "Enable WebGL slow if disabled"), roost.convertJSX("br", null), roost.convertJSX("input", {
      type: "checkbox",
      name: "chkdebug",
      id: "chkdebug"
    }), roost.convertJSX("label", {
      htmlFor: "chkdebug"
    }, "Debug mode")));
  },
  mount: async () => {
    await loadScript("https://cdn.jsdelivr.net/gh/jagenjo/Canvas2DtoWebGL/src/gl-matrix-min.js");
    await loadScript("https://cdn.jsdelivr.net/gh/jagenjo/Canvas2DtoWebGL/src/litegl.min.js");
    await loadScript("https://cdn.jsdelivr.net/gh/jagenjo/Canvas2DtoWebGL/src/Canvas2DtoWebGL.js");
    await loadScript("/manga/reader_js.js");
  }
};