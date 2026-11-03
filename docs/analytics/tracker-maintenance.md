# Maintain the library in Video Tracker

The original workbook owns per-video metadata and its private Usage tab. Staff
edit tracker rows and explicitly publish; nobody maintains catalog JSON by hand.
The generated public snapshot remains the interface consumed by recommendations,
usage validation and private analytics. A future Airtable importer can provide
the same contract without changing those consumers.

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
