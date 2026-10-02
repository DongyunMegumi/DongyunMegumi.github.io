import { prepareBrand } from "/home/brand.js";
prepareBrand();
window.addEventListener("load", () => window.lucide?.createIcons(), {
  once: true,
});
const title = document.getElementById("articleTitle");
const body = document.getElementById("articleBody");
try {
  const slug = new URLSearchParams(location.search).get("post");
  const response = await fetch(`/home/post/${encodeURIComponent(slug || "")}`);
  if (!response.ok) throw new Error("Article unavailable");
  const article = await response.json();
  title.textContent = article.title;
  document.title = `${article.title} | 東雲 MEGUMI`;
  document.getElementById("articleMeta").textContent = "2026.08.30 / JOURNAL";
  body.innerHTML = article.html;
} catch {
  title.textContent = "这篇手记暂时无法读取";
  body.textContent = "请返回首页，或稍后重试。";
}
