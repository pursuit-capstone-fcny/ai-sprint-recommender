import { afterEach, describe, expect, it, vi } from 'vitest';
import { testUsageEndpoint, usageSource } from './usageSession';

const endpoint = 'https://script.google.com/macros/s/test/exec';
function enable() {
  vi.stubEnv('VITE_USAGE_ENVIRONMENT', 'test');
  vi.stubEnv('VITE_USAGE_ENABLED', 'true');
  vi.stubEnv('VITE_USAGE_TEST_URL', endpoint);
  vi.stubEnv('VITE_CATALOG_URL', endpoint);
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('test-only usage configuration', () => {
  it('defaults off and rejects production, fixtures, mismatched URLs and non-Apps-Script endpoints', () => {
    expect(testUsageEndpoint('remote')).toBeNull();
    enable();
    expect(testUsageEndpoint('remote')).toBe(endpoint);
    expect(testUsageEndpoint('fixture')).toBeNull();
    vi.stubEnv('VITE_USAGE_ENVIRONMENT', 'production');
    expect(testUsageEndpoint('remote')).toBeNull();
    vi.stubEnv('VITE_USAGE_ENVIRONMENT', 'test');
    vi.stubEnv('VITE_USAGE_ENABLED', 'false');
    expect(testUsageEndpoint('remote')).toBeNull();
    vi.stubEnv('VITE_USAGE_ENABLED', 'true');
    vi.stubEnv('VITE_USAGE_TEST_URL', `${endpoint}?other=1`);
    expect(testUsageEndpoint('remote')).toBeNull();
    for (const url of [
      'http://script.google.com/macros/s/test/exec',
      'https://example.test/exec',
    ]) {
      vi.stubEnv('VITE_CATALOG_URL', url);
      vi.stubEnv('VITE_USAGE_TEST_URL', url);
      expect(testUsageEndpoint('remote')).toBeNull();
    }
  });

  it.each(['website', 'email', 'session', 'pilot', 'team'])(
    'keeps the allowed source %s',
    (value) => {
      expect(usageSource(`?src=${value}`)).toBe(value);
    },
  );
  it('normalizes missing and unknown sources without retaining the rest of the URL', () => {
    expect(usageSource('?other=private')).toBe('website');
    expect(usageSource('?src=unapproved&other=private')).toBe('other');
    expect(usageSource('?src=')).toBe('other');
  });

  it('retains a visit across remounts but a fresh page module gets a new ID, without storage', async () => {
    enable();
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    vi.resetModules();
    const first = await import('./usageSession');
    const visit = first.getUsageSession('remote');
    expect(first.getUsageSession('remote')).toBe(visit);
    expect(first.getUsageSession('fixture')).toBeNull();
    vi.resetModules();
    const next = await import('./usageSession');
    expect(next.getUsageSession('remote')?.sessionId).not.toBe(
      visit?.sessionId,
    );
    expect(storage).not.toHaveBeenCalled();
  });
});
