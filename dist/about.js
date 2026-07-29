import { page } from "./_page.js";
export default {
  title: "About",
  render: () => {
    return roost.convertJSX(roost.convertJSX, null, roost.convertJSX("h1", null, "About Page"), roost.convertJSX("p", null, "This was loaded without refreshing the page!"), roost.convertJSX("a", {
      href: "/"
    }, "Go back Home"), roost.convertJSX("a", {
      href: "/test.html"
    }, "Go back nowhere"));
  }
};