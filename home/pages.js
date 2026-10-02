import { prepareBrand } from "/home/brand.js";
import { setupScrollReveal } from "/scroll-reveal.js";
prepareBrand();
setupScrollReveal();
window.lucide?.createIcons();
window.addEventListener("load", () => window.lucide?.createIcons(), {
  once: true,
});
document.querySelectorAll(".page-header nav a").forEach((link) => {
  if (new URL(link.href).pathname === location.pathname)
    link.setAttribute("aria-current", "page");
});
