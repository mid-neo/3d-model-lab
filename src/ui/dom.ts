/** Returns the element with the given id or throws, so missing markup fails loudly. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id} in index.html`);
  return element as T;
}

/** Small element factory; text is always set via textContent (never innerHTML). */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string>> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    if (key === 'text') element.textContent = value;
    else if (key === 'className') element.className = value;
    else element.setAttribute(key, value);
  }
  element.append(...children);
  return element;
}
