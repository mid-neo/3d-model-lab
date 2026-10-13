# 3D Model Lab

Interactive 3D models to explore and learn from, in the browser. The catalog
has the **F-35A** and the **F-22A**; the project is built so other aircraft and
unrelated models can be added without touching the viewer engine.

Static site: TypeScript, Vite and Three.js. No backend, no login.
Deploys to GitHub Pages: `https://mid-neo.github.io/3d-model-lab/` once Pages
is enabled (see [Deployment](#deployment)).

## Features (v0.1)

- Model catalog (F-35A, F-22A), linkable as `#/model/<id>`.
- Large 3D viewport: rotate, zoom and pan with mouse or touch (OrbitControls).
- Front, side, top and perspective views, each framed from the model's own
  geometry. Reset camera.
- **Rotate 360°**: one full turn around the model, then it stops where it
  started. Dragging the model cancels it.
- Wireframe toggle and adjustable lighting (key light intensity and direction,
  ambient light).
- Downloads: the GLB model, plus per-model extras (the F-35A's original
  standalone HTML viewer, the F-22A's original FlightGear source files).
- Loading progress, error state with retry, and a WebGL check. Without WebGL
  the page links to the original viewer, which draws with a 2D canvas.
- Dimensions shown in the panel are measured from the model's bounding box,
  not official specifications.

## Getting started

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev        # http://localhost:5173/3d-model-lab/
npm test           # unit tests (framing math, catalog integrity)
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ at http://localhost:4173/3d-model-lab/
```

The site always runs under a base path (default `/3d-model-lab/`) so local runs
match GitHub Pages. Override it with `BASE_PATH`, e.g.
`BASE_PATH=/ npm run build` for a root-domain deployment.

## Project structure

```
index.html                  Page layout and control markup
public/models/<id>/         Model assets, served as-is (GLB, extra downloads, CREDITS.md)
src/
  main.ts                   App wiring: routing, loading flow, states
  assets.ts                 Resolves asset paths against the deploy base path
  catalog/
    types.ts                ModelEntry metadata schema
    models.ts               The catalog: one entry per model
  viewer/
    Viewer.ts               Three.js engine: renderer, GLTF loading, camera presets,
                            wireframe, lighting, 360° turn. No catalog or DOM knowledge.
    framing.ts              Model axes, view directions, fit-to-frame distance
    webgl.ts                WebGL availability check
  ui/
    controls.ts             Binds toolbar and display controls to a Viewer
    catalogList.ts          Catalog sidebar
    modelPanel.ts           Details, measurements, downloads, credits
    overlay.ts              Loading / error / no-WebGL overlay
    dom.ts                  Small DOM helpers
  styles.css                Dark blue theme, responsive layout
tests/                      Vitest unit tests
tools/ac2glb.py             AC3D (.ac) to GLB converter used for the F-22A
.github/workflows/          CI for PRs, GitHub Pages deployment from main
```

## Adding a model

1. Put the files under `public/models/<id>/`, e.g. `public/models/a10/A10.glb`.
   Use glTF binary (`.glb`) with embedded textures. Add a `CREDITS.md` with the
   source and license you verified.
2. Add an entry to `src/catalog/models.ts`:

   ```ts
   {
     id: 'a10',
     name: 'A-10C',
     category: 'Aircraft',
     summary: 'One or two sentences about this model.',
     modelPath: 'models/a10/A10.glb',
     // Direction the model faces and its up axis, in the file's coordinates.
     orientation: { forward: [0, 0, -1], up: [0, 1, 0] },
     units: 'm',
     downloads: [{ label: '3D model', path: 'models/a10/A10.glb', fileName: 'A10.glb', format: 'GLB · 2.1 MB' }],
     credits: {
       author: '…',
       sourceName: '…',
       sourceUrl: 'https://…',
       license: 'CC BY 4.0',
       licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
     },
   },
   ```

3. Run `npm test`: it checks that every referenced file exists and the entry is
   well-formed.

That is all. The viewer rotates the model into its convention from
`orientation`, then derives camera distance, clipping planes, zoom limits,
light placement and the four preset views from the model's geometry. Nothing
is tuned to the F-35. Paths are relative to the site root (no leading slash)
so they work under any base path. Categories are free text and group the
catalog automatically.

To find `orientation`, check which axis the front of the model points along
(for an aircraft, where the nose is) and which axis is up. glTF files are
usually Y-up.

## Deployment

`.github/workflows/deploy.yml` builds and deploys on every push to `main`
(or manually from the Actions tab). One-time setup: in the repository's
**Settings → Pages**, set **Source** to **GitHub Actions**.

The workflow sets `BASE_PATH=/<repository name>/`, so asset URLs stay correct
if the repository is renamed or forked.

## Credits and licenses

- **Application code**: MIT License, see [`LICENSE`](LICENSE).
- **F-35A model** (`public/models/f35a/F35A.glb` and `F35A-Viewer.html`):
  by Marek Cel, from [MScSim data](https://github.com/marek-cel/mscsim-data),
  released under [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).
  The upstream repository's license was checked on 2026-10-13; details and
  what could not be verified are in
  [`public/models/f35a/CREDITS.md`](public/models/f35a/CREDITS.md).
- **F-22A model** (`public/models/f22/`): by Fabrizio Fracaroli (AeroFab),
  from the [FlightGear FGAddon](https://sourceforge.net/p/flightgear/fgaddon/HEAD/tree/trunk/Aircraft/Lockheed-Martin-FA-22A-Raptor/)
  aircraft package, under the
  [GNU GPL v2](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html).
  `F22.glb` is converted from the upstream `.ac` file; the unmodified source
  files are shipped next to it as `F22-source.zip`. Details in
  [`public/models/f22/CREDITS.md`](public/models/f22/CREDITS.md).
- [Three.js](https://threejs.org/) (MIT) for rendering, glTF loading and
  orbit controls.

Model licenses are independent of the code license. Every model's license is
shown in the app next to the model.

## Roadmap

Planned, not implemented in this version:

- **Part selection**: click a part to highlight it and see its name.
  Needs models split into named meshes; the current F-35A is a single mesh.
- **Exploded views**: animate parts apart along their assembly axes.
- **Comparisons**: two models side by side or overlaid at the same scale.
- **Papercraft export**: unfold a simplified model into printable A4 sheets
  with glue tabs.
- More models in the catalog, including non-aircraft.
