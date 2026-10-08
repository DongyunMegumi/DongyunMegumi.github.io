import { prepareBrand } from "/home/brand.js";
import { setupScrollReveal } from "/scroll-reveal.js";
prepareBrand();
setupScrollReveal();
window.lucide?.createIcons();
window.addEventListener("load", () => window.lucide?.createIcons(), {
  once: true,
});
const links = [...document.querySelectorAll(".order-index a")];
const observer = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!visible) return;
    links.forEach((link) => {
      if (link.hash === "#" + visible.target.id)
        link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  },
  { rootMargin: "-10% 0px -65% 0px" },
);
document
  .querySelectorAll(".order-content section")
  .forEach((section) => observer.observe(section));
