/// <reference types="google-apps-script" />
import { configuredLibrarySheet } from './published-library';

// Catalog metadata is public; activity is not. A same-workbook deployment must
// remain Restricted even if someone changes sharing after initial setup.
export function requirePrivateLibraryWorkbook(id: string) {
  if (id !== configuredLibrarySheet())
    throw new Error('Activity must stay in the configured source workbook.');
  if (DriveApp.getFileById(id).getSharingAccess() !== DriveApp.Access.PRIVATE)
    throw new Error(
      'Set the source workbook sharing to Restricted before storing activity.',
    );
}
