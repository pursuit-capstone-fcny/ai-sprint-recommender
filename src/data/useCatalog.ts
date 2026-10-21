import { useEffect, useState } from 'react';
import { loadCatalog } from './loadCatalog';
import type { CatalogLoadResult } from './loadCatalog';

type CatalogState = { status: 'loading' } | CatalogLoadResult;

export function useCatalog(): CatalogState {
  const [state, setState] = useState<CatalogState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    loadCatalog().then((result) => {
      if (active) setState(result);
    });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
