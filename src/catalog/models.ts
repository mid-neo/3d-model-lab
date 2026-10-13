import type { ModelEntry } from './types';

/**
 * The model catalog. Adding a model means dropping its files under
 * public/models/<id>/ and appending an entry here; the viewer needs no changes.
 */
export const catalog: readonly ModelEntry[] = [
  {
    id: 'f35a',
    name: 'F-35A',
    category: 'Aircraft',
    summary:
      'Simplified exterior display model of the F-35A with its original gray texture, derived from the MScSim flight simulator data.',
    modelPath: 'models/f35a/F35A.glb',
    // Measured from the GLB: the canopy sits at -Z, Y is up, the wings span X.
    orientation: { forward: [0, 0, -1], up: [0, 1, 0] },
    units: 'm',
    downloads: [
      { label: '3D model', path: 'models/f35a/F35A.glb', fileName: 'F35A.glb', format: 'GLB · 339 KB' },
      {
        label: 'Original standalone viewer',
        path: 'models/f35a/F35A-Viewer.html',
        fileName: 'F35A-Viewer.html',
        format: 'HTML · offline · 550 KB',
      },
    ],
    standaloneViewerPath: 'models/f35a/F35A-Viewer.html',
    credits: {
      author: 'Marek Cel',
      sourceName: 'MScSim (mscsim-data)',
      sourceUrl: 'https://github.com/marek-cel/mscsim-data',
      license: 'CC0 1.0 Universal',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      notes: 'Simplified exterior display model; surface details are reduced compared with the simulator asset.',
    },
  },
];

export function findModel(id: string | undefined): ModelEntry | undefined {
  return catalog.find((entry) => entry.id === id);
}
