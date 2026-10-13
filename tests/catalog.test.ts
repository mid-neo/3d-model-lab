import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { catalog } from '../src/catalog/models';

const publicFile = (path: string) => resolve(__dirname, '../public', path);

describe('catalog', () => {
  it('has unique, URL-safe ids', () => {
    const ids = catalog.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[\w-]+$/);
  });

  for (const entry of catalog) {
    describe(entry.name, () => {
      it('references files that exist under public/', () => {
        const paths = [entry.modelPath, ...entry.downloads.map((d) => d.path)];
        if (entry.standaloneViewerPath) paths.push(entry.standaloneViewerPath);
        for (const path of paths) {
          expect(path.startsWith('/'), `${path} must be relative to the site root`).toBe(false);
          expect(existsSync(publicFile(path)), `${path} is missing`).toBe(true);
        }
      });

      it('declares a license and source', () => {
        expect(entry.credits.license).not.toBe('');
        expect(entry.credits.sourceUrl).toMatch(/^https:\/\//);
      });

      it('has non-parallel orientation axes', () => {
        const [fx, fy, fz] = entry.orientation.forward;
        const [ux, uy, uz] = entry.orientation.up;
        const dot = fx * ux + fy * uy + fz * uz;
        expect(Math.abs(dot)).toBeLessThan(0.99);
      });
    });
  }
});
