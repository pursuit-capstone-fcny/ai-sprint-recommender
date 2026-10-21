import { useCallback, useEffect, useState } from 'react';
import { loadCatalog } from './loadCatalog';
import type { CatalogLoadResult } from './loadCatalog';

type CatalogState = { status: 'loading' } | CatalogLoadResult;

export function useCatalog(): CatalogState & { retry: () => void } {
  const [state, setState] = useState<CatalogState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    loadCatalog({ signal: controller.signal }).then((result) => {
      if (active) setState(result);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt]);

  return { ...state, retry };
}
