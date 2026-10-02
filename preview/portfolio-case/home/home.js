import { setupScrollReveal } from "/scroll-reveal.js";

setupScrollReveal();
const menu = document.getElementById("mobileMenu");
const about = document.getElementById("aboutDialog");
const menuButton = document.querySelector(".menu-button");
function icons() {
  window.lucide?.createIcons();
}
icons();
window.addEventListener("load", icons, { once: true });

async function prepareWordmark() {
  const image = document.querySelector(".wordmark-art");
  if (!image) return;
  try {
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    // Apply the display filter before downsampling so fine registration lines survive.
    context.filter = "url(#wordmarkInk)";
    context.drawImage(image, 0, 0);
    if (context.getImageData(0, 0, 1, 1).data[3] !== 0) return;
    const prepared = new Image();
    prepared.src = canvas.toDataURL("image/png");
    await prepared.decode();
    image.src = prepared.src;
    image.classList.add("is-prepared");
  } catch {
    // The CSS filter remains the no-JS/unsupported-canvas fallback.
  }
}
prepareWordmark();

function closeDialog(dialog) {
  if (dialog?.open) dialog.close();
}
menuButton?.addEventListener("click", () => {
  menu.showModal();
  menuButton.setAttribute("aria-expanded", "true");
});
menu?.addEventListener("close", () =>
  menuButton.setAttribute("aria-expanded", "false"),
);
menu
  ?.querySelectorAll("a")
  .forEach((link) => link.addEventListener("click", () => closeDialog(menu)));
document.querySelectorAll("[data-about]").forEach((button) =>
  button.addEventListener("click", () => {
    closeDialog(menu);
    about.showModal();
  }),
);
document
  .querySelectorAll("[data-close]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      closeDialog(document.getElementById(button.dataset.close)),
    ),
  );
document
  .querySelector("[data-contact]")
  ?.addEventListener("click", () => closeDialog(about));
document.querySelectorAll("dialog").forEach((dialog) =>
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      closeDialog(dialog);
  }),
);

const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const hero = document.querySelector(".hero");
let pending = false;
function updateHero() {
  pending = false;
  if (!hero) return;
  const top = Math.max(0, window.scrollY);
  const visible = top < hero.offsetHeight;
  if (!visible || reduce.matches) return;
  const copy = hero.querySelector(".hero-copy");
  copy.style.opacity = String(Math.max(0, 1 - top / (hero.offsetHeight * 0.7)));
}
window.addEventListener(
  "scroll",
  () => {
    if (!pending) {
      pending = true;
      requestAnimationFrame(updateHero);
    }
  },
  { passive: true },
);
reduce.addEventListener("change", () => {
  if (hero) hero.querySelector(".hero-copy").style.opacity = "1";
  if (!reduce.matches) updateHero();
});
updateHero();
