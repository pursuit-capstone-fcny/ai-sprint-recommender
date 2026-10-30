// @vitest-environment node
import { afterEach, describe, it, expect, vi } from 'vitest';
import { catalog } from '../../server/test-helpers';
import { readPublishedCatalog } from './read';
afterEach(() => vi.restoreAllMocks());
const source = 'https://library.example.test/catalog/current.json';
const manifest = {
  schemaVersion: 1,
  catalogVersion: catalog.catalogVersion,
  publishedAt: '2026-10-29T00:00:00Z',
};
describe('shared static snapshot reader', () => {
  it('revalidates the pointer and then binds to its immutable hash without credentials', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) =>
      Response.json(
        String(input).endsWith('/current.json') ? manifest : catalog,
      ),
    );
    expect(
      await readPublishedCatalog({
        manifestUrl: source,
        fetcher,
        signal: new AbortController().signal,
      }),
    ).toEqual(catalog);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
    });
    expect(fetcher.mock.calls[1][0]).toBe(
      `https://library.example.test/catalog/versions/${catalog.catalogVersion.slice(7)}.json`,
    );
  });
  it('loads a retained historical version without substituting the latest inventory', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(catalog));
    expect(
      await readPublishedCatalog({
        manifestUrl: source,
        requestedVersion: catalog.catalogVersion,
        fetcher,
        signal: new AbortController().signal,
      }),
    ).toEqual(catalog);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    { ...catalog, items: [] },
    { ...catalog, privateNotes: 'excluded' },
    { ...catalog, catalogVersion: `sha256:${'f'.repeat(64)}` },
  ])('rejects tampering and private fields', async (value) => {
    await expect(
      readPublishedCatalog({
        manifestUrl: source,
        requestedVersion: catalog.catalogVersion,
        fetcher: async () => Response.json(value),
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow();
  });
  it('rejects request traversal, credentials and oversized manifests', async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response('x'.repeat(5000), {
          headers: { 'content-type': 'application/json' },
        }),
    );
    await expect(
      readPublishedCatalog({
        manifestUrl: source,
        fetcher,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow();
    await expect(
      readPublishedCatalog({
        manifestUrl:
          'https://private@library.example.test/catalog/current.json',
        fetcher,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow();
    await expect(
      readPublishedCatalog({
        manifestUrl: source,
        requestedVersion: '../secret',
        fetcher,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow();
  });
});
