# Virgo body, six procedural wings

Review plan — 18 October 2026. No application changes are authorized by this document.

## Recommendation

Build a **clean, body-only Virgo asset offline from the full-resolution source**, then export desktop and mobile meshes from that same cleaned master. Preserve the existing six instanced feather wings and their animation. Pair the asset work with a body-specific marble material whose color veins do not automatically become surface dents.

Start with a controlled shader/geometry comparison before spending time remeshing. If neutral shading proves the existing body sufficiently smooth, retain more of its topology; removing fused appendages and repairing the exposed back is still necessary. Do not make another blind 100k-to-50k decimation or add more browser-time smoothing as the main fix.

The desired result is a recognizable female figure in a draped gown: smooth face and arms, intentional deep cloth folds, broad polished marble highlights, restrained gold veins, and exactly three pairs of code-built wings. Preserve carved folds rather than smoothing the gown into a featureless cone.

## Relationship to `angel.jpg`

The local reference is a portrait composition of a **floating, close-fitting female figure** with her face obscured by hair. Its six wings form three unmistakable layers: a tall pair arcing above the head, a broad pair spanning the frame, and a long pair pointing below the legs. Cracked white stone and thin gold veins catch sharp light against a nearly black smoky field; two tilted gold glyph rings and small debris wrap around the figure. The lower body remains visible. The image does **not** show a draped gown or a prominent reflective floor.

This gives two coherent art directions:

| Priority | Body path | Expected resemblance |
| --- | --- | --- |
| **Closest to `angel.jpg`** | Keep/refine main's articulated close-fitting body or commission a clean sculpt modeled to the reference; reshape the existing six code wings and pose around that body. | Higher silhouette fidelity. A Virgo gown would work against this target. |
| **Virgo gown with the reference's mood** | Follow the Virgo cleanup plan below; keep the standing robed figure, but tune the six wing arcs, cracked marble, gold rings, dark haze and camera to echo the image. | Similar atmosphere and wing language, visibly different figure. |

For a close reference match, prioritize geometry and framing before more lighting work: sculpt a strong single-angle hero silhouette, bend the upper pair into a crown, spread the middle pair across the composition, and let the lower pair trail below the body without merging into one shape. Pose the body as suspended rather than standing or seated; give the hair a face-obscuring mass and keep the hands/legs readable. Reduce the visual weight of the floor reflection and use controlled dark haze behind the wing tips. Then tune marble cracks, gold vein width, ring placement and highlight rolloff. Keep the two forms, with the still form a deliberate quieter reinterpretation rather than an attempt to reproduce the single radiant reference frame.

The existing code already has a procedural body, six wings, marble/gold, rings, particles and debris, so this is an achievable redesign. Exact reproduction from one image is not guaranteed: the rear geometry and alternate viewpoints are unspecified. A locked hero camera can match the image more closely than a freely orbitable model; retain orbit only after the full 3D figure reads well from side and back. For this reference direction, compare a 2:3 portrait crop as well as the required 1440×900 and 390×844 screenshots. Do not infer visual parity from matching colors alone.

## Scope and evidence

The local checkout remains on `main`. Local commit IDs match the heads returned by GitHub for PRs #6 and #7:

| Version | Reviewed revision | Meaning |
| --- | --- | --- |
| `main` | `c254f8b` | Existing procedural body; merged work through #5 |
| [PR #6](https://github.com/tommithetechie/angel/pull/6) | `798ca52` | Open lighting/reflection upgrade based on main |
| [PR #7](https://github.com/tommithetechie/angel/pull/7) | `44eab4a` | Draft, based on #6; includes first replacement and a subsequent smoothing fix |
| [PR #8](https://github.com/tommithetechie/angel/pull/8) | `33e182d` | Open, based on main; adds `virgo/` to `.gitignore` |

PR #8's file was read through GitHub because that branch is absent locally. Local main still lists `virgo/` as untracked. Do not interpret that as permission to stage it.

This review uses branch source, asset inspection, and live PR metadata. It does **not** claim newly rendered screenshots, a measured visual-quality comparison, live deployment parity, or phone performance results. PR descriptions' screenshots and test claims are historical reports, not verification performed for this plan. The visual gates below are required before selecting final settings.

An isolated temporary extraction of #7 passed `npm run build` (Vite 6.4.4, 28 modules). This did not modify the checkout and establishes build coherence only.

### Measured asset inventory

| Asset | Bytes | Vertices / triangles before runtime cutting | Embedded images |
| --- | ---: | ---: | --- |
| Local `virgo/source/model.glb` | 63,310,544 | 616,564 / 1,064,697 | Four 2048² PNGs |
| #7 `virgo-100k.glb` | 6,195,556 | 85,692 / 101,144 | Four 2048² WebPs |
| #7 `virgo-50k-mobile.glb` | 2,415,400 | 47,032 / 50,038 | Four 1024² WebPs |

The derivatives each expose one mesh, one primitive and one material, with generic nodes rather than named body/prop parts. Their embedded textures still incur load/decode cost even though the visible body uses replacement marble. Additional local source textures should remain local too.

Replaying #7's centroid classifier retains only 44,697 desktop triangles and 19,963 mobile triangles; the filenames describe the full input, not the rendered body. The same classifier retains 507,814 triangles from the full source. Its different retention fractions across LODs reinforce the need for one explicitly cleaned master and stable silhouette, rather than independently clipping different reductions. Proposed future body budgets below refer to the body alone and can exceed today's retained body count; measure the total scene cost before accepting them.

## 1. What #7 got right, and why lumps can remain

### Keep these parts

- `GLTFLoader` uses `import.meta.env.BASE_URL`; models resolve under `/angel/models/` on Pages (`src/angel.js:162–180`).
- Desktop and mobile variants exist: `virgo-100k.glb` is 6,195,556 bytes and `virgo-50k-mobile.glb` is 2,415,400 bytes. Both are below 25 MB.
- The imported material is replaced by the scene's marble. Source texture colors are therefore not the direct explanation for the current metallic appearance.
- The six procedural wing meshes remain instanced. #7 changes their placement and folded pose to work around a standing gowned figure; it does not substitute six copies of Virgo's sculpted wings.
- Figure normalization, per-form state, body contact-shadow layer, model credit, late-load disposal handling, and the existing module interface are present.
- The second #7 commit already welds positions, performs four two-pass smoothing iterations, recomputes normals, and disables the body's tangent-space normal map. Recommending those same operations as if absent would miss the current state.

References below are branch-specific line numbers at `44eab4a`, not line numbers in the current main checkout.

### Diagnosis and confidence

| Contributor | What source establishes | Conclusion and remaining check |
| --- | --- | --- |
| Underlying sculpt and decimation | #7 starts from the reduced mesh, cuts it, welds at `1e-4`, smooths with factors `0.5/-0.53`, and recomputes normals (`angel.js:374–468`). | Broad geometric dents cannot be removed by a new material. Compare source, raw reductions, and processed body in neutral clay before attributing all lumps to decimation. Original decimator settings/history are not established by the exported GLBs. |
| Normals | Source normals and UVs are discarded when constructing the cut body; vertex normals are rebuilt after smoothing (`angel.js:401–419`). | Bad imported normals may explain an earlier attempt, but are not a sufficient diagnosis of the current rendered body. Smooth vertex normals also cannot repair a jagged silhouette or missing geometry. Normal-versus-face angle alone does not prove invalid shading: smooth surfaces intentionally differ from face normals. |
| Custom relief shader | `BODY_NORMAL` derives height from diffuse-color luminance and perturbs the normal with a `0.9` multiplier. It remains injected even when `surface.normalMap = null` and `normalScale = 0` (`angel.js:492–498`; `marble.js`, `BODY_NORMAL` and `injectFragment`). | A concrete remaining mechanism for false relief: painted dark/gold veins become shading bumps. Disable this separately during diagnosis; clearing the normal map does not disable it. Its share of the reported appearance still needs an A/B render. |
| Marble scale/projection | Projection uses figure-space coordinates multiplied by `0.17`, with triplanar weights derived from geometry normals (`marble.js:607–617`). #7 forces projected sampling with `marbleUvSpan = 1`. | It is already transformed into figure space, not simply sampling raw source units. Make scale explicit in normalized body units and keep it identical between LODs. Scale changes improve vein readability but do not repair anatomy; noisy normals may also disturb the blend between projection axes. |
| Material and HDR | The body inherits full clearcoat, very low clearcoat roughness and patterned roughness/metalness. PR #6 adds stronger structured environment reflections. | Sharp reflections expose surface chatter. Tune coat and roughness after the clay test. `metalness = 1` is multiplied by the metalness map; it does not prove all stone is metallic. Verify the stone mask is near zero and gold alone is metallic. |
| Runtime wing cut | `isWing()` uses source-coordinate thresholds; `takeTriangles()` keeps/discards whole triangles by centroid (`angel.js:345–403`). It does not cap or reconstruct cut surfaces. | This is a useful prototype separation, but creates cut-boundary risks and cannot reconstruct gown/back anatomy hidden inside the fused wings. Double-sided rendering can conceal open edges from some views; it does not repair them. |

Raw asset measurements also show worse face/vertex-normal alignment after reduction: mean absolute dot product is 0.968 for the source, 0.887 desktop and 0.807 mobile. The normals are approximately unit length, so this is not simply a missing normalization problem. These numbers concern **input normals before #7 recomputes them**, and include intentional curvature; they support investigating reduction quality but do not establish the dominant cause of the final appearance. Raw split vertices likewise inflate apparent component/boundary counts; inspect topology after welding before reporting actual holes or disconnected body pieces.

### First visual experiment

Use one fixed camera, time, exposure and light rig. Compare the full source locally, raw desktop/mobile reductions, and #7's processed body. For each, inspect (a) matte neutral clay with no maps or shader injection, (b) smooth specular neutral stone, and (c) final marble. Separately toggle custom luminance bump, then roughness/metalness maps, then coat. Use face/shoulder and gown close-ups plus front, side and back views.

- Dents in silhouette or clay: geometry cleanup is needed.
- Smooth clay but disturbed specular without maps: inspect geometry normals and topology.
- Smooth neutral stone but hammered final marble: fix material/shader before changing topology again.
- Full source already lumpy: re-decimation alone cannot create a clean sculpt.

## 2. Options ranked

Quality ranks refer to the requested Virgo likeness and polished finish, assuming skilled execution. Effort is relative; these are not time estimates.

| Rank | Option | Expected result | Effort / limitations |
| --- | --- | --- | --- |
| 1 | Clean original offline: selective sculpt smoothing, local reconstruction/retopology, then independent desktop/mobile exports | Best balance of Virgo likeness, clean anatomy and convincing folds; recommended | High asset work, moderate integration; preserves recognizable source detail |
| 2 | Manually retopologize/re-sculpt most of the Virgo body from the source reference | Highest controllability where the AI surface is fundamentally damaged | Very high; requires an artist, especially face, hands and cloth |
| 3 | Re-decimate the full source using feature-protected regions and better normals | Good if the source already has clean surfaces | Medium; cannot fix source dents, fused props or a missing back by itself |
| 4 | Use a different, clean robed statue model | Potentially excellent finish but uncertain Virgo likeness | Medium search/licensing/integration; no specific substitute has been vetted |
| 5 | Keep #7's body; fix bump, projection scale, metal mask and coat only | Fast improvement if most damage is shading | Low; retains geometric artifacts and crude wing-cut boundaries |
| 6 | Sculpt a Virgo-like body procedurally in code | Predictable small asset cost, stylized gown silhouette | High for a convincing face/hands/drapery; low likelihood of matching this sculpt |

**Remeshing is a tool within options 1–2**, not an automatic beautifier. Use local remeshing where cuts or topology require it. Whole-body voxel remeshing at coarse resolution can erase fingers, face and thin folds; high resolution can multiply triangle count. Preserve a master and compare protected landmarks before accepting any pass. Blender distinguishes remeshing from decimation in its [retopology documentation](https://docs.blender.org/manual/en/latest/modeling/meshes/retopology.html), and its [Decimate documentation](https://docs.blender.org/manual/en/4.4/modeling/modifiers/generate/decimate.html) describes face reduction rather than sculpt repair.

**A clean normal-map bake is optional finishing work**, not a replacement for geometry repair. Bake only from the cleaned high-resolution master to the final triangulated, UV-unwrapped lower mesh, with a checked cage and matching tangent basis. Baking the original noisy surface simply preserves its dents. Keep only purposeful fine folds/detail, use linear normal data, and test grazing light and UV seams. The current synthetic UVs are not a suitable production bake atlas; replace them. If using a tangent-space bake alongside projected color, do not also apply the existing color-derived bump. Omit the bake if the no-map result is already good enough.

## 3. Remove fused appendages and attach the six wings

### Offline body preparation

1. Preserve `virgo/source/model.glb` untouched. Work on a local duplicate inside the ignored source workspace. Record source hash, tool version, scale/orientation, selections and export settings in a small text recipe.
2. Inspect topology in solid and wireframe views. A single mesh object does not alone prove every part is connected. Use connected-component inspection where helpful, but do not expect selectable wing/prop objects or rely on material slots for removal.
3. Mask the face, hands, arms and important gown folds. Mark wing-to-back/gown attachment boundaries manually from multiple views. Remove the outer wing surfaces, then reconstruct the exposed back and gown using local retopology, bridged patches or localized sculpt/remesh work. Avoid a global spatial crop that can remove sleeves or hair.
4. Delete staff/wheat geometry only where it can be separated without sacrificing fingers or garment folds. At fused grips, rebuild the palm/fingers and nearby cloth rather than leaving holes or flattened stumps. If that reconstruction does not pass close-up review, keep the smallest coherent prop section for an explicitly documented first milestone; do not silently claim a prop-free body.
5. Repair open seams, reversed faces, non-manifold defects and unintended self-intersections. Preserve intentional garment openings and thickness. Use front-sided diagnostic rendering to reveal holes; do not hide them using `DoubleSide` alone.
6. Apply selective smoothing with face, silhouette, hands and fold ridges protected. Check specular highlights before decimation. Recompute appropriate smooth normals, retaining intentional sharp folds. Export each LOD from this master, not the mobile LOD from an already reduced desktop file.

### Wing integration

Retain the feather geometry generator, six wing instances, recipe generation and interpolation. Replace the runtime `isWing`/`takeTriangles`/smoothing pipeline with a pre-cleaned body asset.

Normalize both LODs to one documented origin, orientation and height. #7 currently targets height `2.16`, hem `0.2`, rotates the model by π, and derives roots from overall bounds. Use these as compatibility starting points, not final artistic measurements: removing props or wings changes those bounds.

Author six sockets in normalized figure coordinates: left/right shoulder, mid-back and lower-back. Both LODs share the same socket transforms. Give each root an outward/backward direction and a small concealed overlap or sculpted socket cover; feather roots should appear attached, not floating behind a bounding-box plane. Restrict intentional overlap to the concealed attachment region.

Test the full wing sweep against the head, arms, gown and other wing pairs at blend values 0, .25, .5, .75 and 1, including motion extremes. Move pivots and reshape the existing curve control points to create clearance. Require three distinct pairs in the hero views and clean side/back silhouettes; do not solve clipping by hiding whole pairs. Check floor clearance and reflected intersections too.

## 4. Lighting, forms, ownership and mobile

### PR #6 and the surface

Use #6 as the integration foundation. Preserve its procedural HDR environments, PMREM resources, AgX mapping, floor reflector, body contact mask, ring metal, shafts and per-form transitions. There is no downloaded HDRI to replace. Compare material changes under both environments; do not dim the entire scene to conceal damaged geometry.

Create body-specific controls without changing the wing material's established appearance. Start with opaque dielectric marble, metal only in the gold mask, no color-derived bump and a moderate polished roughness. Trial ranges such as roughness 0.22–0.35 and clearcoat 0–0.3 are tuning starts, not guaranteed final values. Retain warm gold emission in radiant and subdued cooled veins in still. A modest coating can be useful, but [Three.js documents clearcoat as an additional reflective layer and notes the per-pixel cost of physical material features](https://threejs.org/docs/pages/MeshPhysicalMaterial.html); do not add transmission or more layers merely to make the material sound realistic.

### Forms and module contract

Keep `{ group, update(time, dt), setForm(form, t), dispose }`. Construct and return `group` synchronously; asset loading remains asynchronous inside the module. Preserve the latest form blend while loading and apply it when the mesh arrives. `t=0` means the opposite form and `t=1` the named form; support reversal mid-transition and direct `?form=still` startup.

The default plan keeps Virgo **standing in both forms**, as #7 does. Still changes wing pose, motion, marble, moon/water and lighting. Restoring main's seated-body transformation would require a separately rigged/skinned sculpt and substantial pose work; it is not provided by the static Virgo mesh and is outside this body replacement plan.

Retain the body name/contact layer expected by #6, exclude wings from its contact mask, and verify shadow/reflection placement after normalization. Define ownership explicitly: angel owns loaded body geometry and wing instance resources; marble owns shared maps/materials and registered clones; environment/floor own their targets. Avoid double-disposal of shared textures. On dispose-before-load, release late assets without attaching them; normal disposal must be idempotent. Release unused imported maps/materials promptly rather than retaining source PBR resources for the life of the scene. Provide a visible load-failure state, not an apparently successful empty angel.

### Performance budget

- Initial body targets: roughly 80–120k triangles desktop and 30–50k mobile, adjusted only after silhouette review. These are proposed budgets, not measured performance promises.
- Aim for ≤6 MB desktop and ≤3 MB mobile geometry assets, with no individual committed file above **25,000,000 bytes**. Strip unused embedded source textures; any new bake has an explicit memory/download budget (start at 2k desktop, 1k mobile).
- Load only the selected LOD. Preserve #7's narrow/coarse-pointer policy initially and make selection observable for QA. Avoid downloading desktop first and replacing it afterward. Rotating a phone should not cause repeated downloads or reset the form.
- Offline processing removes the startup weld/adjacency/smoothing allocation burden. If compression is later justified, include decoder paths under `/angel/` and measure decode time as well as transfer savings.
- Keep instanced wings and #6's reduced mobile effects. Body triangle count is only part of cost: reflection renders the scene again, and bloom, physical shading, transparent effects, render-target size and DPR also matter.
- Current code already reduces feather instances from roughly 1,290 to 500, caps renderer DPR at 1.6/1.15, and reduces the contact target from 320² to 160² with alternate-frame updates. Preserve these quality policies while profiling the new body.
- Measure a 30-second warmed orbit/toggle run on a named real phone: target sustained 30 fps or better, with frame-time distribution, startup/load time and memory observations recorded. Desktop target is 60 fps on a named test machine. Viewport emulation is visual QA, not proof of phone performance. If unavailable, mark device performance unverified.

## 5. Proposed PR-sized sequence

These are future changes for review. Do not merge or push main. Use separate `codex/…` branches with explicit dependencies; do not blindly merge #7 wholesale and then duplicate #6. #7 contains useful integration code but should remain a reference until its replacement assets and material pass the gates.

| Step | Deliverable / dependency | Acceptance gate |
| --- | --- | --- |
| 1 — Source guard and attribution | Carry forward #8's ignore rule; document source/license/asset recipe location. No source asset commits. | `virgo/source/model.glb` is ignored; tracked-file list excludes `virgo/`; scan proposed added blobs for the 25 MB cap. Preserve exact credit below in README and site once Virgo integration is present. |
| 2 — Baseline and diagnostic comparison | On a branch with #6/#7 available for comparison, add a small reproducible development-only capture/diagnostic path. Record fixed camera/time/form/LOD and asset readiness. | Capture main, #6 and #7 at all four viewport/form combinations; complete clay/specular/shader A/B and close-ups. Record which defects survive neutral shading. No claim that a historical screenshot proves the new branch. |
| 3 — Clean desktop body asset | Offline cut, reconstruction, selective smoothing and desktop export; small manifest/recipe. Depends on step 2. Full master stays local. | Gown/face likeness accepted in neutral and specular views; no source wings, open cut scars or accidental missing hands. Record any retained prop exception. New asset validates and is below cap. Four-frame in-scene diagnostic set plus front/side/back close-ups. |
| 4 — Body loader and sockets | Integrate the cleaned asset, remove runtime surgery, preserve all six code wings, add authored socket data and robust loading/disposal. Based on #6 plus selected #7 integration. | Four-frame set; five blend samples in both transition directions; no visible clipping or floating roots from front/side/back. Delayed load, load failure and dispose-before-load checks pass. Body participates correctly in reflection/contact mask. |
| 5 — Polished marble | Body-only shader/material tuning; independent vein scale and relief, correct stone/gold mask. Optional clean bake only if needed. | Same four frames and fixed-light close-ups compared with neutral controls. Smooth broad highlights, readable carved folds, no glitter/dent pattern introduced by color, no loss of existing wing look. Check shader compilation in both forms. |
| 6 — Mobile LOD and framing | Mobile export from the same master, single-request selection, resource cleanup; retune framing including #7's reported still-moon edge issue. | 390×844 in both forms at phone DPR/coarse pointer; verify mobile URL and no desktop download. Compare LOD silhouette/material scale. Rotate/resize and toggle. Record real-device performance; preserve credit/button visibility. |
| 7 — Production verification and docs | Finish attribution/modification note, resource manifest and regression evidence on built `/angel/` preview. | `npm run build`; deep-link still, reload, toggles, network/console, lifecycle and final screenshot matrix all pass. Confirm no `virgo/` or oversized blobs in proposed diff. Deliver reviewable PRs/evidence without merging or pushing main. |

For asset/documentation-only steps, capture the unchanged site or the designated integration preview and label it accordingly; do not imply the asset is integrated before step 4. Keep every step buildable. A failed sculpt or visual gate returns to the relevant asset/material step before proceeding.

### Required screenshot and runtime protocol

Every visible-change PR includes `desktop-radiant` and `desktop-still` at **1440×900**, and `mobile-radiant` and `mobile-still` at **390×844**, with exact CSS viewport, DPR, pointer mode, commit, browser, LOD and capture time recorded. Wait for model/environment readiness and transition completion; freeze camera drift/animation in the development capture path so comparisons are meaningful. Keep separate captures of the normal intro/automatic camera behavior.

Include front hero framing and additional close-ups of face, hands, gown, back repairs and wing sockets. Record transition samples and a short orbit/toggle clip for clipping/shimmer that still images miss. Test reduced motion, touch orbit, Space/button toggle, rapid reversal, resize and direct still loading. All six wings, halo, body, floor relationship, button and credit must compose cleanly at both viewports; the mobile moon must not look accidentally cropped.

Run against the built site at `/angel/`, not only Vite dev. Require no unexpected console errors, shader warnings or missing asset/decoder requests. Exercise repeated creation/disposal in a development harness and confirm GPU resource counts stabilize; account for shared renderer caches instead of requiring a literal zero. Test disposal while loading and after loading. Screenshot comparison does not replace these checks.

## Attribution and repository boundaries

Keep this exact visible line on the site and in README:

> "Virgo" by Ognomdrol (Sketchfab), CC BY 4.0

Link the title/author to the [existing Sketchfab source](https://sketchfab.com/3d-models/virgo-369b136160b14d2d9067c171555b85aa) and the license to [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Add an adjacent modification note identifying mesh cleanup, appendage removal, decimation and replacement materials. Do not obscure the credit behind the mobile control. The source link and attribution are preserved from #7/user requirements; independent retrieval of the Sketchfab page was unavailable in this review.

Do not commit `virgo/`, `.blend` working masters or any file over 25 MB. Keep only approved optimized runtime assets and small recipes/manifests in version control. A `.gitignore` rule prevents routine accidental addition but is not a size-enforcement mechanism; inspect the proposed commit contents as well. Do not merge or push to main.
