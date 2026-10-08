import { prepareBrand } from "/home/brand.js";
prepareBrand();
window.addEventListener("load", () => window.lucide?.createIcons(), {
  once: true,
});
const title = document.getElementById("articleTitle");
const body = document.getElementById("articleBody");
try {
  const slug = new URLSearchParams(location.search).get("post");
  const response = await fetch(`/home/post/${encodeURIComponent(slug || "")}.json`);
  if (!response.ok) throw new Error("Article unavailable");
  const article = await response.json();
  title.textContent = article.title;
  document.title = `${article.title} | 東雲 MEGUMI`;
  document.getElementById("articleMeta").textContent = `${article.date || ""} / JOURNAL`;
  body.innerHTML = article.html;
  for (const table of body.querySelectorAll("table")) {
    const region = document.createElement("div");
    region.className = "article-table";
    region.setAttribute("role", "region");
    region.setAttribute("aria-label", "数据对照表，可横向滚动");
    region.tabIndex = 0;
    table.replaceWith(region);
    region.append(table);
  }
} catch {
  title.textContent = "这篇手记暂时无法读取";
  body.textContent = "请返回首页，或稍后重试。";
}
