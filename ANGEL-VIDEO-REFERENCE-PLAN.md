# Angel redesign from the supplied video

18 October 2026 — planning only. No application changes are made by this plan.

## Reference and decision

Source: the user-supplied local video, approximately 30.09 seconds, 1280×720 at 60 fps. Reviewed timestamped frames across the full clip, with denser samples through both transformations and the camera orbit. Audio was not evaluated; this plan addresses appearance and visible motion. Extracted frames remain local and are not committed to this repository.

**Direction confirmed by the user: keep our six-wing angel and match the video's style and aesthetic. Add an upright halo and thin moving light trails.** Retain the current body, suspended pose, swept hair, crown wings, broad middle wings and flowing lower pair. Apply the video's dark/ivory contrast, luminous gold linework, controlled reflections, particles and calm teal atmosphere to that existing design.

The video is an art-direction reference, not a replacement character specification. A robe, topknot, wingless mode, garment system and replacement body asset are outside this plan. There is no new `design=robed` mode. The current working tree contains the completed hero-camera, wing and body edits; future implementation must build on and preserve them.

## What the video actually shows

| Approximate time | Observed appearance or motion | Design implication |
| --- | --- | --- |
| 0–7 s | Suspended upright figure; glossy dark head, neck and exposed upper body; pale cracked drape over one shoulder and a broad hanging skirt; visible hands and feet; tall topknot. Large gold circular diagram behind the upper body. Fine luminous paths circle the waist and lower skirt. | Translate the dark/pale material contrast to our body and feathers. Add the upright halo behind the existing angel; retain all six wings. |
| 7–11 s | Orbiting light builds, the figure becomes intensely luminous, the center washes toward white, and a pale seated figure emerges in a teal setting. | Treat transformation as a timed sequence with a light envelope, pose change, material change and environmental change. |
| 11–21 s | Cross-legged pale figure with drape and dark neck ornament; fine floral mandala behind it; luminous circular paths beneath it; small particles rise overhead. Camera moves around and above the figure. The water reflects it and localized ripples appear away from the central platform. | Retain our seated angel and folded wings. Use a real 3D mandala, localized water contrast and good side/back views. |
| 21–25 s | Another white-gold flare leads back to the upright dark-and-pale figure. | Make transformation reversible without discontinuities or accumulating effects. |
| 25–30 s | Camera continues orbiting; halo and clothing are seen obliquely; gold trails and reflection remain visible. | A flat image cutout is insufficient for this target's orbit behavior. |

The clip shows no feathered wing silhouette. The dark surface looks glossy and the light garment looks cracked; the video cannot establish their original shader or geometry implementation. Likewise, the visible flare obscures the actual pose/garment change. Borrow the observed finish and motion language without claiming to know how the source was built or copying its character silhouette. Ripples appear near pointer activity, but the clip alone does not prove the interaction implementation.

## Translate the aesthetic to our angel

| Keep from our scene | Borrow from the video | Planned treatment |
| --- | --- | --- |
| Six-wing silhouette and improved body | Strong dark/pale separation | Glossy charcoal body and quieter dark wing roots/recesses against ivory-silver feather faces; thin gold accents. |
| Swept volumetric hair | Broad readable highlights | Keep the hair geometry; distinguish locks with controlled roughness and highlights rather than changing to a topknot. |
| Crown opening and broad middle wings | Upright inscribed gold halo | Place the halo behind the head and upper torso, composed within the wing silhouette. |
| Lower wings and descending legs | Thin moving orbital trails | Put slender light paths around the waist and lower-body region, with depth-tested front/back passages. |
| Seated Still form and folded wings | Cool floral mandala, teal depth and local ripples | Adapt the same halo into fine cool linework and concentrate reflection/light paths around the seated figure. |
| Manual form switching and hero controls | A brief luminous transformation | Add a reversible light envelope while preserving the existing body and wing interpolation. |

## Ordered implementation

### 1. Lock the existing angel as the silhouette baseline

Files: `src/angel.js`, `src/main.js` only where integration requires them.

Capture the current neutral-clay Radiant and Still views using the deterministic review controls. Keep exactly six wings with their current crown, middle sweep and lower curves. Preserve body proportions, pose and hair. These captures are the regression baseline, not an invitation to redesign anatomy.

Block in the new halo and two thin trails with simple unlit linework first. Compose the halo behind the head and upper torso, with its outer rim visible through the crown opening and the gaps beside the shoulders. Start with a diameter spanning the upper torso and inner crown, well inside the middle-wing span; tune from rendered views rather than copying the video's figure-to-halo ratio literally.

Move the halo backward enough to separate it from the scalp and wing roots. Avoid tangencies where its rim follows a wing edge or crosses the face. The wings must still read as three distinct pairs. Keep the full wing-and-halo silhouette inside the hero camera's safe bounds.

**First gate:** front, three-quarter and phone captures show our recognizable angel with a complementary halo and two delicate paths. The head, hands, legs and all three wing pairs remain legible. No robe, hair replacement or hidden wings.

### 2. Match the surface and lighting style

Files: `src/marble.js`, `src/angel.js`, `src/main.js`.

Use the video's dark exposed figure against pale clothing as a contrast principle, transferred to our anatomy and feathers:

- **Radiant body:** controlled glossy charcoal/obsidian with restrained pale/gold fractures. Keep enough soft key and rim illumination to reveal the torso, face silhouette, hands and legs against the dark stage.
- **Radiant wings:** ivory-silver feather faces, darker roots and recessed layers, fine broken gold veins. Preserve broad quiet areas so individual feather groups read before the crack pattern.
- **Hair:** retain the swept locks, using a related dark finish with slightly softer highlights so they remain distinct from the body.
- **Still:** shift the body toward quiet ivory and the wings toward cool pale silver, with subdued gold accents and enough value separation to retain the folded layers.

These are the starting palette assignments, to be judged in renders. Adjust value and roughness if the dark body disappears; do not solve that by flooding the entire scene with ambient light. Use independent body, hair and wing materials/uniforms so form transitions can change them deliberately.

Test plain clay, neutral specular material and final patterned material separately. Reduce or disable diffuse-luminance normal perturbation where it makes veins look like dents. Shape the scene with broad key highlights, a restrained cool rim and localized warm halo/trail light. Bloom should soften exceptional highlights while preserving surface detail.

**Gate:** the angel remains readable at thumbnail size in both forms. Dark anatomy, pale feathers and gold linework are distinct. No all-over hammered texture or white bloom that erases feather edges.

### 3. Add the upright halo and thin moving trails

File: `src/rings.js`, optionally separate halo/trail constructors.

Replace the current broad tilted ring-band treatment with two clearly separated systems:

1. **Upright halo:** a narrow outer gold inscription band, fine inner circles and radial marks behind the head/upper torso. Keep it in world space so it becomes an ellipse during orbit. Opaque body and feather geometry must correctly occlude its rear portions; do not draw it as a screen overlay. In Still, transition its gold treatment into delicate cool floral/loop linework behind the seated angel.
2. **Two moving trails:** slender paths around the waist and lower-body region, at different inclinations and heights. Give each a small bright moving head, a fading tail and sparse sparks. Most of the path should be faint or absent. Use a clear 3D route around the torso and wings rather than allowing bright segments to slice arbitrarily through them. Adapt their height/radius as the angel settles; in Still they may form quiet floor-level orbits beneath the figure.

The two existing broad annuli should be replaced or repurposed, not retained at full strength underneath these additions. Otherwise the composition will accumulate competing rings. Keep glyph density, trail thickness, glow width and speed independently tunable. Reuse existing rendering infrastructure where useful, but do not make the trails thick solid toruses.

**Gate:** halo inscriptions and inner marks remain crisp at normal exposure; wing tips remain unobscured; trail movement and fade are visible without large luminous bands. Check front, side/back, portrait and transition poses for intersections and incorrect occlusion.

### 4. Preserve the angel in Still and during form changes

Files: `src/forms.js`, `src/angel.js`, `src/rings.js`.

Keep the existing seated body and folded-wing behavior. Reposition and scale the halo/trails to frame that silhouette rather than using the reference's wingless seated proportions. Preserve hair and hand clearance, and keep the folded feathers visible against the pale body.

Drive body/wing palette, halo treatment and trail placement from the existing form weight. Keep state reproducible from a fixed time and blend value. No garment meshes, hidden pose swaps or character replacement are needed. Verify blend values 0, 0.25, 0.5, 0.75 and 1, plus rapid reversal.

**Gate:** both forms are unmistakably the same six-wing angel; the video's aesthetic is carried by finish, light, linework and atmosphere.

### 5. Rebuild the stage around reflection and local motion

Files: `src/floor.js`, `src/particles.js`, `src/debris.js`, `src/main.js`.

Radiant: charcoal atmosphere, restrained reflective floor, gold dust, drifting dark/pale chips and local warm light. Still: deep teal cloudy depth, cool fine particles rising above the seated figure and a soft reflection below it. The moon/light orb should remain secondary.

Reduce the current globally repetitive concentric water pattern. Use localized ripple sources with distance decay and finite lifetime; retain gentle background water motion. If matching the demonstrated pointer behavior is desired, add pointer-generated ripples as an explicit interaction, independent of the figure's central rings. Avoid treating all bright concentric marks as water: some reference circles are luminous trail effects.

Use broad low-contrast haze to create depth. Keep debris sparse enough that face, hand and wing silhouettes remain readable. Match particle scale and density before increasing particle counts.

### 6. Choreograph the transformation

Files: `src/forms.js`, `src/main.js`, relevant material/effect modules.

Use approximately the clip's 3–4 second transformation as the initial timing target, then tune from side-by-side captures. Stage it as: gather light along existing trails; expand local gold-white glow; continue the existing body/wing pose blend and shift the surface palette; reveal the new mandala and water stage; settle particles and glow.

Drive the flare separately from steady-state exposure and ring brightness. Preserve normal surface detail outside the brief transition. In reduced-motion mode, switch or gently crossfade without the intense flare. Make rapid repeated toggles converge on the requested destination without stuck brightness, duplicate particles or inconsistent halo/trail states.

Keep manual Space/button switching. The recording contains pointer activity and does not establish an automatic 30-second loop. Add an authored demo timeline only if separately requested; do not infer autoplay from the clip's duration.

### 7. Match camera and interaction

File: `src/main.js`; keep the current review URLs and Hero reset.

Use the 3-second upright frame and 14-second seated frame as lighting, atmosphere and visual-hierarchy references. Frame our full six-wing silhouette, upright halo and some reflection; retain the seated form’s closer composition. Fit bounds to the visible angel and halo, allowing for the trails’ finite extent without letting stray particles force an excessively distant camera. Preserve manual orbit and zoom; review elevated and rear views rather than optimizing only the front.

Adapt the composition separately at 1440×900 and 390×844. Phone framing must keep all three wing pairs, figure and halo identifiable without stretching or accidentally cropping them. Keep our Seraphim labels unless a separate copy change is requested; the video's text is reference content, not an instruction to replace branding or controls.

## Feasibility and scope

This is a repository-native art-direction and effects pass on the existing angel. It needs no new body model, garment, topknot, Blender workflow or 2.5D cutout. Preserve the current geometry and module interfaces; add or revise halo/trail geometry, material controls, lighting and atmospheric behavior.

The main risks are composition crowding from six wings plus the halo, dark anatomy becoming unreadable, additive trails bleeding through opaque geometry, and excessive bloom. Resolve them with fixed-camera comparisons and independent visibility/material toggles before increasing effect complexity.

## Deliverables and acceptance

Implement sequentially with one coder owning integration and verification. Review the existing angel with the halo/trail blockout before material and atmospheric polish. Keep existing module contracts, disposal behavior and `/angel/` paths. No source asset over 25 MB; preserve local `virgo/` material and existing user changes. No commit, push or deployment is implied by this plan.

Deliver reference/current contact sheets comparing aesthetic treatment while preserving our angel silhouette: upright front, seated front, three-quarter, side/back and transformation midpoint. Include 1440×900 and 390×844 captures, fixed-time repeatability, both transition directions, rapid reversal, Hero reset, manual orbit/zoom, resize, reduced-motion behavior, production build and console/request checks. Measure frame time and draw calls on identified hardware before claiming phone performance.

The first implementation should preserve the current angel and add the upright halo plus two thin moving trails, replacing the broad annulus treatment and updating framing only as needed. Verify the composition in both forms. Then apply the video-inspired material/light contrast, atmosphere and transformation polish in that order.
