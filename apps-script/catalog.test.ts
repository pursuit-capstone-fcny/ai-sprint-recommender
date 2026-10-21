import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/public-catalog.json';
import {
  parsePublicCatalog,
  PublicCatalogItemSchema,
} from '../src/contracts/publicCatalog';
import { buildPublicCatalog, headers, type Workbook } from './catalog';
import { serveCatalog, type CatalogPorts } from './handler';

const version = (json: string) =>
  `sha256:${createHash('sha256').update(json).digest('hex')}`;

function workbook(): Workbook {
  return {
    Catalog: [
      [...headers.Catalog, 'privateNotes'],
      ...fixture.items.map((item) => [
        item.youtubeId,
        item.title,
        item.description,
        item.functionAreas.join(', '),
        item.tasks.join(', '),
        item.tools.join(', '),
        item.addedAt ?? '',
        item.lengthSeconds ?? '',
        item.status,
        item.startHere,
        'synthetic private marker',
      ]),
    ],
    Dictionary: [
      [...headers.Dictionary],
      ...fixture.functionAreas.map((value) => ['functionArea', value]),
      ...fixture.tools.map((value) => ['tool', value]),
      ...fixture.tasks.map((value) => ['task', value]),
    ],
    Synonyms: [
      [...headers.Synonyms],
      ...fixture.synonyms.map((value) => [
        value.alias,
        value.category,
        value.target,
      ]),
    ],
    'Adjacent tools': [
      [...headers['Adjacent tools']],
      ...fixture.adjacentTools.map((value) => [
        value.source,
        value.related,
        value.task,
      ]),
    ],
  };
}

function change(book: Workbook, row: number, field: string, value: unknown) {
  const index = book.Catalog[0].indexOf(field);
  if (index < 0) throw new Error('Unknown test field');
  book.Catalog[row][index] = value;
}

describe('public catalog contract and Sheet parser', () => {
  it('AC-9.6: the frozen fixture and server output pass the same page parser', () => {
    const built = buildPublicCatalog(workbook(), version);
    expect(built.problems).toEqual([]);
    expect(built.catalog).toEqual(parsePublicCatalog(fixture));
    expect(
      parsePublicCatalog(JSON.parse(JSON.stringify(built.catalog))),
    ).toEqual(built.catalog);
  });

  it('AC-9.1/9.2: strips private columns and response fields', () => {
    expect(
      JSON.stringify(buildPublicCatalog(workbook(), version)),
    ).not.toContain('synthetic private marker');
    expect(
      parsePublicCatalog({ ...fixture, internalNotes: 'hidden' }),
    ).not.toHaveProperty('internalNotes');
    expect(
      PublicCatalogItemSchema.parse({
        ...fixture.items[0],
        internalNotes: 'hidden',
      }),
    ).not.toHaveProperty('internalNotes');
  });

  it('AC-9.1: excludes all duplicate copies, including invalid and retired rows', () => {
    const book = workbook();
    book.Catalog.push([...book.Catalog[1]]);
    change(book, 5, 'status', 'retired');
    change(book, 5, 'title', '');
    const built = buildPublicCatalog(book, version);
    expect(built.catalog?.items).toHaveLength(3);
    expect(
      built.catalog?.items.some(
        (item) => item.youtubeId === fixture.items[0].youtubeId,
      ),
    ).toBe(false);
    expect(
      built.problems.filter((p) => p.field === 'youtubeId').map((p) => p.row),
    ).toEqual([2, 6]);
    expect(built.problems).toContainEqual(
      expect.objectContaining({ row: 6, field: 'title' }),
    );
  });

  it.each([
    ['title', '   '],
    ['description', ''],
    ['addedAt', '2026-02-30'],
    ['addedAt', '2026-99-99'],
    ['lengthSeconds', 1.5],
    ['lengthSeconds', 0],
    ['lengthSeconds', '120'],
    ['startHere', 'true'],
    ['status', 'archived'],
    ['youtubeId', 'invalid'],
    ['tools', 'unknown synthetic tool'],
  ])(
    'AC-9.1: rejects invalid %s with a field and row, without echoing values',
    (field, value) => {
      const book = workbook();
      change(book, 1, field, value);
      const built = buildPublicCatalog(book, version);
      expect(built.catalog?.items).toHaveLength(3);
      expect(built.problems).toContainEqual(
        expect.objectContaining({ tab: 'Catalog', row: 2, field }),
      );
      expect(JSON.stringify(built.problems)).not.toContain('synthetic');
    },
  );

  it('AC-9.1: accepts real leap dates, unknown metadata and empty tags', () => {
    const book = workbook();
    change(book, 1, 'addedAt', '2024-02-29');
    const { catalog, problems } = buildPublicCatalog(book, version);
    expect(problems).toEqual([]);
    expect(catalog?.items[0].addedAt).toBe('2024-02-29');
    expect(catalog?.items[3]).toMatchObject({
      addedAt: null,
      lengthSeconds: null,
      tools: [],
      tasks: [],
      functionAreas: [],
    });
  });

  it('AC-9.3: canonicalizes and deduplicates comma-separated tags', () => {
    const book = workbook();
    change(book, 1, 'tools', ' chatgpt, ChatGPT ');
    const { catalog, problems } = buildPublicCatalog(book, version);
    expect(problems).toEqual([]);
    expect(catalog?.items[0].tools).toEqual(['ChatGPT']);
    expect(catalog?.tools).toContain('Claude');
  });

  it('AC-9.4: diagnoses invalid retired rows while serving valid active rows', () => {
    const book = workbook();
    change(book, 1, 'status', 'retired');
    change(book, 1, 'addedAt', 'not a date');
    change(book, 2, 'status', 'retired');
    const built = buildPublicCatalog(book, version);
    expect(built.catalog?.items).toHaveLength(2);
    expect(built.problems).toEqual([
      {
        tab: 'Catalog',
        row: 2,
        field: 'addedAt',
        reason: 'Invalid field type or value',
      },
    ]);
  });

  it('AC-9.3/9.4: rejects conflicting aliases and unknown targets without expanding cycles', () => {
    const book = workbook();
    book.Synonyms.push(['grant reporting', 'task', 'budget tracking']);
    book.Synonyms.push(
      ['cycle-a', 'task', 'cycle-b'],
      ['cycle-b', 'task', 'cycle-a'],
    );
    const built = buildPublicCatalog(book, version);
    expect(built.catalog?.synonyms).toEqual([]);
    expect(built.problems).toHaveLength(4);
    expect(JSON.stringify(built.problems)).not.toContain('cycle-a');
  });

  it('AC-9.3: keeps tool adjacency directed and scoped to an explicit task', () => {
    const book = workbook();
    book['Adjacent tools'].push(['Excel', 'Sheets', 'unknown task']);
    const built = buildPublicCatalog(book, version);
    expect(built.catalog?.adjacentTools).toEqual(fixture.adjacentTools);
    expect(built.problems).toEqual([
      expect.objectContaining({ tab: 'Adjacent tools', row: 3 }),
    ]);
  });

  it('AC-9.4: excludes ambiguous dictionary spellings and dependent tags', () => {
    const book = workbook();
    book.Dictionary.push(['tool', 'chatgpt']);
    const built = buildPublicCatalog(book, version);
    expect(built.catalog?.tools).not.toContain('ChatGPT');
    expect(built.catalog?.items).toHaveLength(3);
    expect(built.problems.filter((p) => p.tab === 'Dictionary')).toHaveLength(
      2,
    );
  });

  it('AC-9.3/9.8: versions public content and mapping edits, not private changes', () => {
    const book = workbook();
    const before = buildPublicCatalog(book, version).catalog?.catalogVersion;
    change(book, 1, 'privateNotes', 'different private marker');
    expect(buildPublicCatalog(book, version).catalog?.catalogVersion).toBe(
      before,
    );
    book.Synonyms.push(['reports', 'task', 'grant reports']);
    expect(buildPublicCatalog(book, version).catalog?.catalogVersion).not.toBe(
      before,
    );
    const copy = structuredClone(book);
    buildPublicCatalog(book, version);
    expect(book).toEqual(copy);
  });

  it('AC-9.7: preserves a valid empty catalog', () => {
    const book = workbook();
    book.Catalog = [book.Catalog[0]];
    expect(buildPublicCatalog(book, version).catalog?.items).toEqual([]);
  });

  it('AC-9.4: fails closed on missing or duplicate headers', () => {
    const book = workbook();
    book.Catalog[0][0] = 'private header';
    const built = buildPublicCatalog(book, version);
    expect(built.catalog).toBeNull();
    expect(built.problems).toEqual([
      {
        tab: 'Catalog',
        row: 1,
        field: 'youtubeId',
        reason: 'Required header missing or duplicated',
      },
    ]);
    expect(JSON.stringify(built.problems)).not.toContain('private header');
  });

  it('AC-9.1/9.3: the browser parser rejects invalid response references', () => {
    expect(() =>
      parsePublicCatalog({ ...fixture, schemaVersion: 99 }),
    ).toThrow();
    expect(() =>
      parsePublicCatalog({
        ...fixture,
        items: [fixture.items[0], fixture.items[0]],
      }),
    ).toThrow();
    expect(() =>
      parsePublicCatalog({
        ...fixture,
        items: [{ ...fixture.items[0], status: 'retired' }],
      }),
    ).toThrow();
    expect(() => parsePublicCatalog({ ...fixture, tools: [] })).toThrow();
  });
});

function ports() {
  const operations: string[] = [];
  const problems: unknown[] = [];
  const book = workbook();
  const deps: CatalogPorts = {
    enabled: true,
    lock: {
      tryLock: () => {
        operations.push('lock');
        return true;
      },
      releaseLock: () => {
        operations.push('unlock');
      },
    },
    read: () => {
      operations.push('read');
      return book;
    },
    replaceProblems: (next) => {
      operations.push('replace');
      problems.splice(0, problems.length, ...next);
    },
    version,
  };
  return { deps, operations, problems, book };
}

describe('catalog request handler', () => {
  it('AC-9.2: avoids Sheet access when publication is disabled', () => {
    const { deps, operations } = ports();
    deps.enabled = false;
    expect(JSON.parse(serveCatalog(deps))).toEqual({
      error: { code: 'CATALOG_DISABLED' },
    });
    expect(operations).toEqual([]);
  });

  it('AC-9.4: locks before reading and replaces diagnostics before unlocking', () => {
    const { deps, operations, problems, book } = ports();
    change(book, 1, 'title', '');
    serveCatalog(deps);
    expect(operations).toEqual(['lock', 'read', 'replace', 'unlock']);
    expect(problems).toHaveLength(1);
    change(book, 1, 'title', 'Fixed public title');
    serveCatalog(deps);
    expect(problems).toEqual([]);
  });

  it('AC-9.4: a contending request cannot read or erase diagnostics', () => {
    const { deps, operations, problems } = ports();
    problems.push('previous diagnostics');
    deps.lock.tryLock = () => false;
    expect(JSON.parse(serveCatalog(deps))).toEqual({
      error: { code: 'CATALOG_BUSY' },
    });
    expect(operations).toEqual([]);
    expect(problems).toEqual(['previous diagnostics']);
  });

  it('AC-9.2/9.4: releases locks after failures without exposing Sheet errors', () => {
    const { deps, operations } = ports();
    deps.read = () => {
      throw new Error('synthetic private Sheet error');
    };
    expect(JSON.parse(serveCatalog(deps))).toEqual({
      error: { code: 'CATALOG_UNAVAILABLE' },
    });
    expect(operations).toEqual(['lock', 'unlock']);
  });

  it('AC-9.4: writes structural diagnostics but does not serve a broken schema', () => {
    const { deps, book, problems } = ports();
    book.Synonyms = [];
    expect(JSON.parse(serveCatalog(deps))).toEqual({
      error: { code: 'CATALOG_INVALID_CONFIG' },
    });
    expect(problems).toHaveLength(3);
  });

  it('AC-9.8: reads edits on the next request without a stale application cache', () => {
    const { deps, book } = ports();
    const before = parsePublicCatalog(JSON.parse(serveCatalog(deps)));
    change(book, 1, 'status', 'retired');
    const after = parsePublicCatalog(JSON.parse(serveCatalog(deps)));
    expect(after.items).toHaveLength(before.items.length - 1);
    expect(after.catalogVersion).not.toBe(before.catalogVersion);
  });
});
