# Halo

A three.js scene centered on an upright gold halo and two animated orbital
gold trails. A dark teal stage, moon, reflective water, drifting debris, and
ambient particles keep the halo grounded without a body or winged figure.
Drag to orbit and use the Hero button (or `R`) to restore the centered view.

## Develop

```bash
npm install
npm run dev
```

The dev server uses the GitHub Pages base path, so the scene is at `/angel/`.

### Repeatable review views

Add `review=1` to hold a deterministic frame for visual review. `time` (or `t`)
sets the fixed scene time in seconds. Review-only toggles include `rings=0` and
`atmosphere=0`; for example:

```
/angel/?review=1&time=3.2
/angel/?review=1&time=3.2&rings=0&atmosphere=0
```

The Hero button, or the `R` key, returns the camera to the responsive hero
frame after orbiting. Reduced-motion mode suppresses camera drift and keeps
the halo/trail animation restrained.

## Build

```bash
npm run build
npm run preview
```

`npm run build` writes `dist/` with `base` set to `/angel/`. Pushing to `main` runs the Pages workflow. In the repository settings, set Pages to deploy from **GitHub Actions**. This repo does not change that setting itself.
