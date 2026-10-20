import { parsePublicCatalog } from '../src/contracts/publicCatalog.ts';
import { isDeepStrictEqual } from 'node:util';

try {
  const [input, ...extra] = process.argv.slice(2);
  if (!input || extra.length)
    throw new Error('Usage: pnpm check:catalog <test-exec-url>');
  const url = new URL(input);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'script.google.com' ||
    !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname) ||
    url.search ||
    url.username ||
    url.password
  ) {
    throw new Error(
      'Use the public Apps Script /macros/s/<deployment-id>/exec URL.',
    );
  }
  const started = performance.now();
  const response = await fetch(url, {
    credentials: 'omit',
    redirect: 'follow',
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (
    !response.ok ||
    !response.headers.get('content-type')?.includes('application/json')
  ) {
    throw new Error(
      'The endpoint did not return successful JSON. Check deployment access and Script Properties.',
    );
  }
  let catalog;
  try {
    const payload = await response.json();
    catalog = parsePublicCatalog(payload);
    // Parsing strips unknown fields; deployment checks must also catch leaks.
    if (!isDeepStrictEqual(payload, catalog)) throw new Error();
  } catch {
    throw new Error(
      'The response failed the public catalog contract. Check Problems and Script Properties.',
    );
  }
  console.log(
    JSON.stringify(
      {
        items: catalog.items.length,
        catalogVersion: catalog.catalogVersion,
        redirected: response.redirected,
        responseOrigin: new URL(response.url).origin,
        elapsedMs: Math.round(performance.now() - started),
      },
      null,
      2,
    ),
  );
} catch (error) {
  // Do not print response bodies, Zod issues or network error details.
  const safe =
    error instanceof Error &&
    (error.message.startsWith('Usage:') ||
      error.message.startsWith('Use the public') ||
      error.message.startsWith('The endpoint') ||
      error.message.startsWith('The response'));
  console.error(
    safe ? error.message : 'Catalog check failed or exceeded ten seconds.',
  );
  process.exitCode = 1;
}
