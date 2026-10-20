import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCatalog } from './useCatalog';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('useCatalog', () => {
  it('starts loading and settles on ready with the bundled fixture', async () => {
    const { result } = renderHook(() => useCatalog());

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('settles on error when the configured catalog source fails', async () => {
    vi.stubEnv('VITE_CATALOG_URL', 'https://example.test/catalog.json');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );

    const { result } = renderHook(() => useCatalog());

    await waitFor(() => expect(result.current.status).toBe('error'));
  });
});

describe('request lifecycle', () => {
  it('aborts on unmount', async () => {
    vi.stubEnv('VITE_CATALOG_URL', 'https://example.test/catalog.json');
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url, options: RequestInit) => {
        signal = options.signal ?? undefined;
        return new Promise(() => {});
      }),
    );
    const { unmount } = renderHook(() => useCatalog());
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('ignores a stale response after retry', async () => {
    vi.stubEnv('VITE_CATALOG_URL', 'https://example.test/catalog.json');
    const { default: fixture } =
      await import('../../fixtures/public-catalog.json');
    let completeOldBody: ((value: unknown) => void) | undefined;
    const oldBody = new Promise((resolve) => {
      completeOldBody = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => oldBody })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...fixture, items: [] }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useCatalog());
    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => completeOldBody?.(fixture));
    expect(result.current).toMatchObject({ status: 'ready', items: [] });
  });
});
