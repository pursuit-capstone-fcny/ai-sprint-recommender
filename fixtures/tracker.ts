import { parsePublicCatalog } from '../src/contracts/publicCatalog';
import { catalogVersion } from '../apps-script/catalog-sheet';
import { catalogDataJson } from '../src/library/catalog';
import {
  trackerColumns,
  type TrackerRow,
} from '../apps-script/tracker-catalog';
import publicCatalog from './public-catalog.json';

export function trackerFixture() {
  const baseline = parsePublicCatalog(publicCatalog);
  baseline.items = baseline.items.filter((item) => item.tasks.length);
  baseline.catalogVersion = catalogVersion(catalogDataJson(baseline));
  const rows: TrackerRow[] = baseline.items.map((item, i) => ({
    row: i + 5,
    cells: {
      'Video Title': item.title,
      Description: item.description,
      'YouTube Link': `https://youtu.be/${item.youtubeId}`,
      'Primary Category (Web)': item.functionAreas[0] ?? '',
      'Category 2': item.functionAreas[1] ?? '',
      Tool: item.tools.join(', '),
      Status: 'Live on YouTube',
      'Task keywords': item.tasks.join(', '),
      'Metadata status': 'Ready',
      'Instruction format': '',
    },
  }));
  const grid = [
    [],
    [],
    [],
    [...trackerColumns],
    ...rows.map(({ cells }) => trackerColumns.map((name) => cells[name])),
  ];
  return { baseline, rows, grid };
}
