/** A 3D vector expressed in the model's own coordinate system. */
export type Vec3 = readonly [number, number, number];

export interface ModelDownload {
  /** Button label, e.g. "3D model (GLB)". */
  label: string;
  /** Path relative to the site root (no leading slash), e.g. "models/f35a/F35A.glb". */
  path: string;
  /** File name suggested to the browser. */
  fileName: string;
  /** Short format hint shown next to the label. */
  format: string;
}

export interface ModelCredits {
  author: string;
  sourceName: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
  /** Free-form provenance notes (what was verified, what was changed). */
  notes?: string;
}

export interface ModelEntry {
  /** URL-safe identifier, also used in the location hash (#/model/<id>). */
  id: string;
  name: string;
  /** Catalog grouping, e.g. "Aircraft", "Vehicles", "Objects". */
  category: string;
  summary: string;
  /** glTF binary path relative to the site root. */
  modelPath: string;
  /**
   * Model orientation. The viewer derives front/side/top views from these
   * axes, so models authored with any convention frame correctly.
   */
  orientation: {
    /** Direction the model "faces" (e.g. an aircraft's nose). */
    forward: Vec3;
    up: Vec3;
  };
  /** Unit of the model's coordinates, used only to label measured bounds. */
  units?: string;
  downloads: ModelDownload[];
  /** Optional self-contained viewer that works without WebGL. */
  standaloneViewerPath?: string;
  credits: ModelCredits;
}
