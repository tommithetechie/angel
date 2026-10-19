# Angel: majesty and magic redesign

18 October 2026. Planning only; application code and assets are unchanged.

## Direction

Make the angel the unmistakable subject: a suspended marble figure, six sweeping feathered wings, delicate gold inscriptions, and a dark atmosphere with depth. Use `angel.jpg` as the Radiant composition guide. Preserve the interactive 3D scene and both forms. Still should feel like the same powerful being at rest.

Keep the current Three.js/Vite architecture. Start with a bounded procedural silhouette redesign. If the body cannot pass the neutral-shading review below, use a purpose-built body asset; do not compensate with more glow or increasingly noisy surface detail. A near-identical sculpt from one reference image is not guaranteed by this code route.

This plan consolidates the direction in `ANGEL-REFERENCE-PLAN.md` into an ordered implementation. `VIRGO-BODY-PLAN.md` concerns a different, gowned silhouette and is not the default path. Historical PR/asset assertions in those documents were not reverified here.

## Evidence and diagnosis

Baseline: local commit `61da22c`, initially clean working tree. Inspected source, the local reference image, and a live localhost render at 1280×720 in Radiant and settled Still. Switched forms successfully; the browser's captured warning/error log was empty. This was a visual review, not performance, mobile, build, or exhaustive lifecycle verification. Camera autorotation means captures were not identical-time comparisons.

Observed in Radiant:

- Wide glowing gold bands and the halo command attention before the figure. The lower ring extends outside the viewport.
- The central body reads as a slender, assembled form and blends into wings carrying similar texture and brightness.
- Upper wings form upright pointed fans; middle feathers read as repeated spikes; lower wings read as narrow hanging strips. The reference instead has curved, overlapping feather masses with three distinct directions.
- Strong all-over surface pattern competes with anatomy and feather layering. Faceted debris adds another sharp visual texture.

Observed in Still:

- The moon becomes a large white focal point and bright concentric water bands dominate the foreground.
- The seated figure is small and low in the composition; folded wings are hard to distinguish at the observed orbit angle.

Source explains several mechanisms, but their individual contributions need controlled renders:

- `src/angel.js` builds the body, hair, feather geometry, placement and poses procedurally. Instanced wings are a useful foundation; geometry and placement need art direction.
- `src/marble.js` derives projected body relief from diffuse luminance in `BODY_NORMAL`, currently with a `5.6` gradient multiplier. Colored veins can therefore change shading normals. A clay/material A/B must determine how much apparent lumpiness is geometry versus shader relief.
- `src/rings.js` combines annuli, separate glow, glyphs and halo elements. Reducing bloom alone will not necessarily make those bands delicate.
- `src/main.js` uses one fixed intro destination/target and updates aspect on resize without fitting the composition to viewport shape or form. `?settle` skips the intro but animation and idle orbit continue.
- Reduced motion currently skips the intro and form transition, but does not gate the main idle-rotation assignment. A complete motion policy is needed.

## Implementation sequence and review gates

### 1. Establish repeatable visual review and framing

Files: `src/main.js`, with a small development review helper if useful.

Add a development review mode with a fixed camera, fixed animation time, explicit form/blend, and toggles for neutral clay, rings, atmosphere and material relief. Freeze both camera and animation in this mode; do not redefine ordinary `settle` behavior accidentally. Make procedural randomness repeatable for captures.

Define a front hero camera and separate composition targets for Radiant and Still. Fit camera distance using both horizontal and vertical field of view and the intended visible scene bounds, with safe margins for wing tips and the HUD. Preserve a tall composition on desktop by extending the dark environment sideways. Fit portrait deliberately instead of simply narrowing the desktop view.

Keep drag orbit. Replace immediate continuous idle rotation with a very small, slow drift around the hero angle, and provide a reliable return-to-hero action. Do not force the camera back while the user is interacting.

Gate: reproducible captures at 800×1200, 1440×900 and 390×844. Main wing tips, body and intended ring outlines fit without accidental cropping or HUD overlap. Record a baseline before adjusting art.

### 2. Rebuild the silhouette in neutral clay

Primary file: `src/angel.js`.

- Upper pair: broad arcing wings that rise outward and curve inward to form an open crown, leaving dark space around the head.
- Middle pair: greater lateral sweep, a clear shoulder-to-tip curve, and overlapping feather layers. Keep their roots behind the torso rather than visually covering it.
- Lower pair: long tapered curves flowing down and outward, with a visible gap around the descending legs. Avoid two parallel strips.
- Body: clearer ribcage/pelvis proportions, continuous-looking shoulders and limb joins, a gentle asymmetrical suspended pose, relaxed hands and readable legs.
- Hair: larger windswept masses that obscure part of the face while preserving head/neck separation. Avoid a collection of equally thin strands as the primary silhouette.

Judge front, three-quarter, side and back views with rings and effects hidden. Keep exactly six wings. Refine the existing procedural body only through this bounded milestone.

Gate: at thumbnail size and in grayscale, the body and three wing pairs are recognizable independently. In neutral clay the figure must feel sculptural. If anatomy or visible joins still fail, stop body parameter polishing and specify a clean custom body/hair asset matching the accepted pose. A rig or compatible deformation plan is necessary if that asset must retain the seated Still pose. Do not integrate the unrelated Virgo gown by default.

### 3. Give the wings feather structure

Files: `src/angel.js`, `src/marble.js`.

Retain instancing, but introduce a small shared family of feather shapes: short rounded coverts, broader overlapping secondary feathers and curved tapered primaries. Give feathers an asymmetric vane, shallow central ridge, gentle twist and substantial bases; avoid uniformly needle-like tips.

Arrange rows along each wing's curvature with intentional overlap and coherent directional flow. Use seeded variation sparingly. Create recessed darker layers and brighter outer edges so feather groups read before cracks do. Check deformation through the complete fold/unfold transition, not just its endpoints.

Gate: feathers read as layered wings at normal viewing size, without requiring a large instance-count increase. Side views retain volume and roots remain coherent.

### 4. Separate marble, gold and light

Files: `src/marble.js`, `src/main.js`, `src/rings.js`.

Run three controlled body renders: plain clay, neutral polished stone, then final marble. Disable luminance-derived relief independently of the normal map. Restore only subtle, intentional relief after the smooth-stone pass succeeds.

Use broad quiet ivory stone areas, fewer dark fractures and thin intermittent gold veins. Keep stone predominantly nonmetallic and gold metallic through the actual masks; the material's scalar metalness alone does not establish the final surface. Reduce clearcoat/specular sharpness if it amplifies unwanted surface chatter. Give body and wings distinct texture scale and tonal treatment.

Shape the figure with a soft key and controlled cool rim, reserving warm accents for veins and rings. Preserve shadows between feathers and around limbs. Tune exposure, emissive values, ring glow and bloom together against the fixed hero view.

Narrow the ring bands, reduce their continuous luminous fill and halo opacity, and retain crisp fine inscriptions. Arrange two tilted rings around the accepted silhouette with clear front/back depth and minimal overlap over the head and torso. Preserve occlusion by opaque body geometry.

Gate: the angel is the first large form seen; rings remain legible gold linework. Highlights retain stone and feather detail. No bloom setting is accepted solely because it looks dramatic in isolation.

### 5. Add atmosphere and purposeful motion

Files: `src/particles.js`, `src/debris.js`, `src/rings.js`, `src/angel.js`, `src/main.js`.

Build faint haze behind and below the silhouette with several depths and uneven density. Reduce uniform screen grain and distribute sparse sparks in clusters and depth layers. Keep larger debris away from the face, hands and important wing gaps; vary scale and reduce its visual contrast.

Use slow suspension, small delayed wing movement, subtle hair drift, slow counter-rotating inscriptions and an occasional restrained vein pulse. Coordinate motion so the composition remains recognizable. Add no rapid flapping or broad periodic flash.

Gate: a 20–30 second observation remains calm and keeps the angel readable. Reduced-motion mode stops idle camera motion and nonessential continuous movement while preserving manual interaction and immediate form selection.

### 6. Recompose Still and transitions

Files: `src/forms.js`, `src/floor.js`, `src/main.js`, `src/angel.js`.

Preserve the cool water identity, but reduce moon size/glow and water-band contrast. Use softer, less regular ripples and a subdued reflection. Frame the seated figure closer and higher. Fold wings into a readable protective shape around the body, with distinct outer contours rather than disappearing edge-on.

Blend any form-specific camera framing only while the camera is under scene control. Respect user orbit/zoom. Check rapid toggle reversal and intermediate poses for clipping, popping, excessive brightness and abrupt camera movement.

Gate: Still retains the angel as its focal point. Review blend values 0, 0.25, 0.5, 0.75 and 1 plus interrupted reversals.

## Delivery and verification

One coder should own the implementation in sequence, including rendering and verification. Do not split tightly coupled body, wings, camera and lighting work across competing implementations. Review the silhouette milestone before spending effort on final surface polish; that is the main asset decision point.

Preserve the module interface (`group`, `update`, `setForm`, `dispose`), instanced wing rendering, `/angel/` asset paths, both forms and disposal ownership. Leave source assets in `virgo/` untouched. Carry forward the existing plan's limits: no asset over 25 MB, no merge or push as part of this redesign plan. New asset acquisition is a separate dependency if the silhouette gate calls for it.

For each visual milestone, produce matching captures in the three viewport sizes. Final validation must include the built `/angel/` preview, both forms, touch/drag orbit and zoom, resize, toggle reversal, reduced motion, shader/console errors, failed asset requests and page cleanup. Record frame times, draw calls and triangle counts on named test hardware; compare before/after rather than claiming unmeasured mobile performance. Reduce secondary effect cost before sacrificing the hero silhouette.

Completion means the silhouette, materials and composition pass visual review, the two forms and transitions work, and the production build passes. A successful build alone does not establish that the angel looks majestic.

## First implementation scope

Deliver stages 1–2 plus only enough ring/glow reduction to judge the silhouette. Produce the baseline/redesign contact sheet and the procedural-body versus custom-asset decision. Then finish stages 3–6 against that accepted structure. This yields a concrete visible improvement early while keeping the most expensive uncertainty—the body quality—out in the open.
