/// <reference types="google-apps-script" />
import { parseSheetLink } from '../src/admin/sheetLink';
import { buildPublicCatalog } from './catalog';
import { catalogVersion } from './catalog-sheet';
import { libraryCatalog } from './library-source';
import {
  canonicalJson,
  catalogDataJson,
  snapshotPath,
  LIBRARY_MAX_BYTES,
  LibraryManifestSchema,
} from '../src/library/catalog';

const STATE = 'LIBRARY_PUBLISH_STATE';
type State = {
  requestId: string;
  version: string;
  commit: string;
  requestedAt: string;
  status: string;
  runUrl?: string;
};
function config() {
  const p = PropertiesService.getScriptProperties();
  const get = (name: string) => p.getProperty(name) ?? '';
  const repo = get('LIBRARY_GITHUB_REPOSITORY');
  const token = get('LIBRARY_GITHUB_TOKEN');
  const branch = get('LIBRARY_DATA_BRANCH');
  const ref = get('LIBRARY_WORKFLOW_REF');
  const environment = get('LIBRARY_ENVIRONMENT');
  const origin = get('LIBRARY_PUBLIC_ORIGIN');
  const sheetId = parseSheetLink(get('LIBRARY_SOURCE_SHEET_URL'));
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) ||
    !token ||
    !['library-data', 'library-data-test'].includes(branch) ||
    !/^[A-Za-z0-9_./-]{1,120}$/.test(ref) ||
    !['test', 'production'].includes(environment) ||
    !/^https:\/\/[a-z0-9][a-z0-9.-]+\.[a-z]{2,}\/?$/.test(origin) ||
    !sheetId ||
    (environment === 'production' &&
      (ref !== 'main' || branch !== 'library-data')) ||
    (environment === 'test' && branch !== 'library-data-test')
  )
    throw new Error('Publisher setup required');
  if (SpreadsheetApp.getActiveSpreadsheet()?.getId() !== sheetId)
    throw new Error('Wrong source Sheet');
  return {
    p,
    repo,
    token,
    branch,
    ref,
    environment,
    origin: origin.replace(/\/$/, ''),
    sheetId,
  };
}
function api(
  c: ReturnType<typeof config>,
  path: string,
  method: 'get' | 'post' | 'patch' = 'get',
  body?: unknown,
  missing = false,
): Record<string, unknown> | null {
  const response = UrlFetchApp.fetch(
    `https://api.github.com/repos/${c.repo}/${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${c.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      ...(body === undefined
        ? {}
        : { contentType: 'application/json', payload: JSON.stringify(body) }),
      muteHttpExceptions: true,
    },
  );
  const status = response.getResponseCode();
  if (missing && status === 404) return null;
  if (status < 200 || status >= 300)
    throw new Error('Publishing service rejected request');
  const text = response.getContentText();
  return text ? JSON.parse(text) : {};
}
function sha(value: unknown) {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/.test(value))
    throw new Error('Invalid publication commit');
  return value;
}
function saved(c: ReturnType<typeof config>): State | null {
  const value = c.p.getProperty(STATE);
  return value ? JSON.parse(value) : null;
}
function publicState(s: State | null) {
  return s
    ? {
        requestId: s.requestId,
        version: s.version,
        status: s.status,
        runUrl: s.runUrl ?? null,
      }
    : { status: 'idle' };
}
function update(c: ReturnType<typeof config>, state: State): State {
  if (['succeeded', 'failed'].includes(state.status)) return state;
  const response = api(
    c,
    `actions/workflows/publish-library.yml/runs?per_page=100&event=workflow_dispatch`,
  );
  const runs = response?.workflow_runs;
  if (!Array.isArray(runs)) throw new Error('Invalid publication status');
  const run = runs.find(
    (run) =>
      run.display_title === `Publish library ${state.requestId}` &&
      run.head_branch === c.ref,
  );
  if (!run) return state;
  if (!Number.isSafeInteger(run.id))
    throw new Error('Invalid publication status');
  state.runUrl = `https://github.com/${c.repo}/actions/runs/${run.id}`;
  state.status =
    run.status === 'completed'
      ? run.conclusion === 'success'
        ? 'verifying'
        : 'failed'
      : 'running';
  if (state.status === 'verifying') {
    const response = UrlFetchApp.fetch(`${c.origin}/catalog/current.json`, {
      muteHttpExceptions: true,
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (response.getResponseCode() !== 200)
      throw new Error('Published manifest unavailable');
    const manifest = LibraryManifestSchema.parse(
      JSON.parse(response.getContentText()),
    );
    state.status =
      manifest.catalogVersion === state.version ? 'succeeded' : 'failed';
  }
  c.p.setProperty(STATE, JSON.stringify(state));
  return state;
}
export function publishLibrary() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1500))
    return {
      ok: false,
      message: 'A library operation is already running. Check status.',
    };
  try {
    const c = config();
    const prior = saved(c);
    if (prior && !['succeeded', 'failed'].includes(prior.status))
      return { ok: true, ...publicState(update(c, prior)) };
    const { catalog, problems } = buildPublicCatalog(
      libraryCatalog(SpreadsheetApp.getActiveSpreadsheet()).workbook,
      catalogVersion,
    );
    if (!catalog || problems.length)
      return {
        ok: false,
        message:
          'The library has validation errors. Fix the catalog and dictionary before publishing. The live version is unchanged.',
      };
    // Rehash a canonical public document so every runtime verifies identical bytes.
    catalog.catalogVersion = catalogVersion(catalogDataJson(catalog));
    const json = canonicalJson(catalog);
    if (Utilities.newBlob(json).getBytes().length > LIBRARY_MAX_BYTES)
      throw new Error('Catalog exceeds publishing capacity');
    const requestId = Utilities.getUuid();
    const requestedAt = new Date().toISOString();
    const manifest = {
      schemaVersion: 1,
      catalogVersion: catalog.catalogVersion,
      publishedAt: requestedAt,
    };
    const head = api(c, `git/ref/heads/${c.branch}`, 'get', undefined, true);
    const parent = head ? sha((head.object as { sha?: unknown })?.sha) : null;
    const old = parent ? api(c, `git/commits/${parent}`) : null;
    const files = [
      [`catalog/${snapshotPath(catalog.catalogVersion)}`, json],
      ['catalog/current.json', canonicalJson(manifest)],
    ];
    const tree = files.map(([path, content]) => ({
      path,
      mode: '100644',
      type: 'blob',
      content,
    }));
    const created = api(c, 'git/trees', 'post', {
      ...(old ? { base_tree: sha((old.tree as { sha?: unknown })?.sha) } : {}),
      tree,
    });
    const commit = api(c, 'git/commits', 'post', {
      message: `Publish library ${requestId}`,
      tree: sha(created?.sha),
      parents: parent ? [parent] : [],
    });
    const commitId = sha(commit?.sha);
    if (parent)
      api(c, `git/refs/heads/${c.branch}`, 'patch', {
        sha: commitId,
        force: false,
      });
    else
      api(c, 'git/refs', 'post', {
        ref: `refs/heads/${c.branch}`,
        sha: commitId,
      });
    const state: State = {
      requestId,
      version: catalog.catalogVersion,
      commit: commitId,
      requestedAt,
      status: 'queued',
    };
    // Store before dispatch so a timed-out dispatch cannot cause duplicate publishes.
    c.p.setProperty(STATE, JSON.stringify(state));
    try {
      api(c, 'actions/workflows/publish-library.yml/dispatches', 'post', {
        ref: c.ref,
        inputs: {
          request_id: requestId,
          catalog_commit: commitId,
          environment: c.environment,
        },
      });
    } catch (error) {
      state.status =
        error instanceof Error &&
        error.message === 'Publishing service rejected request'
          ? 'failed'
          : 'unknown';
      c.p.setProperty(STATE, JSON.stringify(state));
      return { ok: true, ...publicState(state) };
    }
    return { ok: true, ...publicState(state) };
  } catch {
    return {
      ok: false,
      message:
        'Publication could not complete. Check publisher configuration and workflow status. The previous live deployment remains available.',
    };
  } finally {
    lock.releaseLock();
  }
}
export function libraryPublishStatus() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1500))
    return { ok: false, message: 'Publication is busy. Try status again.' };
  try {
    const c = config();
    const state = saved(c);
    return { ok: true, ...publicState(state ? update(c, state) : null) };
  } catch {
    return {
      ok: false,
      message:
        'Cannot verify publication. Check the workflow; no success has been confirmed.',
    };
  } finally {
    lock.releaseLock();
  }
}
export function showLibraryMenu() {
  SpreadsheetApp.getUi()
    .createMenu('Library')
    .addItem('Publish library', 'openLibraryPublisher')
    .addToUi();
}
export function openLibraryPublisher() {
  config();
  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createHtmlOutputFromFile('LibraryPublisher').setTitle(
      'Publish library',
    ),
  );
}
export function installLibraryPublisher() {
  const c = config();
  if (
    !ScriptApp.getProjectTriggers().some(
      (t) =>
        t.getHandlerFunction() === 'showLibraryMenu' &&
        t.getTriggerSourceId() === c.sheetId,
    )
  )
    ScriptApp.newTrigger('showLibraryMenu')
      .forSpreadsheet(c.sheetId)
      .onOpen()
      .create();
  showLibraryMenu();
}
