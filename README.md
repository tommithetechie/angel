# Seraphim

A three.js scene of a marble seraph in two forms.

**Radiant** is the dark, gold-lit form. **Still** is a quieter teal water form, with a moon and a rippled reflective surface. Press Space, or the button at the bottom, to move between them. Drag to orbit. The camera eases in, then drifts when it is left alone.

## Develop

```bash
npm install
npm run dev
```

The dev server uses the GitHub Pages base path, so the scene is at `/angel/`.

## Build

```bash
npm run build
npm run preview
```

`npm run build` writes `dist/` with `base` set to `/angel/`. Pushing to `main` runs the Pages workflow. In the repository settings, set Pages to deploy from **GitHub Actions**. This repo does not change that setting itself.
