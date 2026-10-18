# Seraphim

A three.js scene of a marble seraph in two forms.

Reflections use a procedural HDR environment, one for the radiant form and one for the still form. It is generated in the page at startup and is not a downloaded HDRI, so it has no third-party license.

**Radiant** is the dark, gold-lit form. **Still** is a quieter teal water form, with a moon and a rippled reflective surface. Press Space, or the button at the bottom, to move between them. Drag to orbit. The camera eases in, then drifts when it is left alone.

## Develop

```bash
npm install
npm run dev
```

The dev server uses the GitHub Pages base path, so the scene is at `/angel/`.

`?hero` (or `?capture`) is a dev framing aid. It locks the camera, hides the caption, and freezes animation time so a screenshot can be taken again and match. `form=still` selects the quiet form. `view=side` and `view=back` hold the same distance from the side and the back. `view=close` frames the body and wings. The public scene still eases in and drifts.

## Build

```bash
npm run build
npm run preview
```

`npm run build` writes `dist/` with `base` set to `/angel/`. Pushing to `main` runs the Pages workflow. In the repository settings, set Pages to deploy from **GitHub Actions**. This repo does not change that setting itself.
