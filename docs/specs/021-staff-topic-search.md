# Spec: Staff topic search

- **Issue:** #21
- **Status:** in review

Staff topic search is a view inside the existing private analytics dashboard.
It reads the same published catalog snapshot as analytics, including descriptions,
canonical tags and maintained synonym mappings. It makes no LLM calls.

## Acceptance criteria

### AC-21.1: All active topic matches

- **Given** a validated published catalog
- **When** staff open Topic search or submit a topic
- **Then** blank input browses all active videos, and a topic returns every matching
  distinct video in ranked order. Do not cap results, deduplicate by task, inject
  Start-here picks or add fallback padding. A miss shows a recoverable empty state.

### AC-21.2: Function and tool filters

- **Given** a submitted topic and optional function-area and tool selections
- **When** filters change
- **Then** require the topic AND each selected filter category, with OR within
  a category. Clearing filters restores the complete submitted topic list;
  Browse all also clears the topic. Report date/activity filters do not restrict
  topic search. Search inputs stay in page memory and are not put in URLs.

### AC-21.3: Synonyms and typo matching

- **Given** canonical tags and aliases in the published snapshot
- **When** topic search normalizes case, punctuation and word forms
- **Then** match whole words/phrases, expand complete aliases through their
  canonical category/target, and allow one insertion/deletion/substitution for
  tokens at least five characters long. Require every query term or alias concept;
  exact and alias matches outrank fuzzy-only matches. Tool filters remain exact.
  Changed published synonyms take effect on Reload data, without code edits.

### AC-21.4: Topic usage context

- **Given** explicitly configured, approved topic collection
- **When** staff submit, filter, browse or open a matching video
- **Then** create a new searchId per result context, record mode=topic and src=team,
  count the complete result set, and retain full-list positions on impressions and
  clicks. Deduplicate repeated renders within a context. Keep original topic text
  out of events; send only published canonical tags. Collection is best effort
  under existing collector limits. Demo preview never collects events.

## Deployment and validation

The authenticated dashboard response includes the current public catalog.
Existing Google identity, visitor execution and Restricted file checks still apply
on every read. Reload, disconnect and access failures clear search metadata/results.
Older admin deployments without catalog metadata show Topic search unavailable.
The public preview supplies fictional catalog metadata only.

Optional admin Script Properties `TOPIC_USAGE_ENABLED=true`, `TOPIC_USAGE_URL`
(existing approved Apps Script collector /exec URL), and
`TOPIC_USAGE_RETENTION_DAYS` (approved 1–365 days) opt into staff collection.
No property is set by this feature. Deploy the updated collector and admin report
before opting in; they understand optional topic-search functionAreas while
retaining the legacy single functionArea field. Default analytics excludes team
traffic. Collector limits and retention remain owned by #16/#8.

Verify >8 matches sharing a task, sparse matches, zero matches, aliases, typos,
AND/OR filters, playback/copying, keyboard/mobile, privacy and full-list event ranks.
