export function setupModelCollection() {
  document.querySelectorAll("[data-model-collection]").forEach((collection) => {
    const rail = collection.querySelector(".portrait-rail");
    const cards = [...rail.querySelectorAll(".portrait-card")];
    const filters = [...collection.querySelectorAll("[data-model-filter]")];
    const controls = collection.querySelector(".rail-controls");
    const arrows = [...controls.querySelectorAll("button")];
    const counter = controls.querySelector("output");
    const count = collection.querySelector(".collection-count");
    const dialog = collection.querySelector(".sample-dialog");
    const image = dialog.querySelector("img");
    const title = dialog.querySelector("h2");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const visibleCards = () => cards.filter((card) => !card.hidden);
    const behavior = () => (reduced.matches ? "instant" : "smooth");
    cards.forEach((card) => {
      const art = card.querySelector(".portrait-art");
      const shadow = document.createElement("div");
      shadow.className = "portrait-shadow";
      shadow.setAttribute("aria-hidden", "true");
      shadow.append(art.cloneNode());
      card.prepend(shadow);
      art.addEventListener("error", () =>
        card.classList.add("is-image-missing"),
      );
      if (!card.dataset.sample) return;
      card.addEventListener("click", (event) => {
        if (
          event.button ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        image.src = card.href;
        image.alt = `${card.dataset.sample} 游戏模型制作计划参考立绘`;
        title.textContent = card.dataset.sample;
        dialog.showModal();
      });
    });
    function update() {
      const visible = visibleCards();
      controls.hidden = rail.scrollWidth <= rail.clientWidth + 2;
      arrows[0].disabled = rail.scrollLeft <= 2;
      arrows[1].disabled =
        rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2;
      const left = rail.getBoundingClientRect().left;
      const first = Math.max(
        0,
        visible.findIndex(
          (card) => card.getBoundingClientRect().right > left + 40,
        ),
      );
      counter.textContent = `${String(first + 1).padStart(2, "0")} / ${String(visible.length).padStart(2, "0")}`;
    }
    filters.forEach((filter) =>
      filter.addEventListener("click", () => {
        const type = filter.dataset.modelFilter;
        filters.forEach((button) =>
          button.setAttribute("aria-pressed", String(button === filter)),
        );
        cards.forEach(
          (card) =>
            (card.hidden = type !== "all" && card.dataset.modelType !== type),
        );
        count.textContent =
          type === "vtuber"
            ? "01 VTuber"
            : type === "game"
              ? "03 游戏模型制作计划"
              : "01 VTuber / 03 游戏模型制作计划";
        rail.scrollTo({ left: 0, behavior: "instant" });
        update();
        collection.dispatchEvent(
          new CustomEvent("model-category-change", {
            bubbles: true,
            detail: { category: type, count: count.textContent },
          }),
        );
      }),
    );
    const initial = new URLSearchParams(location.search).get("category");
    filters.find((filter) => filter.dataset.modelFilter === initial)?.click();
    arrows.forEach((arrow) =>
      arrow.addEventListener("click", () => {
        rail.scrollBy({
          left:
            Number(arrow.dataset.railStep) *
            ((visibleCards()[0]?.offsetWidth || 190) + 24),
          behavior: behavior(),
        });
      }),
    );
    rail.addEventListener("keydown", (event) => {
      const visible = visibleCards();
      const current = visible.indexOf(event.target.closest(".portrait-card"));
      if (
        current < 0 ||
        !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
      )
        return;
      event.preventDefault();
      const index =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? visible.length - 1
            : (current +
                (event.key === "ArrowRight" ? 1 : -1) +
                visible.length) %
              visible.length;
      visible[index].focus({ preventScroll: true });
      visible[index].scrollIntoView({
        block: "nearest",
        inline: "center",
        behavior: behavior(),
      });
    });
    rail.addEventListener("scroll", update, { passive: true });
    new ResizeObserver(update).observe(rail);
    dialog
      .querySelector(".sample-close")
      .addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      )
        dialog.close();
    });
    update();
  });
  window.lucide?.createIcons();
}
