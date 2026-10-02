# Portfolio Case Preview

An isolated design prototype. It does not change the live Hexo homepage or its character pages.

## Homepage Preview

Open `http://127.0.0.1:4002/` for the redesigned homepage. The page hierarchy is homepage -> `/models/` (character selection wall) -> `/models/sumi/` (individual model case). `/home/` aliases the homepage; the previous homepage draft remains at `/home/v1/`. Old root links with `?mode=...` redirect to Sumi. The removed model-only mode now resolves to the illustration/model pair; comparison links remain supported.

The homepage follows HACHI's left navigation rail / right primary image, large vertical desktop headings (horizontal on mobile), date-led news rows, overlapping About band, and scroll-activated top navigation. The RELEASE slot now embeds the same slanted character collection as the model parent, following the user's corrected direction rather than the earlier three Sumi covers. It uses neutral #F4F4F4 / #ECEDEF / #DEE2E4 section surfaces, not the previous dark gradient or faint grayscale hero. The user requested retaining the overlaid official logo, introduction and model/order links for this iteration. About uses the supplied Kiss Moon illustration in a 315x395px desktop frame, cropped by CSS object-fit:cover; its source is unchanged. Mobile navigation supports keyboard dismissal. Reduced-motion preferences disable reveal animations. The homepage does not load the full VRM or motion GIF.

CHARACTER (the former RELEASE slot) and `/models/` share one server-rendered `models/collection.html` fragment, one scoped card style and one interaction module. Both show All / VTuber / Game Model filters. Sumi is the real VTuber case; the other three characters are explicitly game-model plans using reference illustrations, not completed models. Their images open a planning dialog; Sumi opens the interactive case. Filtering resets rail position and updates counts, boundaries and keyboard navigation to visible cards only. Touch scrolling and no-JavaScript case links remain available. VIEW MORE opens the parent overview. UI fonts match the reference's Jost 300 and Noto Sans JP, with Noto Sans SC fallback. Self-hosted open-source WOFF2 subsets and OFL licenses live in `home/fonts/`; no proprietary font or HACHI artwork is copied. Letter spacing remains zero and font sizes use fixed responsive breakpoints.

All primary navigation destinations are actual pages: `/news/` for journal listings, `/about/` for the profile, `/models/` for the collection, `/archive/` for production evidence, and `/commission/` for order information. Homepage previews retain VIEW MORE links. News entries open the existing real Markdown article pages; the archive links to the actual white-model comparison and planned game characters. There is no fabricated goods shop.

`/commission/` is a separate order page, using the structure and provisional service parameters from https://sites.google.com/view/fusako3d/order at the user's request. These are explicitly marked as an unapproved draft, not active Megumi policies. Only the user's VGen Terms of Service are summarized from their own service detail (verified 2026-10-02, source updated 2025-03-20): https://vgen.co/DongyunMegumi/service/-events-create-a-custom-3d-vtuber-vrchat-avatar/68f64e7f-70cd-46d8-8930-90e5baee2ef0 . Service prices, reviews and promotions from VGen are not imported. The Chinese summary is not a full replacement for the original; overlapping revision/use-right clauses and differences from the reference draft require owner confirmation before publication. No checkout, payment processing or binding acceptance is implemented.

The hero, sidebar, mobile header, model parent and model detail now use the user's official colored `東雲 Megumi` logo, not the earlier monochrome typography reference. Its source copy is ignored at `.local-assets/megumi-brand-source.png`. A browser luminance-to-alpha display filter suppresses the white backdrop; a full-resolution in-memory render preserves thin lines before responsive downsampling. Dark-background variants gently increase brightness. The original image remains unchanged. No generated redesign is used. The screen-reader H1 remains literal brand text. Without JavaScript the original readable image remains visible. This is a logo image, not an installable font file.

The model parent follows Atelier Yumia's Characters selection wall: graphite background, gray-to-cyan slanted panels with subtle diagonal texture, layered thin outlines, offset character silhouettes, overflowing character art, white vertical cyan name tags, and hover/focus transitions. Desktop background plates now use an original SVG composition (`portrait-panel.svg`) rather than separately skewed CSS rectangles. Its main panel, offset backing, thin outline and shadow share an 8/38 diagonal slope; the same slope clips the artwork through `portrait-art-mask.svg` and shapes the nameplate. Fixed 38px SVG caps preserve the nameplate's 4px upper / 2px lower stripe weights without stretching for longer names. Hover uses translation only, keeping vector strokes and names at their native scale. The real Sumi card links to its nested case page. Three existing illustrations are marked as game-model production plans, without fabricated case statistics. Existing small-screen styles remain untouched. The original production card stylesheet is reused with prototype-only scoped overrides; production character pages remain unchanged.

The hero overlay logo sits at the top-left of the primary artwork, independently of the lower introduction and links; short landscape viewports use a compact logo. The Sumi case has only two viewing tabs: illustration/model pair and clay/texture comparison. Model category changes also update the parent production archive and credits. Game plans now have three native detail links inside a separate planning group, including initial `?category=game` links. They reopen the retained `/characters/?character=0..2#profile` interface, following the user's Isla detail-page reference. These legacy profiles retain their existing draft content and sample statistics; they are not verified model records. Actual game-model production evidence remains unavailable. VTuber filtering hides these plan links and restores Sumi's real archive. Desktop title ornaments now mirror both height and outer corners; existing mobile styles are left unchanged. Further mobile adaptation is paused at the user's request.

The homepage now extends the hero's blue sky and lavender dusk into a light blue/lavender/blush fixed background gradient. Section bands are translucent, preserving the existing HACHI layout. Small hollow CSS bubbles float upwards at staggered speeds, inspired by https://kamiina-botan.com/ without copying its artwork or scripts. This decoration is homepage-only, inert, below content and pointer-transparent. A named pause/play icon controls motion; hidden tabs pause it automatically. Reduced-motion preferences show six static bubbles and no motion control. Mobile limits animation to fourteen bubbles, desktop to twenty-four. Only transforms and opacity animate; no canvas, animation-frame loop or new library is added.

Commission options, the seven-step delivery process, the separate seven-step modeling process, and the two materials groups follow the user's supplied reference screenshots in Chinese. Reference draft delivery precedes final payment; the retained VGen summary specifies final files after payment. This difference is explicitly flagged, rather than changing the user's existing terms.

The homepage opening follows Kamiina Botan's centered-logo blur-to-focus, logo fade-out and pale-screen dissolve sequence, using only Megumi's own logo. It runs for four seconds after bounded image preparation, once per tab session. `/?intro=1` explicitly replays it for review. The skip icon, Escape and mid-animation reduced-motion changes immediately release the page. Main navigation is inert during playback, keyboard focus stays on skip and returns to main on completion. Reduced-motion, deep anchors, history returns and no-JavaScript visits enter the homepage directly. A six-second independent fallback prevents a broken module from leaving the page covered; blocked storage and missing logo images also fail open. No reference artwork or animation library is copied.

Add absolute `homeBackground` and `homePortrait` paths to the ignored `.local.json`. These images are served directly from their original files, unchanged. Run `node render-home-assets.cjs` with the server running to regenerate the three actual model renders in ignored `.local-assets/`. Keep these client renders private. Header and About artwork permissions and attribution must be confirmed before a public release. No reference artwork is presented as a modeling project.

Journal previews read the two existing Markdown posts using the repository's front-matter and Markdown parsers. Their content is unchanged. This prototype depends on the parent Hexo dependencies for journal rendering.

## Run

```powershell
npm install
npm start
```

The server listens only on `127.0.0.1:4002`. Use `PORT` to select another port.

Create an ignored `.local.json` next to `server.cjs` with absolute `model`, `reference`, `motion`, and `matcap` paths. `model` points to a VRM file, `reference` to its character sheet, `motion` to the original animated GIF, and `matcap` to a PNG MatCap. The current reference layout supports a sheet with back, front, and side views from left to right. Restart the server after changing paths.

The local server reads model and reference files from their original locations. Never commit `.local.json`, `.local-assets`, or original client project files. Public display assets approved by the owner are kept separately in the repository's `portfolio-assets/` directory. `tools/build-portfolio.cjs` publishes an explicit page/asset allowlist after Hexo generation, without exposing this local server or its settings. The public viewer uses a reduced GLB display export; the local preview still uses the original VRM.

## Interaction

- Illustration and flat-textured model side by side, starting with the full body. There are no full-body/face/clothing preset buttons. Textured views use unlit base-color maps without scene lighting, specular effects, or outlines, following the requested Blender flat/texture viewport style.
- Grey-white MatCap and base-color passes on one orthographic camera and one posed model. Use the divider or native range control. The local MatCap is Blender's `basic_grey.exr`, converted to sRGB PNG using Blender Standard output, not lit by scene lights.
- Cursor-centered wheel zoom using Three.js OrbitControls, drag to orbit, right-button or Shift-drag to pan, and touch pinch/pan. Reset restores the full-body front view and clears zoom/pan. Optional automatic rotation stops on manual interaction. Fullscreen is supported. The face stays in its original state; no expression switching is provided.
- Detail thumbnails captured from the actual model, not synthetic images.
- The character selection wall is on `/models/`, not embedded in the individual Sumi case. Case breadcrumbs and the end-of-page link return to the parent overview.
- Repeatable scroll fade-up for each page module, following hinatanso's 1.1-second / 50px reveal cadence. Native IntersectionObserver watches stable wrappers; section dimensions do not change. Keyboard-focused and fullscreen content stays fully visible. Reduced-motion mode disables the reveal and shows every module, including offscreen content. Without JavaScript, content remains visible.
- Original animated GIF, uncropped portrait framing, stop/play, enlargement, and load retry. Stopping returns to a captured still because native GIF images do not offer a pause API. Reduced-motion preferences start with the still; animation also stops offscreen or when the browser tab is hidden. The source GIF is never changed or committed.

## Verification

```powershell
npm run check
npm test
npm run test:home
npm run test:opening
npm run test:models-desktop
```

The browser tests require the local preview server and the bundled Codex Playwright runtime, or a locally available Playwright package. Screenshot output is ignored by Git.

Desktop model tests cover 1280, 1625 and 1920px title-line symmetry, category-specific archive entries, all three retained character detail links, artwork framing, image enlargement, character navigation and no-JavaScript links. This change does not add or alter mobile breakpoints.

Opening tests capture blur, centered logo and homepage reveal at desktop and 390/320px widths, and check timing, skip/keyboard focus, same-session bypass, replay links, anchor links, reduced-motion changes, denied storage, missing artwork, no JavaScript and a failed module. The CHARACTER title is checked for a single line on mobile.

Homepage tests cover 320, 390, 768, 1440 and 1920px widths plus 844x390 and 640x400 landscape viewports, visible next-section content, local font and image loading, navigation destinations, repeated reveal, reduced motion, both journal pages, private routes, and the homepage / model parent / model child round trip. Both collection entrances test All / VTuber / Game filtering, visible-card keyboard traversal, scroll controls and planning-dialog dismissal. No-JavaScript links remain usable. News, About, archive and order pages are checked across desktop/tablet/mobile widths, including native terms accordions, exact desktop portrait dimensions and original-image hashes. Separate case tests check canvas pixels, framing, pointer-centered zoom, touch pinch, white/texture comparison, GIF and fullscreen behavior.

The preview reads the original sibling VRM export to preserve texture mappings and its humanoid skeleton, then uses an unlit material for the requested display. MCP inspection confirmed the left Blender viewport uses SOLID / FLAT / TEXTURE, orthographic projection, and no shadows or cavity. The white pass follows the user's MatCap screenshot rather than the right viewport's STUDIO lighting. The screenshot's exact MatCap filename was not supplied; `basic_grey` is a neutral grey choice, not a claimed pixel-perfect match. The supplied FBX, GIF and Blender project remain unchanged and unsaved. The original reference artist credit still needs confirmation before publishing.
