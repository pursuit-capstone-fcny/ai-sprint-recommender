import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import fixture from '../../fixtures/public-catalog.json';
import {
  canonicalJson,
  catalogDataJson,
  strictCatalog,
  snapshotPath,
  libraryOrigin,
} from './catalog';
const catalog = strictCatalog(fixture);
describe('published catalog contract', () => {
  it('canonicalizes keys consistently without changing array order', () => {
    expect(canonicalJson({ b: [2, 1], a: 'é' })).toBe('{"a":"é","b":[2,1]}');
    const data = catalogDataJson(catalog);
    expect(data).not.toContain('catalogVersion');
    expect(createHash('sha256').update(data).digest('hex')).toHaveLength(64);
  });
  it('rejects private fields at every nesting level and duplicate identities', () => {
    expect(() =>
      strictCatalog({ ...fixture, privateNotes: 'excluded' }),
    ).toThrow();
    expect(() =>
      strictCatalog({
        ...fixture,
        items: [{ ...fixture.items[0], privateNotes: 'excluded' }],
      }),
    ).toThrow();
    expect(() =>
      strictCatalog({
        ...fixture,
        items: [fixture.items[0], fixture.items[0]],
      }),
    ).toThrow();
  });
  it('derives fixed immutable paths and rejects traversal and credentials', () => {
    expect(snapshotPath(`sha256:${'a'.repeat(64)}`)).toBe(
      `versions/${'a'.repeat(64)}.json`,
    );
    expect(() => snapshotPath('../private')).toThrow();
    expect(libraryOrigin('https://library.example.test/')).toBe(
      'https://library.example.test',
    );
    expect(() =>
      libraryOrigin('https://name:pass@library.example.test/'),
    ).toThrow();
    expect(() =>
      libraryOrigin('https://library.example.test/untrusted'),
    ).toThrow();
  });
});
