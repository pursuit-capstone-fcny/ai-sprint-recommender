// Spreadsheet apps run cells beginning with these characters as formulas.
const formulaStart = /^[=+\-@\t\r]/;

function cell(value: string | number): string {
  if (typeof value === 'number') return String(value);
  const text = formulaStart.test(value) ? `'${value}` : value;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
}

export function csvFilename(
  view: string,
  startDate: string,
  endDate: string,
): string {
  return `library-analytics-${view}-${startDate}-to-${endDate}.csv`;
}

export function downloadCsv(filename: string, csv: string) {
  // The byte-order mark lets Excel read titles with non-ASCII characters.
  const url = URL.createObjectURL(
    new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
