import { readPublishedCatalog } from '../library/read';
import { libraryOrigin } from '../library/catalog';
import catalogFixture from '../../fixtures/public-catalog.json';
import { toCatalogItem, type CatalogItem } from '../contracts/catalogItem';
import {
  PublicCatalogItemSchema,
  PublicCatalogSchema,
  parsePublicCatalog,
  type PublicCatalog,
} from '../contracts/publicCatalog';

export const CATALOG_TIMEOUT_MS = 10_000;

export type CatalogLoadResult =
  | {
      status: 'ready';
      items: CatalogItem[];
      catalog: PublicCatalog;
      source: 'fixture' | 'remote';
    }
  | { status: 'error'; message: string };

// Only row positions and public field names may reach diagnostics.
export function parseCatalogResponse(value: unknown): PublicCatalog {
  if (typeof value !== 'object' || value === null || !('items' in value)) {
    throw new Error('Invalid catalog');
  }
  const rows = value.items;
  if (!Array.isArray(rows)) throw new Error('Invalid catalog');
  const catalog = parsePublicCatalog({ ...value, items: [] });
  const idCounts = new Map<string, number>();
  for (const row of rows) {
    if (typeof row?.youtubeId === 'string') {
      idCounts.set(row.youtubeId, (idCounts.get(row.youtubeId) ?? 0) + 1);
    }
  }
  rows.forEach((row: unknown, index: number) => {
    const parsed = PublicCatalogSchema.safeParse({ ...catalog, items: [row] });
    if (!parsed.success) {
      const fields = [
        ...new Set(
          parsed.error.issues.map((issue) => {
            const field = issue.path[2];
            return typeof field === 'string' &&
              field in PublicCatalogItemSchema.shape
              ? field
              : 'item';
          }),
        ),
      ];
      console.warn('Skipping invalid catalog row', { row: index + 1, fields });
      return;
    }
    const item = parsed.data.items[0];
    if (idCounts.get(item.youtubeId) !== 1) {
      console.warn('Skipping duplicate catalog row', {
        row: index + 1,
        fields: ['youtubeId'],
      });
      return;
    }
    catalog.items.push(item);
  });
  return catalog;
}

export async function loadCatalog({
  signal,
}: { signal?: AbortSignal } = {}): Promise<CatalogLoadResult> {
  if (import.meta.env.VITE_CATALOG_SOURCE === 'static') {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    try {
      const origin = import.meta.env.VITE_LIBRARY_ORIGIN?.trim();
      const manifestUrl = origin
        ? `${libraryOrigin(origin)}/catalog/current.json`
        : '/catalog/current.json';
      const cancelled = new Promise<never>((_, reject) => {
        const cancel = () => reject(new Error('Cancelled'));
        if (controller.signal.aborted) cancel();
        else
          controller.signal.addEventListener('abort', cancel, { once: true });
        timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, CATALOG_TIMEOUT_MS);
      });
      const catalog = await Promise.race([
        readPublishedCatalog({ manifestUrl, signal: controller.signal }),
        cancelled,
      ]);
      return {
        status: 'ready',
        catalog,
        items: catalog.items.map(toCatalogItem),
        source:
          import.meta.env.VITE_LIBRARY_DEMO === 'true' ? 'fixture' : 'remote',
      };
    } catch {
      return {
        status: 'error',
        message: timedOut
          ? 'The catalog took too long to load. Please try again.'
          : 'Could not load the published video catalog. Please try again.',
      };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  if (
    !import.meta.env.DEV &&
    import.meta.env.MODE !== 'test' &&
    import.meta.env.VITE_CATALOG_SOURCE !== 'fixture'
  )
    return {
      status: 'error',
      message: 'The published video catalog is not configured.',
    };
  const url = import.meta.env.VITE_CATALOG_URL?.trim();
  const fixtureMode =
    import.meta.env.VITE_CATALOG_SOURCE === 'fixture' ||
    (!import.meta.env.VITE_CATALOG_SOURCE && !url && import.meta.env.DEV);
  if (fixtureMode) {
    const catalog = parsePublicCatalog(catalogFixture);
    return {
      status: 'ready',
      items: catalog.items.map(toCatalogItem),
      catalog,
      source: 'fixture',
    };
  }
  if (!url) {
    return {
      status: 'error',
      message: 'The video catalog is not available yet.',
    };
  }

  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) controller.abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  try {
    const cancelled = new Promise<never>((_, reject) => {
      const rejectAbort = () => reject(new Error('Catalog request cancelled'));
      if (controller.signal.aborted) rejectAbort();
      else
        controller.signal.addEventListener('abort', rejectAbort, {
          once: true,
        });
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, CATALOG_TIMEOUT_MS);
    });
    const request = async () => {
      const response = await fetch(url, {
        signal: controller.signal,
        credentials: 'omit',
        redirect: 'follow',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Catalog request failed');
      const body: unknown = await response.json();
      if (controller.signal.aborted)
        throw new Error('Catalog request cancelled');
      return parseCatalogResponse(body);
    };
    const catalog = await Promise.race([request(), cancelled]);
    return {
      status: 'ready',
      items: catalog.items.map(toCatalogItem),
      catalog,
      source: 'remote',
    };
  } catch {
    return {
      status: 'error',
      message: timedOut
        ? 'The catalog took too long to load. Please try again.'
        : 'Could not load the video catalog. Please try again.',
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
