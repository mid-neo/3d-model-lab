import { assetUrl } from '../assets';
import type { ModelEntry } from '../catalog/types';
import type { LoadedModelInfo } from '../viewer/Viewer';
import { byId, el } from './dom';

export function renderModelHeader(entry: ModelEntry): void {
  byId('model-category').textContent = entry.category;
  byId('model-name').textContent = entry.name;
  byId('model-summary').textContent = entry.summary;
  document.title = `${entry.name} · 3D Model Lab`;
}

/**
 * Shows dimensions measured from the loaded geometry. These describe the 3D
 * model's bounding box, not official specifications of the real object.
 */
export function renderMeasurements(entry: ModelEntry, info: LoadedModelInfo | null): void {
  const list = byId('model-measurements');
  const note = byId('measurements-note');
  list.replaceChildren();
  note.hidden = !info;
  if (!info) return;
  const unit = entry.units ? ` ${entry.units}` : '';
  const format = (value: number) => `${value.toFixed(2)}${unit}`;
  const rows: [string, string][] = [
    ['Length', format(info.size.length)],
    ['Width', format(info.size.width)],
    ['Height', format(info.size.height)],
    ['Triangles', Math.round(info.triangles).toLocaleString('en-US')],
  ];
  for (const [term, value] of rows) list.append(el('div', {}, el('dt', { text: term }), el('dd', { text: value })));
}

export function renderDownloads(entry: ModelEntry): void {
  const list = byId('downloads');
  list.replaceChildren();
  for (const download of entry.downloads) {
    list.append(
      el(
        'li',
        {},
        el(
          'a',
          { className: 'download', href: assetUrl(download.path), download: download.fileName },
          el('span', { className: 'download-label', text: download.label }),
          el('span', { className: 'download-format', text: download.format }),
        ),
      ),
    );
  }
  if (entry.standaloneViewerPath) {
    list.append(
      el(
        'li',
        {},
        el(
          'a',
          {
            className: 'download download-secondary',
            href: assetUrl(entry.standaloneViewerPath),
            target: '_blank',
            rel: 'noopener',
          },
          el('span', { className: 'download-label', text: 'Open original viewer' }),
          el('span', { className: 'download-format', text: 'New tab · no WebGL needed' }),
        ),
      ),
    );
  }
}

export function renderCredits(entry: ModelEntry): void {
  const { credits } = entry;
  const link = (href: string, text: string) => el('a', { href, target: '_blank', rel: 'noopener', text });
  const container = byId('credits');
  container.replaceChildren(
    el('p', {}, 'Model by ', el('strong', { text: credits.author }), ' · ', link(credits.sourceUrl, credits.sourceName)),
    el('p', {}, 'Model license: ', link(credits.licenseUrl, credits.license)),
  );
  if (credits.notes) container.append(el('p', { className: 'muted', text: credits.notes }));
  container.append(
    el('p', { className: 'muted', text: 'The application code is MIT-licensed; this does not change the model’s license.' }),
  );
}
