# F-35A model: source and license

| | |
|---|---|
| Files | `F35A.glb`, `F35A-Viewer.html` |
| Author | Marek Cel |
| Source | MScSim flight simulator data, https://github.com/marek-cel/mscsim-data |
| License | CC0 1.0 Universal (public domain dedication), https://creativecommons.org/publicdomain/zero/1.0/ |

## What was verified

- The `marek-cel/mscsim-data` repository's `LICENSE` file is the CC0 1.0
  Universal text, and GitHub reports the repository license as CC0-1.0
  (checked 2026-10-13).
- The MScSim project README lists the F-35A among its simulated aircraft and
  names `mscsim-data` as its data package.
- The GLB's own metadata says: `"copyright": "Marek Cel / MScSim; CC0 1.0"`,
  `"source": "https://github.com/marek-cel/mscsim-data"`, `"units": "meters"`,
  and describes it as a "Simplified exterior display model".

## What was not verified

- The exact upstream file this GLB was converted from. The GLB was supplied
  as a simplified export (generator: "F35 Movable 3D export"); the conversion
  itself is not part of the upstream repository.

## Files in this folder

- `F35A.glb`: supplied model, unmodified (SHA-256
  `2d208e0ed363ff00d14012b8c581c0ddbe5ffa8d0a2ead7812c4a6c553280803`).
- `F35A-Viewer.html`: supplied self-contained viewer, unmodified (SHA-256
  `b3d195e3e87aaee2184f207b2d79c5622464ff73df2ef597f83347bc75780090`). It
  embeds the same geometry and texture and draws with a 2D canvas, so it
  works offline and without WebGL.

CC0 does not require attribution; it is given here as a courtesy and for
provenance. The CC0 license covers these model files only. The application
code in this repository is under the MIT License (see `/LICENSE`).
