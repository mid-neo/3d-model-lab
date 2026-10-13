/**
 * Resolves a site-relative asset path (e.g. "models/f35a/F35A.glb") against
 * Vite's base URL, so the same catalog works locally ("/") and on GitHub Pages
 * ("/3d-model-lab/").
 */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}
