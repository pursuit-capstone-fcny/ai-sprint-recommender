import { createHash } from 'node:crypto';
import { catalogDataJson } from '../src/library/catalog';
import fixture from '../fixtures/public-catalog.json';
import { parsePublicCatalog } from '../src/contracts/publicCatalog';
import { type ObjectStorage } from './budget-object';

export const catalog = parsePublicCatalog(fixture);
catalog.catalogVersion = `sha256:${createHash('sha256').update(catalogDataJson(catalog)).digest('hex')}`;
export const environment = {
  LLM_ENABLED: 'true',
  LLM_APPROVALS_RECORDED: 'true',
  LLM_ENVIRONMENT: 'test',
  LLM_MODEL: 'fixture-model',
  LIBRARY_ORIGIN: 'https://library.example.test',
  ANTHROPIC_API_KEY: 'fixture-only',
  LLM_RATE_KEY: 'x'.repeat(32),
  LLM_MAX_INPUT_TOKENS: '20000',
  LLM_MAX_OUTPUT_TOKENS: '1000',
  LLM_REQUESTS_PER_MINUTE: '20',
  LLM_CLIENT_REQUESTS_PER_MINUTE: '5',
  LLM_MAX_CONCURRENCY: '3',
  LLM_DAILY_MICRODOLLARS: '1000000',
  LLM_MONTHLY_MICRODOLLARS: '10000000',
  LLM_INPUT_MICRODOLLARS_PER_MILLION: '1000000',
  LLM_OUTPUT_MICRODOLLARS_PER_MILLION: '1000000',
};

// Manifest requests are separate from snapshot reads in tests of cache/provider behavior.
export function staticCatalogFetch(fetcher: typeof fetch): typeof fetch {
  return async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url.endsWith('/catalog/current.json'))
      return Response.json({
        schemaVersion: 1,
        catalogVersion: catalog.catalogVersion,
        publishedAt: '2026-10-29T00:00:00Z',
      });
    return fetcher(input, init);
  };
}
// Models the documented storage transaction serialization, with rollback and cloned values.
export class TestStorage implements ObjectStorage {
  private values = new Map<string, unknown>();
  private undo: Map<string, { present: boolean; value: unknown }> | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  alarm = 0;
  async get<T>(key: string): Promise<T | undefined> {
    return structuredClone(this.values.get(key)) as T | undefined;
  }
  async put<T>(key: string, value: T): Promise<void> {
    this.remember(key);
    this.values.set(key, structuredClone(value));
  }
  private remember(key: string) {
    if (this.undo && !this.undo.has(key))
      this.undo.set(key, {
        present: this.values.has(key),
        value: this.values.get(key),
      });
  }
  async transaction<T>(
    callback: (storage: ObjectStorage) => Promise<T>,
  ): Promise<T> {
    const result = this.queue.then(async () => {
      const journal = new Map<string, { present: boolean; value: unknown }>();
      this.undo = journal;
      const alarmBefore = this.alarm;
      try {
        return await callback(this);
      } catch (error) {
        for (const [key, before] of journal) {
          if (before.present) this.values.set(key, before.value);
          else this.values.delete(key);
        }
        this.alarm = alarmBefore;
        throw error;
      } finally {
        this.undo = undefined;
      }
    });
    this.queue = result.catch(() => undefined);
    return result;
  }
  async setAlarm(time: number): Promise<void> {
    this.alarm = time;
  }
  async delete(key: string | string[]): Promise<void> {
    for (const entry of typeof key === 'string' ? [key] : key) {
      this.remember(entry);
      this.values.delete(entry);
    }
  }
  async list<T>({
    prefix,
    limit,
    startAfter,
  }: {
    prefix: string;
    limit: number;
    startAfter?: string;
  }): Promise<Map<string, T>> {
    return new Map(
      [...this.values]
        .filter(
          ([key]) =>
            key.startsWith(prefix) && (!startAfter || key > startAfter),
        )
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(0, limit)
        .map(([key, value]) => [key, structuredClone(value) as T]),
    );
  }
}
