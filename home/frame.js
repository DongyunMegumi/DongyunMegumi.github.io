import { setupScrollReveal } from "/scroll-reveal.js";
import { prepareBrand } from "/home/brand.js";
import { setupModelCollection } from "/models/collection.js";
setupScrollReveal();
const brandReady = prepareBrand();
setupOpening(brandReady);
setupModelCollection();
setupAtmosphere();
window.lucide?.createIcons();
window.addEventListener("load", () => window.lucide?.createIcons(), {
  once: true,
});
const menu = document.getElementById("mobileMenu");
const button = document.querySelector(".frame-menu-button");
button.addEventListener("click", () => {
  menu.showModal();
  button.setAttribute("aria-expanded", "true");
});
menu.addEventListener("close", () =>
  button.setAttribute("aria-expanded", "false"),
);
menu
  .querySelector("[data-close]")
  .addEventListener("click", () => menu.close());
menu
  .querySelectorAll("a")
  .forEach((link) => link.addEventListener("click", () => menu.close()));
menu.addEventListener("click", (event) => {
  if (event.target !== menu) return;
  const rect = menu.getBoundingClientRect();
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
    menu.close();
});
const header = document.querySelector(".frame-header");
const hero = document.querySelector(".frame-hero");
new IntersectionObserver(
  ([entry]) => {
    header.classList.toggle("is-visible", !entry.isIntersecting);
    header.inert =
      document.documentElement.classList.contains("intro-pending") ||
      entry.isIntersecting;
  },
  { threshold: 0, rootMargin: "-60px 0px 0px 0px" },
).observe(hero);

function setupOpening(brandReady) {
  const root = document.documentElement;
  if (!root.classList.contains("intro-pending")) return;
  const opening = document.querySelector(".home-opening");
  const skip = opening.querySelector(".opening-skip");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const timers = [];
  const blocked = [
    ...document.querySelectorAll(
      "body > main, body > header, body > footer, body > button, body > a",
    ),
  ];
  let finished = false;
  blocked.forEach((node) => {
    node.dataset.introInert = String(node.inert);
    node.inert = true;
  });
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(window.homeIntroFallback);
    timers.forEach(clearTimeout);
    root.classList.remove("intro-pending", "intro-running", "intro-exiting");
    blocked.forEach((node) => {
      node.inert = node.matches(".frame-header")
        ? !node.classList.contains("is-visible")
        : node.dataset.introInert === "true";
      delete node.dataset.introInert;
    });
    if (opening.contains(document.activeElement))
      document.querySelector("main").focus({ preventScroll: true });
    try {
      sessionStorage.setItem("megumi-home-intro:v1", "seen");
    } catch {}
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("pagehide", finish);
    reduced.removeEventListener("change", onPreference);
  }
  function onKey(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      finish();
    }
    if (event.key === "Tab") {
      event.preventDefault();
      skip.focus({ preventScroll: true });
    }
  }
  function onPreference() {
    if (reduced.matches) finish();
  }
  skip.addEventListener("click", finish, { once: true });
  document.addEventListener("keydown", onKey);
  window.addEventListener("pagehide", finish, { once: true });
  reduced.addEventListener("change", onPreference);
  skip.focus({ preventScroll: true });
  // Bound asset preparation so a slow image never holds the opening screen.
  Promise.race([
    Promise.allSettled([
      brandReady,
      document.querySelector(".frame-art").decode(),
    ]),
    new Promise((resolve) => timers.push(setTimeout(resolve, 1200))),
  ]).then(() => {
    if (finished || !root.classList.contains("intro-pending")) return;
    if (!opening.querySelector("img").naturalWidth) {
      finish();
      return;
    }
    root.classList.add("intro-running");
    timers.push(setTimeout(() => root.classList.add("intro-exiting"), 3000));
    timers.push(setTimeout(finish, 4000));
  });
}

function setupAtmosphere() {
  const layer = document.querySelector(".frame-atmosphere");
  const toggle = document.querySelector(".atmosphere-toggle");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let paused = false;
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 24; index++) {
    const bubble = document.createElement("span");
    bubble.className = "frame-bubble";
    bubble.style.setProperty("--x", `${(index * 37 + 9) % 98}%`);
    bubble.style.setProperty("--size", `${[5, 8, 18, 6, 11, 22][index % 6]}px`);
    bubble.style.setProperty("--duration", `${20 + ((index * 7) % 15)}s`);
    bubble.style.setProperty("--delay", `${-((index * 11 + 3) % 34)}s`);
    bubble.style.setProperty("--drift", `${index % 2 ? -18 : 18}px`);
    bubble.style.setProperty("--rest", `${-((index * 17 + 12) % 95)}svh`);
    fragment.append(bubble);
  }
  layer.append(fragment);
  function syncMotion() {
    layer.dataset.paused = String(paused || reduced.matches || document.hidden);
    toggle.hidden = reduced.matches;
    toggle.setAttribute("aria-pressed", String(paused));
    const label = paused ? "播放背景泡泡" : "暂停背景泡泡";
    toggle.setAttribute("aria-label", label);
    toggle.title = label;
  }
  toggle.addEventListener("click", () => {
    paused = !paused;
    syncMotion();
  });
  reduced.addEventListener("change", syncMotion);
  document.addEventListener("visibilitychange", syncMotion);
  syncMotion();
}
