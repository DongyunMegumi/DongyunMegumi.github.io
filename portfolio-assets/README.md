# Public Display Assets

These files are intentionally published with the portfolio. The Sumi display
uses an AES-256-GCM encrypted `.enc` file instead of a directly usable GLB.
The plain display export stays in ignored local assets. Blender projects,
original VRM files, and local asset settings are not included.

Browser decryption is only a download deterrent, not access control or DRM.
`model-view.json` contains deliberately public client key material that the
build inserts into the model page. Visitors can obtain the key or extract the
decoded model. Do not treat it as a secret or rely on it for confidential work.
Previously committed plain models remain in Git history until separately
removed with the owner's approval.

`tools/build-portfolio.cjs` copies an explicit asset allowlist into the published
site. `tools/export-portfolio-assets.cjs` regenerates those assets from the local
preview configuration; it is not run by CI and never changes the originals.
Then run `node tools/encrypt-model.cjs` to generate a fresh encrypted display
file and matching client configuration before committing. Private hosting
remains the recommended next step for client models.
