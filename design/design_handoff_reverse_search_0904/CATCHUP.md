# Catch-up: what changed since the last handoff

Two screens are new and one rule got stricter. Everything else in the app is unchanged — if you
have already built the companies list, company project tabs, candidate profile, and import review,
these are the only deltas.

## 1. NEW — Company list import gained a mapping step
Previously "Import company list" was a single action. It is now a full screen the candidate passes
through before anything is written. Route: reached from the "Import company list" button on the
projects list.

Three parts, in order:
1. **What we read** — the first three rows of the CSV rendered raw in a table, plus a "Header row
   detected" note. The candidate sees their own data before mapping it.
2. **Mapping** — one row per CSV column: column name (monospace), sample values, a destination
   `select`, and a status flag. Confident matches read `MATCHED` in neutral-600; guesses read
   `GUESSED · CONFIRM` in accent-700 and are meant to be looked at. Header meta states the split
   ("9 mapped automatically · 4 need a decision").
3. **How it drives suggestions** — two radio groups. Ranking strategy (their priority column only /
   their priority with our fit as tiebreak, the default / our fit only) and what to do with
   unrecognised columns (keep on the record unanalysed, the default / fold into notes / drop).
   The ranking panel also states data quality: how many rows actually carry the priority value and
   where the blanks sort.

Footer promises dedupe explicitly: names already existing as projects are matched, not duplicated.
The import runs with **no API call** and the completion strip says how many were matched vs. created.

Implementation notes: this needs a parse-and-preview endpoint separate from the commit endpoint
(`src/lib/importTracker.ts` currently does both), a persisted column mapping per user so repeat
imports of the same tracker skip the step, and the ranking strategy stored as a user preference
because the suggestion strip on the projects list reads it.

## 2. NEW — Admin screen
Third header link, next to Candidate profile. Purpose: make LLM spend legible to the person paying
for it — who, in the local-install model, is the user themselves, spending against their own key.
- Period segmented control (7 days / 30 days / All time).
- Unit-cost band: total, cost per profile extracted, cost per action plan, and **spend on re-runs**
  in accent red.
- Cost per company, broken out by the activity that spent it: profiles, action plans, job
  descriptions, profile updates, plus a run count and total.
- Cost per activity as four cards with proportion bars.
- Last five API calls: timestamp, activity, company, tokens in/out, cost.

Implementation notes: requires per-call cost/token logging attributed to (user, company, activity)
— an `ApiCall` table with `companyId`, `activity` enum, `tokensIn`, `tokensOut`, `costCents`,
`isRerun`. The `isRerun` flag is what makes the re-run figure possible, so set it at call time.
Month-to-date total also feeds the header.

## 3. STRICTER — staleness must name its cause
The out-of-date bar no longer just says "out of date". It states what changed and what the visible
numbers are still based on: "3 profiles were added after this analysis ran. Numbers below are from
the 6-profile run." The import review screen does the same in advance, under a
`KNOCK-ON EFFECT` heading, naming every analysis the import will invalidate before the candidate
commits.

This means staleness needs to carry a reason, not a boolean: store what invalidated the analysis
(profiles added, candidate profile changed, posting re-imported) and the input counts of the run
that produced the visible output.

## 4. DECIDED — deployment is local, single user, bring-your-own key
The app is released publicly for people to run locally against their own API key. There is no
hosted multi-tenant version and no billing. Consequences for implementation:

- No accounts, no orgs, no sharing. Everything is one user's data on one machine.
- The API key is user-supplied and stored locally; the app needs a place to enter it and a clear
  failure state when it is missing or rejected.
- **Cost is the user's own money, spent per run.** A full single-company analysis currently runs
  about $4 in credits. The Admin screen is therefore not a billing dashboard — it is the user's own
  spend log, and its job is to let them decide whether the next run is worth it.
- Cost reduction is an open workstream (fewer/cheaper model calls). Any figure in the prototype is
  illustrative; read real numbers from logged usage.

**Shared profiles is cancelled.** It only made sense for a hosted multi-user product. Profiles stay
company-scoped. Ignore any earlier note about making them shareable entities.
