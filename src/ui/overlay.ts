import { assetUrl } from '../assets';
import type { ModelEntry } from '../catalog/types';
import { el } from './dom';

/** Loading, error and "WebGL unavailable" states drawn over the viewport. */
export class Overlay {
  constructor(private readonly root: HTMLElement) {}

  hide(): void {
    this.root.hidden = true;
    this.root.replaceChildren();
    this.root.className = 'overlay';
  }

  loading(entry: ModelEntry): (fraction: number | null) => void {
    const bar = el('div', { className: 'progress-bar' });
    const label = el('p', { className: 'overlay-detail', text: 'Downloading model…' });
    const progress = el(
      'div',
      { className: 'progress', role: 'progressbar', 'aria-label': `Loading ${entry.name}`, 'aria-valuemin': '0', 'aria-valuemax': '100' },
      bar,
    );
    this.show('is-loading', el('div', { className: 'spinner', 'aria-hidden': 'true' }), el('p', { className: 'overlay-title', text: `Loading ${entry.name}` }), progress, label);
    return (fraction) => {
      if (fraction === null) {
        progress.classList.add('is-indeterminate');
        progress.removeAttribute('aria-valuenow');
        return;
      }
      const percent = Math.round(fraction * 100);
      progress.classList.remove('is-indeterminate');
      bar.style.width = `${percent}%`;
      progress.setAttribute('aria-valuenow', String(percent));
      label.textContent = `Downloading model… ${percent}%`;
    };
  }

  error(entry: ModelEntry, message: string, retry: () => void): void {
    const retryButton = el('button', { type: 'button', className: 'btn btn-accent', text: 'Try again' });
    retryButton.addEventListener('click', retry);
    this.show(
      'is-error',
      el('p', { className: 'overlay-title', text: `Couldn’t load ${entry.name}` }),
      el('p', { className: 'overlay-detail', text: message }),
      el('div', { className: 'overlay-actions' }, retryButton, ...fallbackLinks(entry)),
    );
  }

  noWebGL(entry: ModelEntry): void {
    this.show(
      'is-error',
      el('p', { className: 'overlay-title', text: '3D graphics (WebGL) aren’t available' }),
      el('p', {
        className: 'overlay-detail',
        text: 'Your browser or device has WebGL turned off or unsupported, so the interactive viewer can’t start. The original viewer draws the model without WebGL.',
      }),
      el('div', { className: 'overlay-actions' }, ...fallbackLinks(entry)),
    );
  }

  private show(state: string, ...children: Node[]): void {
    this.root.className = `overlay ${state}`;
    this.root.replaceChildren(el('div', { className: 'overlay-card' }, ...children));
    this.root.hidden = false;
  }
}

function fallbackLinks(entry: ModelEntry): HTMLElement[] {
  const links: HTMLElement[] = [];
  if (entry.standaloneViewerPath) {
    links.push(
      el('a', { className: 'btn', href: assetUrl(entry.standaloneViewerPath), target: '_blank', rel: 'noopener', text: 'Open original viewer' }),
    );
  }
  const model = entry.downloads.find((d) => d.path === entry.modelPath);
  if (model) links.push(el('a', { className: 'btn', href: assetUrl(model.path), download: model.fileName, text: 'Download model' }));
  return links;
}
