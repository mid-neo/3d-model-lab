import { DEFAULT_LIGHTING, type LightingSettings, type Viewer } from '../viewer/Viewer';
import type { ViewName } from '../viewer/framing';
import { byId } from './dom';

export interface ControlsHandle {
  /** Enable or disable the camera/display controls (e.g. while loading). */
  setEnabled(enabled: boolean): void;
  /** Mark a preset as selected without moving the camera. */
  markView(view: ViewName | null): void;
}

type SliderKey = keyof LightingSettings;
const sliders: { key: SliderKey; id: string; format: (v: number) => string }[] = [
  { key: 'intensity', id: 'light-intensity', format: (v) => v.toFixed(2) },
  { key: 'azimuth', id: 'light-azimuth', format: (v) => `${Math.round(v)}°` },
  { key: 'ambient', id: 'light-ambient', format: (v) => v.toFixed(2) },
];

/** Wires the DOM controls in index.html to a Viewer instance. */
export function bindControls(viewer: Viewer): ControlsHandle {
  const viewButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-view]')];
  const resetButton = byId<HTMLButtonElement>('reset-camera');
  const spinButton = byId<HTMLButtonElement>('rotate-360');
  const wireframe = byId<HTMLInputElement>('wireframe-toggle');
  const resetLighting = byId<HTMLButtonElement>('reset-lighting');
  const interactive: (HTMLButtonElement | HTMLInputElement)[] = [...viewButtons, resetButton, spinButton, wireframe];

  const markView = (view: ViewName | null) => {
    for (const button of viewButtons) button.setAttribute('aria-pressed', String(button.dataset.view === view));
  };

  for (const button of viewButtons) {
    button.addEventListener('click', () => {
      const view = button.dataset.view as ViewName;
      viewer.setView(view);
      markView(view);
    });
  }

  resetButton.addEventListener('click', () => {
    viewer.resetCamera();
    markView('perspective');
  });

  spinButton.addEventListener('click', () => viewer.rotate360());
  viewer.onSpinChange = (spinning) => {
    spinButton.disabled = spinning;
    spinButton.textContent = spinning ? 'Rotating…' : 'Rotate 360°';
  };

  // Dragging the model leaves any preset, so clear the selected state.
  viewer.renderer.domElement.addEventListener('pointerdown', () => markView(null));
  viewer.renderer.domElement.addEventListener('wheel', () => markView(null), { passive: true });

  wireframe.addEventListener('change', () => viewer.setWireframe(wireframe.checked));

  const syncSliders = (settings: LightingSettings) => {
    for (const { key, id, format } of sliders) {
      byId<HTMLInputElement>(id).value = String(settings[key]);
      byId<HTMLOutputElement>(`${id}-value`).textContent = format(settings[key]);
    }
  };
  for (const { key, id, format } of sliders) {
    const input = byId<HTMLInputElement>(id);
    input.addEventListener('input', () => {
      const value = Number(input.value);
      viewer.setLighting({ [key]: value });
      byId<HTMLOutputElement>(`${id}-value`).textContent = format(value);
    });
  }
  resetLighting.addEventListener('click', () => {
    viewer.setLighting(DEFAULT_LIGHTING);
    syncSliders(DEFAULT_LIGHTING);
  });
  syncSliders(viewer.getLighting());

  return {
    setEnabled(enabled) {
      for (const control of interactive) control.disabled = !enabled;
      if (enabled && viewer.isSpinning) spinButton.disabled = true;
    },
    markView,
  };
}
