# Public Display Assets

These files are intentionally published with the portfolio. The Sumi GLB is a
display export with reduced textures and no VRM metadata, expression morphs, or
animation clips. Blender projects, original VRM files, and local asset settings
are not included.

Browser-based 3D assets are retrievable by visitors. This directory is not a
download-protection mechanism. Only add artwork and models approved for public
display.

`tools/build-portfolio.cjs` copies an explicit asset allowlist into the published
site. `tools/export-portfolio-assets.cjs` regenerates those assets from the local
preview configuration; it is not run by CI and never changes the originals.
