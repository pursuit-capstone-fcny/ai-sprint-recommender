# Glossary

The approved [catalog spec](specs/009-serve-catalog.md) defines the public data
contract. Catalog items are videos, identified by `youtubeId`.

| Term           | Definition                                                                    | ID format                                                        |
| -------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Sprint         | FCNY's AI Sprint program and its video library                                | n/a                                                              |
| Catalog item   | Public metadata for one video                                                 | 11-character YouTube ID, letters, digits, `_` or `-`             |
| Catalog        | Validated active items and canonical matching configuration served by `doGet` | `schemaVersion: 1`; `catalogVersion: sha256:<64 hex characters>` |
| Usage event    | Search, impression or click defined by spec #16                               | UUID `eventId`, `sessionId` and `searchId`                       |
| Recommendation | An ordered catalog item selected for a visitor                                | Existing `youtubeId`                                             |
| Fixture        | Fictional public catalog data checked into the repo for tests                 | Same contract as the public catalog                              |
| Preview        | A PR deployment using isolated test data and configuration                    | Hosting-generated URL                                            |

## Public catalog fields

| Field                             | Type and rule                                                                                                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `youtubeId`                       | Unique 11-character YouTube ID; derive URLs from this value                                                                                                            |
| `title`, `description`            | Trimmed, nonblank strings                                                                                                                                              |
| `functionAreas`, `tasks`, `tools` | Arrays of canonical dictionary tags; may be empty                                                                                                                      |
| `addedAt`                         | Valid ISO upload date `YYYY-MM-DD`, or `null` if unknown                                                                                                               |
| `lengthSeconds`                   | Positive integer, or `null` if unknown                                                                                                                                 |
| `status`                          | `active` or `retired`; only active rows are served                                                                                                                     |
| `startHere`                       | Boolean                                                                                                                                                                |
| `instructionForm`                 | Optional reviewed `demonstrated`, `walkthrough`, `explained` or `mentioned` evidence for the video's task tags; omitted legacy values retain existing per-task reviews |

Private Sheet columns are excluded. Duplicate IDs exclude every copy, even if
one copy is retired or invalid. Diagnostics contain tab, row, field and a
generated reason, never cell contents.

The dictionary has `functionArea`, `task` and `tool` categories. Synonyms map an
alias directly to a canonical target in one category. Adjacent tools name a
source tool, related tool and applicable canonical task; the relationship is
directional.

This records the approved contract, not approval to publish FCNY's data. The
public-field and anonymous-access decisions in #8 remain deployment requirements.
