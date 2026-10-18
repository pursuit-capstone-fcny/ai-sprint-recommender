import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadCatalog } from './loadCatalog';

const validRow = {
  youtubeId: 'abcdefghijk',
  title: 'A valid video',
  description: 'A description',
  functionAreas: ['Fundraising'],
  tasks: ['grant reports'],
  tools: ['ChatGPT'],
  addedAt: '2026-01-01',
  status: 'active',
  isStartHere: false,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('loadCatalog', () => {
  it('uses the bundled fixture when no catalog URL is configured', async () => {
    const result = await loadCatalog();
    expect(result.status).toBe('ready');
  });

  it('skips a malformed row instead of throwing, keeping the valid ones', async () => {
    vi.stubEnv('VITE_CATALOG_URL', 'https://example.test/catalog.json');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ title: 'missing required fields' }, validRow],
      }),
    );

    const result = await loadCatalog();

    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.items).toHaveLength(1);
      expect(result.items[0].youtubeId).toBe(validRow.youtubeId);
    }
    expect(warn).toHaveBeenCalled();
  });

  it('reports an error rather than throwing when the request fails', async () => {
    vi.stubEnv('VITE_CATALOG_URL', 'https://example.test/catalog.json');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );

    await expect(loadCatalog()).resolves.toMatchObject({ status: 'error' });
  });

  it('reports an error rather than throwing on a non-OK response', async () => {
    vi.stubEnv('VITE_CATALOG_URL', 'https://example.test/catalog.json');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );

    await expect(loadCatalog()).resolves.toMatchObject({ status: 'error' });
  });
});
