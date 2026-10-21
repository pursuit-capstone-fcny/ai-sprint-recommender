# #16 Log searches and clicks through Apps Script

The approved spec and acceptance criteria are in
[docs/specs/016-usage-logging.md](../docs/specs/016-usage-logging.md).

This backend slice implements the event contract, POST validation, locked
deduplication, write caps and retention functions. It leaves browser delivery,
event timing, session lifetime and disclosure to the frontend follow-up.
Logging stays disabled until #8 approval and explicit environment configuration.

See [backend setup and remaining checks](../apps-script/usage-README.md).
