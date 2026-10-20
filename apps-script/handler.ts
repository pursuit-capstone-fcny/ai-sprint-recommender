import { buildPublicCatalog, type Problem, type Workbook } from './catalog';

export type CatalogPorts = {
  enabled: boolean;
  lock: { tryLock: (milliseconds: number) => boolean; releaseLock: () => void };
  read: () => Workbook;
  replaceProblems: (problems: Problem[]) => void;
  version: (json: string) => string;
};

const error = (code: string) => JSON.stringify({ error: { code } });

export function serveCatalog(ports: CatalogPorts): string {
  if (!ports.enabled) return error('CATALOG_DISABLED');
  let locked = false;
  try {
    locked = ports.lock.tryLock(1500);
    if (!locked) return error('CATALOG_BUSY');
    // Read and replace diagnostics under the same lock. An older request
    // cannot overwrite the Problems produced by a newer snapshot.
    const { catalog, problems } = buildPublicCatalog(
      ports.read(),
      ports.version,
    );
    ports.replaceProblems(problems);
    return catalog ? JSON.stringify(catalog) : error('CATALOG_INVALID_CONFIG');
  } catch {
    // Sheet errors may contain private values or IDs. Never expose them.
    return error('CATALOG_UNAVAILABLE');
  } finally {
    if (locked) ports.lock.releaseLock();
  }
}
