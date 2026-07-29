import "../lib/roost-ext-md.js";
function getBlogQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("q")?.toLowerCase() || "";
}
function renderPostList(posts, content) {
  if (posts.length === 0) {
    content.innerHTML = "<p>No posts found yet.</p>";
    return;
  }
  const listObj = {};
  posts.forEach((post, i) => {
    listObj[`div-${i}`] = {
      class: "manga_panel",
      style: "margin-bottom:15px; cursor:pointer; display:flex; align-items:center;",
      child: {
        [`span-${i}`]: {
          child: "> ",
          style: "font-weight:bold; margin-right:10px;"
        },
        [`a-${i}`]: {
          href: `/blog/?q=${encodeURIComponent(post)}`,
          child: post.replace(/-/g, " ").toUpperCase(),
          style: "text-decoration:none; border-width:0px; background-color:inherit; color:inherit; flex-grow:1;"
        }
      }
    };
  });
  content.innerHTML = `<h2>blogs ive made so far</h2>${roost.convert(listObj)}`;
}
async function loadPostList(content) {
  try {
    const res = await fetch("/blog/list.json");
    if (!res.ok) {
      throw new Error(`list.json: ${res.status}`);
    }
    const posts = await res.json();
    renderPostList(posts, content);
  } catch (error) {
    console.error(error);
    content.innerHTML = "<p>Could not load blog list.</p>";
  }
}
async function loadBlogPost(q, content) {
  try {
    const res = await fetch(`/blog/${q}.md`);
    if (!res.ok) {
      throw new Error(`blog post not found: ${q}`);
    }
    const markdown = await res.text();
    const parsed = roost.extensions.md.parse(markdown);
    content.innerHTML = roost.convert(parsed);
    document.title = q;
  } catch (error) {
    console.error(error);
    content.innerHTML = "<h1>404</h1><p>blog post redacted or lost.</p>";
  }
}
export default {
  title: "Blog",
  css: "/blog.css",
  render: () => {
    return roost.convertJSX(roost.convertJSX, null, roost.convertJSX("div", {
      id: "page"
    }, roost.convertJSX("main", {
      id: "content",
      className: "manga_panel blog_post"
    })));
  },
  mount: async () => {
    const content = document.getElementById("content");
    if (!content) {
      console.error("blog content element not found");
      return;
    }
    const backHome = document.getElementById("back-home");
    if (backHome) {
      backHome.addEventListener("click", () => {
        history.pushState(null, "", "/");
        window.loadRoute("/");
      });
    }
    const q = getBlogQuery();
    console.log(q);
    if (!q) {
      await loadPostList(content);
    } else {
      await loadBlogPost(q, content);
    }
  }
};