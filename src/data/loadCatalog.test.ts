import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../fixtures/public-catalog.json';
import { CATALOG_TIMEOUT_MS, loadCatalog } from './loadCatalog';

beforeEach(() => {
  vi.stubEnv('VITE_CATALOG_URL', 'https://example.test/catalog');
  vi.stubEnv('VITE_CATALOG_SOURCE', 'remote');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function respond(body: unknown) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => body });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('loadCatalog', () => {
  it('loads the shared envelope and adapts fields for the existing engine/cards', async () => {
    const fetchMock = respond(fixture);
    const result = await loadCatalog();
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.catalog).toEqual(fixture);
    expect(result.items[0].isStartHere).toBe(fixture.items[0].startHere);
    expect(result.items[0].durationSeconds).toBe(
      fixture.items[0].lengthSeconds,
    );
    expect(
      result.items.find((item) => item.addedAt === null),
    ).not.toHaveProperty('durationSeconds');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/catalog',
      expect.objectContaining({
        redirect: 'follow',
        credentials: 'omit',
        cache: 'no-store',
      }),
    );
  });

  it('skips invalid and all duplicate rows, without logging values or private columns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    respond({
      ...fixture,
      items: [
        fixture.items[0],
        { ...fixture.items[0], title: '', privateNotes: 'private-value' },
        { ...fixture.items[1], tools: ['private-value'] },
        { ...fixture.items[2], privateNotes: 'private-value' },
      ],
    });
    const result = await loadCatalog();
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.catalog.items).toEqual([fixture.items[2]]);
    expect(warn.mock.calls).toEqual([
      ['Skipping duplicate catalog row', { row: 1, fields: ['youtubeId'] }],
      ['Skipping invalid catalog row', { row: 2, fields: ['title'] }],
      ['Skipping invalid catalog row', { row: 3, fields: ['tools'] }],
    ]);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private-value');
  });

  it.each([
    null,
    [],
    { error: 'CATALOG_DISABLED' },
    { ...fixture, schemaVersion: 99 },
    { ...fixture, tools: null },
  ])('reports malformed envelopes as errors', async (body) => {
    respond(body);
    await expect(loadCatalog()).resolves.toMatchObject({ status: 'error' });
  });

  it('preserves a valid empty catalog as a ready result', async () => {
    respond({ ...fixture, items: [] });
    await expect(loadCatalog()).resolves.toMatchObject({
      status: 'ready',
      items: [],
    });
  });

  it.each(['network', 'http', 'json'])(
    'reports %s failures without falling back to fixtures',
    async (failure) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => {
          if (failure === 'network') throw new Error('private failure details');
          return {
            ok: failure !== 'http',
            json: async () => {
              throw new Error('private response');
            },
          };
        }),
      );
      const result = await loadCatalog();
      expect(result).toEqual({
        status: 'error',
        message: 'Could not load the video catalog. Please try again.',
      });
    },
  );

  it.each(['fetch', 'body'])(
    'ends a hung %s at ten seconds and aborts the request',
    async (stage) => {
      vi.useFakeTimers();
      let requestSignal: AbortSignal | undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((_url, options: RequestInit) => {
          requestSignal = options.signal ?? undefined;
          const pending = new Promise(() => {});
          return stage === 'fetch'
            ? pending
            : Promise.resolve({ ok: true, json: () => pending });
        }),
      );
      const request = loadCatalog();
      await vi.advanceTimersByTimeAsync(CATALOG_TIMEOUT_MS);
      await expect(request).resolves.toMatchObject({
        status: 'error',
        message: expect.stringContaining('too long'),
      });
      expect(requestSignal?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('cancels a request even when fetch ignores its abort signal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    const controller = new AbortController();
    const request = loadCatalog({ signal: controller.signal });
    controller.abort();
    await expect(request).resolves.toMatchObject({ status: 'error' });
  });

  it('requires a configured endpoint in production', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_CATALOG_URL', '');
    await expect(loadCatalog()).resolves.toMatchObject({ status: 'error' });
  });

  it('allows an explicitly selected fixture for preview builds', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_CATALOG_SOURCE', 'fixture');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(loadCatalog()).resolves.toMatchObject({
      status: 'ready',
      source: 'fixture',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
