import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCatalog } from './useCatalog';

afterEach(() => {
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
