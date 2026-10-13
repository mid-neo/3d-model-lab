import type { ModelEntry } from '../catalog/types';
import { el } from './dom';

/** Renders the catalog as a list of links (#/model/<id>), grouped by category. */
export function renderCatalog(list: HTMLElement, entries: readonly ModelEntry[], activeId: string): void {
  list.replaceChildren();
  const categories = [...new Set(entries.map((entry) => entry.category))];
  for (const category of categories) {
    list.append(el('li', { className: 'catalog-group', text: category, role: 'presentation' }));
    for (const entry of entries.filter((e) => e.category === category)) {
      const active = entry.id === activeId;
      const link = el(
        'a',
        {
          className: `catalog-item${active ? ' is-active' : ''}`,
          href: `#/model/${entry.id}`,
          'aria-current': active ? 'page' : undefined,
        },
        el('span', { className: 'catalog-item-name', text: entry.name }),
        el('span', { className: 'catalog-item-meta', text: entry.credits.license }),
      );
      list.append(el('li', {}, link));
    }
  }
}
