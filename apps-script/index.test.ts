import { afterEach, expect, it, vi } from 'vitest';
import { analyticsServices } from '../fixtures/analytics-services';
import { doGet } from './index';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('returns the published catalog without reading or writing draft workbook cells', () => {
  const s = analyticsServices();
  const before = JSON.parse(doGet().getContent());
  s.data['fixture-catalog'].Catalog[1][1] = 'Unpublished title';
  expect(JSON.parse(doGet().getContent())).toEqual(before);
  expect(s.openById).not.toHaveBeenCalled();
  expect(s.ops).toEqual([]);
  s.publish();
  expect(JSON.parse(doGet().getContent()).catalogVersion).not.toBe(
    before.catalogVersion,
  );
});
it('is disabled by default without touching a spreadsheet', () => {
  const s = analyticsServices();
  delete s.properties.CATALOG_PUBLIC_ENABLED;
  expect(JSON.parse(doGet().getContent())).toEqual({
    error: { code: 'CATALOG_DISABLED' },
  });
  expect(s.openById).not.toHaveBeenCalled();
});
