export async function prepareBrand() {
  const images = [...document.querySelectorAll("[data-brand]")];
  if (!images.length) return;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  const defs = document.createElementNS(ns, "defs");
  const filter = document.createElementNS(ns, "filter");
  filter.id = "brandPaper";
  filter.setAttribute("color-interpolation-filters", "sRGB");
  const matrix = document.createElementNS(ns, "feColorMatrix");
  matrix.setAttribute("type", "matrix");
  matrix.setAttribute(
    "values",
    "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -.5315 -1.788 -.1805 0 2.4",
  );
  filter.append(matrix);
  defs.append(filter);
  svg.append(defs);
  document.body.prepend(svg);
  try {
    const source = new Image();
    source.src = images[0].src;
    await source.decode();
    const canvas = document.createElement("canvas");
    canvas.width = source.naturalWidth;
    canvas.height = source.naturalHeight;
    const context = canvas.getContext("2d");
    // Render at original resolution before shrinking the fine logo details.
    context.filter = "url(#brandPaper)";
    context.drawImage(source, 0, 0);
    if (context.getImageData(0, 0, 1, 1).data[3] > 5) return;
    const prepared = new Image();
    prepared.src = canvas.toDataURL("image/png");
    await prepared.decode();
    for (const image of images) {
      image.src = prepared.src;
      image.classList.add("is-prepared");
    }
  } catch {
    /* The supplied image remains readable if browser filtering is unavailable. */
  }
}
