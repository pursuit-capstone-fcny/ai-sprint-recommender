import catalogFixtureRaw from '../../fixtures/catalog.json';
import { CatalogItemSchema } from '../contracts/catalogItem';
import type { CatalogItem } from '../contracts/catalogItem';

export type CatalogLoadResult =
  | { status: 'ready'; items: CatalogItem[] }
  | { status: 'error'; message: string };

async function readRows(url: string): Promise<CatalogLoadResult | unknown[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        status: 'error',
        message: `Catalog request failed (${response.status}).`,
      };
    }
    return (await response.json()) as unknown[];
  } catch {
    return { status: 'error', message: 'Could not reach the catalog source.' };
  }
}

export async function loadCatalog(): Promise<CatalogLoadResult> {
  const url = import.meta.env.VITE_CATALOG_URL as string | undefined;
  const rowsOrError = url ? await readRows(url) : catalogFixtureRaw;

  if (!Array.isArray(rowsOrError)) {
    return rowsOrError;
  }

  const items: CatalogItem[] = [];
  for (const row of rowsOrError) {
    const parsed = CatalogItemSchema.safeParse(row);
    if (parsed.success) {
      items.push(parsed.data);
    } else {
      console.warn('Skipping invalid catalog row', row, parsed.error);
    }
  }
  return { status: 'ready', items };
}
