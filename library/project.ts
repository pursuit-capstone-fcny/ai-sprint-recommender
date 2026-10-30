import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';
import { libraryOrigin } from '../src/library/catalog.ts';
import { parseSheetLink } from '../src/admin/sheetLink.ts';

// Build-time only. The Sheet link is never injected into the public bundle.
export function projectLibraryOrigin(
  environment: Record<string, string | undefined>,
) {
  const path = 'library/config.local.json';
  const project = existsSync(path)
    ? z
        .strictObject({
          sourceSheetUrl: z.string().refine((value) => {
            try {
              parseSheetLink(value);
              return true;
            } catch {
              return false;
            }
          }),
          catalogOrigin: z.string().transform(libraryOrigin),
          githubRepository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
          workflowRef: z.string().min(1),
          environment: z.enum(['test', 'production']),
        })
        .parse(JSON.parse(readFileSync(path, 'utf8')))
    : null;
  const configured = environment.VITE_LIBRARY_ORIGIN?.trim();
  const origin = configured ? libraryOrigin(configured) : undefined;
  if (origin && project && origin !== project.catalogOrigin)
    throw new Error('Environment and project library origins disagree');
  return origin ?? project?.catalogOrigin;
}
