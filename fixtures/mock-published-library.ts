// Legacy adapter tests isolate transport. Real hash/publication isolation is tested
// in published-library.test.ts; changing draft rows requires an explicit publish.
import { vi } from 'vitest';
import { buildPublicCatalog, type Workbook } from '../apps-script/catalog';
import { catalogVersion } from '../apps-script/catalog-sheet';
import type { PublicCatalog } from '../src/contracts/publicCatalog';
let current: PublicCatalog;
let history: PublicCatalog[] = [];
export function publishFixture(workbook: Workbook, reset = false) {
  const result = buildPublicCatalog(workbook, catalogVersion);
  if (!result.catalog) throw new Error('Invalid fixture catalog');
  current = result.catalog;
  if (reset) history = [];
  history.push(current);
  return current;
}
vi.mock('../apps-script/published-library', () => ({
  publishedCatalog: (version?: string) => {
    if (!version) return current;
    const found = history.find((catalog) => catalog.catalogVersion === version);
    if (!found) throw new Error('Missing fixture snapshot');
    return found;
  },
  publishedHistory: () => history,
  configuredLibrarySheet: () => 'fixture-catalog',
}));
