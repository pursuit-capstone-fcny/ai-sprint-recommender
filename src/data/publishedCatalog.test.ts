import { afterEach, describe, it, expect, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { catalog } from '../../server/test-helpers';
import { loadCatalog } from './loadCatalog';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('published browser inventory', () => {
  it('uses the same canonical version as the server and never reads a draft Sheet endpoint', async () => {
    vi.stubEnv('VITE_CATALOG_SOURCE', 'static');
    vi.stubEnv('VITE_LIBRARY_ORIGIN', 'https://library.example.test');
    vi.stubGlobal('crypto', webcrypto);
    const fetcher = vi.fn<typeof fetch>(async (input: RequestInfo | URL) =>
      Response.json(
        String(input).endsWith('/current.json')
          ? {
              schemaVersion: 1,
              catalogVersion: catalog.catalogVersion,
              publishedAt: '2026-10-29T00:00:00Z',
            }
          : catalog,
      ),
    );
    vi.stubGlobal('fetch', fetcher);
    expect(await loadCatalog()).toMatchObject({
      status: 'ready',
      catalog,
      source: 'remote',
    });
    expect(
      fetcher.mock.calls.every((call) =>
        String(call[0]).startsWith('https://library.example.test/catalog/'),
      ),
    ).toBe(true);
  });
  it('fails closed on corrupted public snapshots without using the mutable Sheet or fixtures', async () => {
    vi.stubEnv('VITE_CATALOG_SOURCE', 'static');
    vi.stubEnv('VITE_LIBRARY_ORIGIN', 'https://library.example.test');
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) =>
      Response.json(
        String(input).endsWith('/current.json')
          ? {
              schemaVersion: 1,
              catalogVersion: catalog.catalogVersion,
              publishedAt: '2026-10-29T00:00:00Z',
            }
          : { ...catalog, items: [] },
      ),
    );
    expect(await loadCatalog()).toMatchObject({ status: 'error' });
  });
});
