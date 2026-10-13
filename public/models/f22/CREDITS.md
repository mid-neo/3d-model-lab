# F-22A model: source and license

| | |
|---|---|
| Files | `F22.glb`, `F22-source.zip` |
| Author | Fabrizio Fracaroli (AeroFab), 2010 |
| Source | FlightGear FGAddon, `trunk/Aircraft/Lockheed-Martin-FA-22A-Raptor`, https://sourceforge.net/p/flightgear/fgaddon/HEAD/tree/trunk/Aircraft/Lockheed-Martin-FA-22A-Raptor/ |
| License | GNU General Public License version 2, see `GPL-2.0.txt` in this folder |

## What was verified

- The aircraft's `f22-yasim-set.xml` and `f22-jsbsim-set.xml` carry a header
  "Copyright (c) 2010 Fabrizio Fracaroli", stating the files may be copied,
  redistributed and modified "under the terms of the GNU General Public
  License as published by the Free Software Foundation, either version 2 of
  the License" (checked 2026-10-13). The header also includes an ISC-style
  permission notice from the same author.
- The 3D model `Models/Lockheed-Martin-FA-22A-Raptor.ac` and its textures are
  part of that same aircraft package. The `.ac` file itself has no license
  header (AC3D files have no comment field), so its license is taken from the
  package header above.

## What was not verified

- Whether the 2010 model was built entirely from scratch. The author's notice
  is the only provenance information in the package.
- The header's wording ("either version 2 of the License") does not include
  the usual "or any later version"; this is treated as GPL version 2 only.

## Files in this folder

- `F22.glb` (SHA-256
  `8900872ed3c298cea3de1e9195f73edf0c0951d20bba7540bb8d9a9e44981933`):
  converted from the `.ac` file with `tools/ac2glb.py` in this repository.
  Changes from the original: the `pilot-view` helper point and the
  semi-transparent `hud-screen` glass are omitted; geometry is triangulated
  and indexed with normals computed from AC3D's smoothing flags and crease
  angle; textures are re-encoded as JPEG. Coordinates are unchanged
  (meters, nose toward -X, Y up). To rebuild it from the source zip:

  ```bash
  GLTF_EXTRAS='{"title":"Lockheed Martin F-22A Raptor (FlightGear FGAddon model)","author":"Fabrizio Fracaroli (AeroFab)","license":"GPL-2.0","source":"https://sourceforge.net/p/flightgear/fgaddon/HEAD/tree/trunk/Aircraft/Lockheed-Martin-FA-22A-Raptor/","units":"meters","converted":"AC3D to glTF by 3d-model-lab tools/ac2glb.py; pilot-view and hud-screen omitted; textures re-encoded as JPEG"}' \
    python3 -I tools/ac2glb.py Lockheed-Martin-FA-22A-Raptor/Models/Lockheed-Martin-FA-22A-Raptor.ac F22.glb --drop pilot-view,hud-screen
  ```

  (needs `numpy` and `Pillow`; this reproduced the file byte for byte on
  2026-10-13).
- `F22-source.zip` (SHA-256
  `60a6bf309a79ad9e77b432d6e6d36676d7a9012d7ef0c2821dc262c9c3e72823`): the
  unmodified upstream files used for the conversion (the `.ac` model, its
  seven textures, and `f22-yasim-set.xml` with the license header), plus the
  GPL text. This is the source form of `F22.glb` under the GPL.
- `GPL-2.0.txt`: the GNU GPL version 2 text.

The GPL applies to these model files only. The application code in this
repository, including `tools/ac2glb.py`, is under the MIT License (see
`/LICENSE`).
