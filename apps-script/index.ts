/// <reference types="google-apps-script" />
import { publishedCatalog } from './published-library';

export {
  clearAnalytics,
  initializeAnalytics,
  refreshAnalytics,
  installAnalyticsTriggers,
  refreshAnalyticsOnEdit,
  analyticsReportLinks,
} from './analytics-sheet';
export {
  refreshFeedbackReport,
  installFeedbackReporting,
} from './feedback-sheet';

export {
  doPost,
  initializeUsageLog,
  purgeUsageLog,
  configureUsageBurst,
} from './usage-sheet';
export {
  initializeRequests,
  purgeRequests,
  installRequestRetention,
} from './contributions-sheet';

export function doGet() {
  let body: string;
  try {
    const properties = PropertiesService.getScriptProperties();
    const enabled = properties.getProperty('CATALOG_PUBLIC_ENABLED') === 'true';
    body = enabled
      ? JSON.stringify(publishedCatalog())
      : JSON.stringify({ error: { code: 'CATALOG_DISABLED' } });
  } catch {
    body = JSON.stringify({ error: { code: 'CATALOG_UNAVAILABLE' } });
  }
  return ContentService.createTextOutput(body).setMimeType(
    ContentService.MimeType.JSON,
  );
}

export {
  previewLibrary,
  publishLibrary,
  libraryPublishStatus,
  showLibraryMenu,
  openLibraryPublisher,
  installLibraryPublisher,
} from './library-publisher';

export { initializeTrackerFromPublished } from './tracker-sheet';
