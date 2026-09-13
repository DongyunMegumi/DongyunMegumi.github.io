# Character Showcase

Public page: `/characters/`. Existing editor: `/characters/editor.html`.
The editor's preview link (`/characters/?preview=1`) reads the local draft.
Public visitors only read `source/characters/characters-data.json`.
Export JSON from the editor and replace that source file to publish changes.
The editor is a local editing utility, not an authenticated server admin panel.

`?character=ID` links directly to a character. Render and wireframe tabs appear
only when the corresponding image arrays contain images. Artwork remains available.

Run `node tools/preview-characters.cjs` with Playwright installed and Hexo running
on port 4001 to create desktop/mobile screenshots in `../character-preview`.

The homepage mounts a full-width character entrance before the article layout.
Its light paper background, centered red heading, and colored circular ornaments
follow the reference homepage. The dark strip is reserved for the detail footer.
Portraits use a blue/coral plate, offset coral underlay, white inner frame, and
an alpha-derived hard silhouette behind the character artwork.
`character-cards.css` and `character-cards.js` share the portrait-card presentation
between that entrance, the overview, and the dark selector below each profile.
Cards preserve native new-tab links, support keyboard navigation, and scroll on
mobile. Selecting a character updates browser history and focuses the profile.

The visual target is a close match to the supplied Karia references: 12-degree
layered frames, narrow cards, vertical nameplates, and 1.05x / 1.15 brightness
hover feedback. Further background extraction is deferred at the user's request.
Two existing cutouts are stored under `assets/images/display`; originals remain.

## Reference Assets

Visual reference: https://atelier.games/karia/jp/characters/karia.html

The decorative bitmap files in `source/characters/assets/reference` were obtained from
https://atelier.games/karia/assets/img/ for the requested close visual study:
bg_paper.jpg, chara_bg.png, circle_01.png, circle_wh.png, ami50.png, chara_base-text-deco.png.
The homepage additionally uses circle_02.png, circle_simple.png,
dec_characters.png, and line_pc2.png from the same reference asset directory.
Original artwork belongs to Koei Tecmo Games. These are reference-site assets,
not original portfolio artwork. Character images remain the existing local files.

The presentation HTML, CSS and JavaScript are implemented locally. The English
and Japanese display fonts match the reference: Forum and Shippori Mincho B1.
