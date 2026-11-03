# Maintain the library in Video Tracker

The original workbook owns per-video metadata and its private Usage tab. Staff
edit tracker rows and explicitly publish; nobody maintains catalog JSON by hand.
The generated public snapshot remains the interface consumed by recommendations,
usage validation and private analytics. A future Airtable importer can provide
the same contract without changing those consumers.

When switching an existing collector to the tracker, setup first checks its
previous Usage workbook. It refuses to change targets while records remain or
the previous workbook cannot be checked. Its existing purge trigger follows the
configured workbook ID, so changing that ID would leave the old records without
cleanup. Keep the old collector and purge trigger running until retention clears
those rows. To cut over sooner, use a separate collector project for the tracker
and leave the old project's configuration and purge trigger intact. Configure
the new project's usage target as the tracker workbook. No old activity is copied
or deleted by tracker initialization.

## Staff workflow

1. Add the video to Video Tracker. Keep the existing title, description, YouTube
   link, primary/secondary category, tool and publication-status columns.
2. Fill **Task keywords** with comma-separated tasks actually covered. Use
   equivalent existing vocabulary where appropriate. New task/tool/category
   values need no code change; update existing dropdown choices if necessary.
3. For a new video or newly added task tags, choose **Instruction format**: `demonstrated`, `walkthrough`,
   `explained`, or `mentioned`. This is a staff review of the tagged tasks,
   not automatic inference. Use the weakest applicable form or narrow the tags.
   A mere mention does not qualify as a taught procedure. Existing migrated
   videos leave this blank to retain the already reviewed per-task evidence.
4. Set **Metadata status** to `Ready` after review. A published-status row with
   incomplete metadata blocks publication; unpublished rows remain drafts.
5. Open **Library → Publish library**, choose **Review changes**, inspect the
   additions, edits and retirements, then choose **Publish library**. If anyone
   edits the draft or publishes another version after review, review again.
6. Use **Check status** until publication is verified. The previous catalog stays
   live if validation or deployment fails. Refresh the app to read the new version.

To retire a video, change its existing Status away from the two live YouTube
statuses, then review and publish. Changing its YouTube link changes its identity;
the preview shows the old video retired and the replacement added. Row sorting
does not change identity or ranking. Never reuse a row's old task tags for an
unrelated replacement video.

New videos can participate in catalog task and tool matching using reviewed
metadata. Rules for complex source-to-output workflows remain conservative;
adding a task tag does not establish a demonstrated workflow or teach the engine
arbitrary new language. Haiku receives the new public metadata under its existing
model, budget, relevance and input-size limits.

## One-time owner setup

The source workbook must be **Restricted**, with named staff access. A workbook
shared with Anyone with the link cannot also hold private usage safely. The
collector checks sharing at setup and whenever it accesses activity, and refuses
broader sharing. The producer manifest adds the same read-only Drive scope used
by the private dashboard so it can verify sharing; it never changes permissions.
The owner must grant edit access and complete this sharing change before setup.

Deploy the updated application and private dashboard readers before publishing
any new `instructionForm` fields. Older strict readers reject fields they do not
recognize. The initial migrated snapshot deliberately retains its old hash and
omits the new field, so existing recommendations remain unchanged during setup.

1. Keep the last-good public catalog and its immutable hash as the migration
   baseline. Configure the original bound project's `LIBRARY_SOURCE_SHEET_URL`
   and `LIBRARY_PUBLIC_ORIGIN`, existing publisher credentials/targets, and the
   approved usage retention/limits. Preserve unrelated script files and settings.
2. Install the producer bundle built by `pnpm build:apps-script`. Run the
   editor-only `initializeTrackerFromPublished`. It reads only public columns,
   validates a complete migration before writing, adds the three metadata
   columns, reconciles public metadata to the baseline, writes readiness last,
   and verifies the result. It never overwrites existing metadata. Readiness
   seeds the already published baseline, not a new claim of client tag approval;
   the separate review tab and its approval statuses are unchanged.
3. It sets `LIBRARY_SOURCE_FORMAT=tracker`, `CATALOG_SPREADSHEET_ID` and
   `USAGE_SPREADSHEET_ID` to this workbook and initializes Usage there. It does
   not enable logging, alter retention/traffic limits, copy test events, or
   publish content. Keep existing retention triggers running.
4. Configure the private dashboard's `LIBRARY_SOURCE_SHEET_URL` to the same
   workbook and its `LIBRARY_PUBLIC_ORIGIN` to the same public catalog. Staff
   connect this Restricted workbook under their own Google identity. Existing
   CSV export provides spreadsheet analytics without more generated tabs.
5. Run `installLibraryPublisher`, reopen the workbook, review and publish.
   Verify signed-out catalog access, one authorized usage receipt, and private
   dashboard reconciliation before switching the live collector endpoint.

The normalized Catalog path remains available for existing deployments until
tracker mode is explicitly selected. Setup is not a periodic synchronization job.
If setup is interrupted, inspect and reconcile the partial metadata before
retrying; the initializer deliberately refuses to overwrite it.

## Test on a private copy

Copy the complete original workbook and keep sharing Restricted. Run the same
initializer and publisher in that copy. Deploy its collector from the workbook
owner's Google account, with the approved test retention and limits. Configure
both the collector and test app to use the copy's published catalog origin.

For a separate catalog preview, set `LIBRARY_ENVIRONMENT=test`,
`LIBRARY_PREVIEW_NAME=<name>`, and
`LIBRARY_DATA_BRANCH=library-data-test-<name>`. Names use 1–32 lowercase letters,
digits or hyphens, starting with a letter or digit. Set
`LIBRARY_PUBLIC_ORIGIN` to that named preview and `LIBRARY_WORKFLOW_REF` to the
tested application ref. Seed its data branch from the baseline before migration.
The publisher rejects mismatched names/branches and production preview overrides.
This protects the shared test catalog while exercising real content publication.

An operator can manually dispatch `publish-library.yml` with the same preview
name/data branch and an `app_collector_url` to build an isolated app that records
activity in the copy. This option accepts only an Apps Script `/exec` endpoint,
requires a named test preview, and keeps paid LLM calls, requests and feedback
off by default.
Normal Sheet publication never sends this input and only deploys catalog assets.

Use a repository-scoped Contents/Actions write credential in Script Properties.
Keep credentials out of source, logs and screenshots, and remove temporary test
credentials when verification finishes. New videos need only reviewed tracker
metadata and publication; neither the app nor its test preview needs rebuilding.

The November 3 private-copy check completed migration, real publication and
browser-to-Usage delivery. Its [aggregate verification record](tracker-verification-2026-11-03.json)
contains the preview and deployment job links. The added video is a labeled
synthetic metadata fixture; playback was not part of this check. Future
publication from that copy requires a replacement scoped credential after the
temporary test credential was removed. The test app and its collector continue
to use the last published catalog without a GitHub credential.

## Repeatable parity check

Export only the ten recognized tracker fields as `{row, cells}` objects. Keep
live source exports and the migration plan outside the repository.

```sh
node scripts/verify-tracker-catalog.mjs /tmp/public-catalog.json /tmp/public-tracker.json /tmp/parity-evidence.json /tmp/migration.json
```

The command verifies the snapshot hash, plans initialization when metadata is
blank, compares the complete catalog and deterministic results, compares LLM
request bodies without calling a provider, tests row reordering, and exercises
a reviewed addition and an incomplete addition. It writes only the requested
local reports. After migration, rerun against fresh tracker values to prove the
actual written cells reproduce the same catalog.

Keep a public-only pre-migration cell backup for undo. The importer reads bounded
columns and accepts up to 5,000 tracker rows; existing snapshot byte limits and
LLM token budgets still apply. Exceeding them produces a failure and retains the
last good publication, rather than truncating the library.

For full workflow checks, the manual dispatch also accepts
`app_feedback_enabled`, `app_requests_config`, and `app_analytics_url`.
The request configuration must use that same isolated collector. Deploy a
separate authenticated analytics project with the copy's source URL and named
catalog origin, then supply its `/exec` URL so the preview's footer reads the
copy. An empty override hides the footer link in the isolated preview.

`app_live_haiku=true` temporarily enables the repository's provider credential
only in this named preview. The server expires it after fifteen minutes and
limits its own test budget to $0.05 per day and month, one concurrent request,
and two requests per minute. The test namespace retains that budget across
redeployments. Dispatch again with `app_live_haiku=false` after testing to disable
paid calls and overwrite both temporary credential values with empty strings.
The runner deletes its temporary secrets file even if deployment fails.

The full private-copy workflow was checked on November 3 with feedback, topic
requests, consented demo offers, an authenticated analytics connection, and four
paid Haiku calls under the separate five-cent test budget. The final deployment
has paid calls disabled and its temporary provider/rate credentials cleared.
Feedback revisions produced one effective response; contact details stayed in
the separate review workbook. Blank deterministic submissions now remain passive
browsing and create no search or appearance. Direct playback and feedback do
not inflate recommendation metrics. Labelled fallback cards remain excluded
from real-match appearance and click totals.

The original native run had two receipt gaps. Investigation reproduced
`USAGE_UNAVAILABLE` when Apps Script's URL-fetch call failed while loading the
published catalog manifest, before appending activity. The sender now retries
transient failures once with the identical payload and event ID. A lost
acknowledgment after a committed write yields a duplicate receipt rather than a
second row. Validation failures and policy stops are not retried; queue bounds,
deadlines, retention and configured write caps are unchanged.

The November 3 recovery retest saved all 33 expected receipts with 33 unique
IDs: direct playback, feedback revisions, the added video, an eight-card
deterministic fallback, seven live Haiku recommendations plus playback, and an
eight-card Haiku abstention. Both fallback runs saved every rank. Requests and a
consented demo reached the private review workbook, and the refreshed feedback
report retained only the latest vote per response. The private dashboard
reconciled to 14 real recommendation appearances, one recommendation embed
click, and two direct views/embed clicks. Default cards and the final fallback
added no real recommendation counts.

Delivery remains bounded and best effort during persistent failures, exhausted
caps, page closure or queue expiry. Historical gaps remain in the verification
record; no activity was fabricated to fill them. The added video remains a
synthetic metadata fixture, and its media playback is not verified.
