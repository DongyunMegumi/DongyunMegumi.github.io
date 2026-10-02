import { setupScrollReveal } from "/scroll-reveal.js";
import { prepareBrand } from "/home/brand.js";
import { setupModelCollection } from "/models/collection.js";
setupScrollReveal();
prepareBrand();
document.addEventListener("model-category-change", (event) => {
  const isGame = event.detail.category === "game";
  document.querySelector(".process-entry").hidden = isGame;
  document.querySelector("[data-process-plans]").hidden =
    event.detail.category === "vtuber";
  document.querySelector("[data-process-description]").hidden = isGame;
  document.querySelector("[data-collection-credit]").hidden =
    event.detail.category !== "vtuber";
  document.querySelector("[data-collection-total]").textContent =
    event.detail.count;
});
setupModelCollection();
window.addEventListener("load", () => window.lucide?.createIcons(), {
  once: true,
});
