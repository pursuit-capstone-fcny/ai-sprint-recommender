import { afterEach, describe, it, expect, vi } from 'vitest';
import { analyticsServices } from '../fixtures/analytics-services';
import { publishLibrary, libraryPublishStatus } from './library-publisher';
import { LibraryManifestSchema } from '../src/library/catalog';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function setup() {
  const s = analyticsServices();
  Object.assign(s.properties, {
    LIBRARY_SOURCE_SHEET_URL:
      'https://docs.google.com/spreadsheets/d/fixture-catalog/edit',
    LIBRARY_GITHUB_REPOSITORY: 'fixture/library',
    LIBRARY_GITHUB_TOKEN: 'publisher-credential',
    LIBRARY_DATA_BRANCH: 'library-data-test',
    LIBRARY_WORKFLOW_REF: 'feat/library-publisher',
    LIBRARY_ENVIRONMENT: 'test',
    LIBRARY_PUBLIC_ORIGIN: 'https://library.example.test',
  });
  const originalSheets = SpreadsheetApp;
  vi.stubGlobal('SpreadsheetApp', {
    ...originalSheets,
    getActiveSpreadsheet: () => s.openById('fixture-catalog'),
  });
  const originalUtilities = Utilities;
  vi.stubGlobal('Utilities', {
    ...originalUtilities,
    newBlob: (text: string) => ({
      getBytes: () => new TextEncoder().encode(text),
    }),
  });
  let run: Record<string, unknown> | null = null;
  let fail = '';
  let deployed: unknown = null;
  const requests: {
    path: string;
    body: Record<string, unknown>;
    method: string;
  }[] = [];
  const fetch = vi.fn(
    (path: string, options: { payload?: string; method?: string }) => {
      if (fail && path.includes(fail))
        throw new Error('Private upstream failure detail');
      const body = JSON.parse(options?.payload ?? '{}');
      requests.push({ path, body, method: options?.method ?? 'get' });
      const response = (value: unknown, status = 200) => ({
        getResponseCode: () => status,
        getContentText: () => JSON.stringify(value),
      });
      if (path.startsWith('https://library.example.test'))
        return response(deployed);
      if (path.includes('/git/ref/')) return response({}, 404);
      if (path.includes('/git/trees')) return response({ sha: 'a'.repeat(40) });
      if (path.includes('/git/commits'))
        return response({ sha: 'b'.repeat(40) });
      if (path.includes('/runs?'))
        return response({ workflow_runs: run ? [run] : [] });
      return response({});
    },
  );
  vi.stubGlobal('UrlFetchApp', { fetch });
  return {
    ...s,
    requests,
    fetch,
    fail: (value: string) => {
      fail = value;
    },
    run: (value: Record<string, unknown>) => {
      run = value;
    },
    deployed: (value: unknown) => {
      deployed = value;
    },
  };
}
describe('Sheet publication', () => {
  it('freezes approved public data, writes an atomic data commit and dispatches bounded identifiers', () => {
    const s = setup();
    const result = publishLibrary();
    expect(result.ok).toBe(true);
    const tree = s.requests.find((r) => r.path.endsWith('/git/trees'))!.body
      .tree as { path: string; content: string }[];
    expect(tree).toHaveLength(2);
    expect(tree[0].path).toMatch(/^catalog\/versions\/[a-f0-9]{64}\.json$/);
    expect(JSON.stringify(tree)).not.toContain('Usage');
    const dispatch = s.requests.find((r) =>
      r.path.endsWith('/dispatches'),
    )!.body;
    expect(Object.keys(dispatch.inputs as object).sort()).toEqual([
      'catalog_commit',
      'environment',
      'request_id',
    ]);
    expect(
      s.requests.filter((r) => r.path.endsWith('/git/refs'))[0].body.ref,
    ).toBe('refs/heads/library-data-test');
    expect(s.ops.filter((op) => op.startsWith('write:'))).toEqual([]);
  });
  it('reuses a pending request and never treats upload or job completion alone as published', () => {
    const s = setup();
    publishLibrary();
    publishLibrary();
    expect(
      s.requests.filter((r) => r.path.endsWith('/dispatches')),
    ).toHaveLength(1);
    const state = JSON.parse(s.properties.LIBRARY_PUBLISH_STATE);
    s.run({
      id: 10,
      display_title: `Publish library ${state.requestId}`,
      head_branch: 'feat/library-publisher',
      status: 'completed',
      conclusion: 'success',
    });
    s.deployed({
      schemaVersion: 1,
      catalogVersion: `sha256:${'f'.repeat(64)}`,
      publishedAt: state.requestedAt,
    });
    expect(libraryPublishStatus()).toMatchObject({
      ok: true,
      status: 'failed',
    });
  });
  it('confirms success only after the matching live manifest', () => {
    const s = setup();
    publishLibrary();
    const state = JSON.parse(s.properties.LIBRARY_PUBLISH_STATE);
    s.run({
      id: 10,
      display_title: `Publish library ${state.requestId}`,
      head_branch: 'feat/library-publisher',
      status: 'completed',
      conclusion: 'success',
    });
    s.deployed(
      LibraryManifestSchema.parse({
        schemaVersion: 1,
        catalogVersion: state.version,
        publishedAt: state.requestedAt,
      }),
    );
    expect(libraryPublishStatus()).toMatchObject({
      ok: true,
      status: 'succeeded',
      runUrl: 'https://github.com/fixture/library/actions/runs/10',
    });
  });
  it('fails invalid catalog validation before any network or publication', () => {
    const s = setup();
    s.data['fixture-catalog'].Catalog[1][0] = 'invalid';
    expect(publishLibrary().ok).toBe(false);
    expect(s.fetch).not.toHaveBeenCalled();
    expect(s.properties.LIBRARY_PUBLISH_STATE).toBeUndefined();
  });
  it('rejects main data writes, mismatched environments and unconfigured sources', () => {
    const s = setup();
    s.properties.LIBRARY_DATA_BRANCH = 'main';
    expect(publishLibrary().ok).toBe(false);
    s.properties.LIBRARY_DATA_BRANCH = 'library-data-test';
    s.properties.LIBRARY_ENVIRONMENT = 'production';
    expect(publishLibrary().ok).toBe(false);
    expect(s.fetch).not.toHaveBeenCalled();
  });
  it('keeps an uncertain dispatch pending instead of creating another publication', () => {
    const s = setup();
    s.fail('/dispatches');
    expect(publishLibrary()).toMatchObject({ ok: true, status: 'unknown' });
    expect(JSON.parse(s.properties.LIBRARY_PUBLISH_STATE).status).toBe(
      'unknown',
    );
    s.fail('');
    expect(publishLibrary()).toMatchObject({ ok: true, status: 'unknown' });
    expect(
      s.requests.filter((r) => r.path.endsWith('/git/commits')),
    ).toHaveLength(1);
  });
  it('does not echo credentials or upstream failures', () => {
    const s = setup();
    s.fail('/git/trees');
    const result = publishLibrary();
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(
      /publisher-credential|Private upstream/,
    );
    expect(s.properties.LIBRARY_PUBLISH_STATE).toBeUndefined();
  });
});
