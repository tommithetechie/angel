# Match `angel.jpg` in the interactive scene

Review plan — 18 October 2026. This replaces the Virgo gown as the visual target. The earlier `VIRGO-BODY-PLAN.md` remains a separate option if a robed figure is wanted later. No application code or assets are changed by this plan.

## Decision

**Best for a real 3D scene:** make a custom, clean sculpt of the floating figure using `angel.jpg` as the front-camera guide, and redesign the existing six procedural wings to match its three large silhouettes. Keep the rings, particles and marble system, but retune them against the reference. This is substantial modeling and art-direction work. It offers the closest match while still allowing orbit and form changes.

**Easiest route to an almost identical *front view*:** separate the existing JPG into figure/wing, ring and background layers; place them at shallow depths in the Three.js scene, animate particles and rings around them, and allow only slight camera parallax. This is a 2.5D scene. It can retain much of the source image's visual detail, but the figure will look flat or reveal missing sides if freely orbited. It also cannot credibly change the body's pose for the still form without a second authored image. Present it as a constrained front-facing art piece if chosen.

**Easiest route that remains fully 3D:** keep main's articulated body and code wings, then change pose, wing curves, framing and lighting. This is the quickest useful prototype, but likely will **not** meet “almost identical” because the body anatomy, hair and individual feathers are currently designed in code rather than sculpted to the reference.

My recommendation is a two-stage path: first make a fixed-camera proof with the existing 3D scene; if its silhouette is still too far from the JPG, commission or sculpt the body and polish the procedural wings. Do not spend time cleaning the Virgo gown for this goal: its draped silhouette conflicts with the reference's visible torso and legs.

## If the owner does not use Blender

No Blender knowledge is required from the site owner. The **recommended no-Blender delivery** is the image-led 2.5D route, implemented inside this Three.js/Vite repository. It keeps the actual reference artwork as the detailed front-view figure, separates foreground and background into transparent layers, and puts live rings, particles, smoke and debris at different depths. This is a genuine interactive 3D stage with a constrained camera; the central figure is image-based. It is the most reliable way to preserve the JPG's distinctive feather and anatomy detail without a 3D artist.

Start with a reversible proof before cutting up the artwork: show the unchanged reference as a centered portrait layer, put one existing ring behind and one in front, move the camera only a few degrees, and compare 800×1200 and 390×844 captures. If that looks right, prepare clean transparent layers, repair the background hidden by removed elements, add depth and subtle motion, and keep the figure aligned with the original view. Capture the reference at its native aspect ratio; never stretch it to fill desktop.

If wide orbit and a fully volumetric angel are essential, the alternatives are to reshape the site's existing code-built figure and wings through screenshot iteration, or obtain a custom body asset from a 3D artist. I can handle the code route without Blender on the owner's machine, but cannot promise a near-identical model from one JPG alone; the unseen sides and detailed feather anatomy must be invented. An automatically generated 3D model may serve as a blockout, not a quality guarantee—the existing Virgo asset already illustrates that risk.

The image-led route needs the source image's reuse rights confirmed before publishing it or edited cutouts. Until then, prototype locally with `angel.jpg` and keep any publish-ready asset decision separate. Continue to honor the prior repository limits: no `virgo/` commit, no file above 25 MB, and no merge or push to main.

## What must match

The reference is 800×1200, so the **front hero camera** matters more than any single material parameter. It shows a suspended female figure with the face hidden by windswept hair; torso, arms, hands and descending legs remain readable. Three wing pairs have distinct outlines: tall upper arcs above the head, broad middle wings spread to the sides, and long lower wings trailing toward the bottom. They are densely layered with high-contrast silver/charcoal feathers. Thin gold fractures run across pale stone; two tilted glyph rings pass behind and across the figure. The field is nearly black with smoke, specks and a few small stone fragments. The JPG does not show a gown or a visually dominant reflective floor.

Match in this order:

1. **Composition and silhouette:** figure height, center, apparent scale, wing span, three-pair separation, body/hair pose, ring locations. Compare an image overlay at the same portrait ratio; broad shape differences are the first rejection gate.
2. **Surface and lighting:** pale smooth marble with sharp dark fractures and restrained gold veins; strong side/rim light while preserving black negative space. Avoid tiny color-driven normal perturbations that make the body look hammered.
3. **Atmosphere:** smoky depth, floating debris, sparse gold sparks, glyph rings and bloom. Keep these behind the silhouette where possible instead of obscuring anatomy.
4. **Motion and interaction:** slow breathing, feather movement and drifting particles. Motion should return to a recognizable hero pose. The still form can be a separate cool, quiet interpretation; it cannot literally match a reference that contains only one radiant image.

## Best full-3D production route

1. Put `angel.jpg` behind a camera in Blender as a scale and silhouette guide. The image gives one view only; design the back and sides coherently rather than claiming they are known. Blender supports placing reference imagery in camera view and sculpting at multiple resolutions; high-resolution detail can be baked onto a lighter exported mesh. See the [Blender multiresolution and baking manual](https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/multiresolution.html).
2. Sculpt the body, hair, hands and legs as a clean floating figure matching the hero outline. Use separate riggable pieces or a simple armature if the still form must substantially change body pose. Do not reuse Virgo; its gown and fused props add more removal work than this image target warrants.
3. Keep exactly six code-built wings, but redesign their root positions, main curves, feather shape, layered density and color distribution. The existing instanced feathers are a good technical foundation; Three.js documents instancing as a way to reduce draw calls for repeated geometry ([InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html)). If the reference's feather detail cannot be reached with procedural geometry alone, author a few feather shapes offline while retaining code-built placement and animation.
4. Retune rings and material separately from anatomy. Build the marble as mostly nonmetal stone with metallic gold limited to fissures. Use a clean geometry or baked normal map for intentional cracks; turn off the current diffuse-luminance bump while comparing. Use PR #6's HDR environment and reflection work selectively, but reduce or hide the floor in the radiant hero composition.
5. Export a compact desktop/mobile GLB for the body, with no source sculpt or asset above 25 MB in Git. Keep the existing module contract `{ group, update(time, dt), setForm(form, t), dispose }`, `/angel/` base path and working disposal behavior. Preserve the six wing instances and the two forms.

## Faster front-view route

Create transparent foreground cutouts for figure and wing layers from the local image, plus a clean background plate or reconstructed dark field. Keep gold glyph rings, sparks and debris as actual Three.js objects at several depths. Animate only modest parallax and feather/particle overlays; limit camera orbit so the layered construction stays believable. Three.js `OrbitControls` supports bounding azimuth and polar angles ([documentation](https://threejs.org/docs/pages/OrbitControls.html)). This route should be called an image-led scene, not a fully orbitable sculpture. If the original JPG is displayed or redistributed, establish its provenance and use rights first; the local file alone does not establish a license.

## Small implementation milestones and checks

| Milestone | Deliverable | Check |
| --- | --- | --- |
| 1. Image-match baseline | Fixed hero camera and reference overlay/contact sheet for main and the PR #6 lighting branch. | 800×1200 crop plus 1440×900 and 390×844; record wing/body/ring alignment and visible deviations in both forms. |
| 2. Silhouette prototype | Existing body and six wings posed to the reference; hair and ring placement adjusted; floor de-emphasized. | Front silhouette close to JPG in a side-by-side and 50% overlay; all six wings visible; side/back orbit shows no catastrophic clipping. This is the decision gate for a custom sculpt. |
| 3. Body asset | If milestone 2 falls short, custom sculpt, rig if needed, optimized GLBs and documented export. | Smooth neutral-clay body, intentional proportions and hair, no lumpy surface or giant files; mobile LOD retains the face/hair and limbs. |
| 4. Wing detail and marble | Denser layered wing profiles and restrained cracked-marble/gold material. | Compare fixed-camera grayscale silhouette before color; then close-up of body/feathers with shader bump on/off. |
| 5. Atmosphere and forms | Haze, floating debris, two rings, lighting balance, radiant/still transitions and responsive crop. | Screenshots at 1440×900 and 390×844 in radiant and still, plus portrait 800×1200; test transition midpoint and motion. |
| 6. Production QA | Built `/angel/` preview, load/lifecycle checks, asset inventory and device performance. | No missing requests or console errors; phone loads lighter model, all resources dispose cleanly, no committed source/oversized asset, and the visible credit stays accurate for any third-party material actually used. |

The 800×1200 source is portrait. On a 1440×900 desktop, keep a tall central composition and extend its background to the sides; stretching the portrait image would change proportions. On 390×844, use a deliberate crop that keeps the top wing tips, figure and lower wings legible. A reference overlay should be judged at the source ratio first, then the responsive compositions should be reviewed separately.
