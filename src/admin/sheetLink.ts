// Regex parsing works in Apps Script V8, where the browser URL class is absent.
export function parseSheetLink(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048)
    throw new Error('Invalid Sheet link');
  const id = value
    .trim()
    .match(
      /^https:\/\/docs\.google\.com\/spreadsheets\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{10,150})(?:\/[^?#\s]*)?(?:\?[^#\s]*)?(?:#[^\s]*)?$/,
    )?.[1];
  if (!id) throw new Error('Invalid Sheet link');
  return id;
}
export const sheetLink = (id: string) =>
  `https://docs.google.com/spreadsheets/d/${id}/edit`;
