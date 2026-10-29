# Luna low reliability rerun — October 29, 2026

Use the existing test Worker and remaining original $1 Luna allowance. Prior
cumulative ceiling: $0.398955; available: $0.601045. Each dispatched request
reserves $0.007. No paid retries, extra allowance or historical refunds.

- Keep the frozen ten profiles, labels, catalog and two-primary-task gate unchanged.
- Refresh an aging catalog during the unpaid catalog load, within the existing
  60-second freshness limit. Keep the 4.5-second server / five-second browser deadlines.
- Keep strict whole-response rejection. Distinguish refusal, JSON/schema, duplicate,
  out-of-range and incomplete output with bounded diagnostics, never raw responses.
- Preserve settlement after a timed-out browser response, distinguish zero-cost
  pre-dispatch failures from unknown billed usage, and await final diagnostics.
- Run three fresh ten-profile trials plus the existing two wording regression
  probes, nonsense and injection probes. Reused wording is not unseen evidence.
- Verify synthetic failure handling without model calls. Save every outcome and
  the durable budget readback; disable the test endpoint and remove keys afterward.
- Production LLM calls and usage logging remain disabled. Human semantic review,
  FCNY runtime/privacy/budget decisions and demo review remain separate gates.
