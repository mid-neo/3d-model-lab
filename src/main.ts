import './styles.css';
import { assetUrl } from './assets';
import { catalog, findModel } from './catalog/models';
import type { ModelEntry } from './catalog/types';
import { renderCatalog } from './ui/catalogList';
import { bindControls, type ControlsHandle } from './ui/controls';
import { byId } from './ui/dom';
import { renderCredits, renderDownloads, renderMeasurements, renderModelHeader } from './ui/modelPanel';
import { Overlay } from './ui/overlay';
import { Viewer } from './viewer/Viewer';
import { isWebGLAvailable } from './viewer/webgl';

const overlay = new Overlay(byId('overlay'));
const viewport = byId('viewport');
const catalogList = byId('catalog-list');

type ViewerState = 'loading' | 'ready' | 'error' | 'no-webgl';
/** Exposed as data-state on the viewport for styling and automated checks. */
function setState(state: ViewerState): void {
  viewport.dataset.state = state;
}

let viewer: Viewer | null = null;
let controls: ControlsHandle | null = null;

function disableAllControls(): void {
  for (const element of document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('.toolbar button, .panel input, .panel button')) {
    element.disabled = true;
  }
}

function startViewer(): boolean {
  if (!isWebGLAvailable()) return false;
  try {
    viewer = new Viewer(viewport);
  } catch (error) {
    console.error('Could not create the WebGL renderer', error);
    return false;
  }
  controls = bindControls(viewer);
  viewer.renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    const entry = currentEntry();
    setState('error');
    overlay.error(entry, 'The graphics context was lost (the GPU may be busy or was reset).', () => location.reload());
  });
  return true;
}

function currentEntry(): ModelEntry {
  const match = /^#\/model\/([\w-]+)/.exec(location.hash);
  return findModel(match?.[1]) ?? catalog[0]!;
}

async function show(entry: ModelEntry): Promise<void> {
  renderCatalog(catalogList, catalog, entry.id);
  renderModelHeader(entry);
  renderDownloads(entry);
  renderCredits(entry);
  renderMeasurements(entry, null);

  if (!viewer) {
    setState('no-webgl');
    overlay.noWebGL(entry);
    return;
  }
  setState('loading');
  controls?.setEnabled(false);
  const onProgress = overlay.loading(entry);
  try {
    const info = await viewer.load({
      url: assetUrl(entry.modelPath),
      forward: entry.orientation.forward,
      up: entry.orientation.up,
      onProgress,
    });
    if (currentEntry().id !== entry.id) return;
    overlay.hide();
    setState('ready');
    renderMeasurements(entry, info);
    controls?.markView('perspective');
    controls?.setEnabled(true);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    console.error(`Failed to load ${entry.modelPath}`, error);
    setState('error');
    overlay.error(entry, describeLoadError(error), () => void show(entry));
  }
}

function describeLoadError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (/404|not found/i.test(text)) return 'The model file was not found on the server.';
  if (/fetch|network/i.test(text)) return 'A network error interrupted the download. Check your connection and try again.';
  return `The file could not be read as a glTF model (${text}).`;
}

if (!startViewer()) disableAllControls();
window.addEventListener('hashchange', () => void show(currentEntry()));
void show(currentEntry());
