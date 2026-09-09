# Handoff: Reverse Search — candidate profile & company analysis

> A density redesign landed after this document was written — the design system, three-zone
> structure, and token rules below all still hold; they're just reflected directly in the shipped
> code now rather than in a separate change-order doc.

## Overview
Reverse Search is a single-user web app for a job seeker. The candidate captures raw material
(their own resume/LinkedIn documents, screenshots of competitor profiles at target companies,
pasted job postings, a CSV of the companies they are tracking), the app runs LLM analysis over it,
and the app returns ranked, concrete actions: gaps to close, resume edits, people to reach,
skills to acquire.

The app already exists as a Next.js codebase at `dev-timbre-network/reverse-search` (branch
`master`). This handoff is a **UI/UX specification** for that codebase, not a greenfield build.

## About the design files
The files in `prototype/` are **design references created in HTML** — a clickable prototype
showing intended look and behavior. They are not production code to copy. Recreate the screens in
the existing Next.js app using its established patterns (App Router pages, Prisma models, the
zod schemas in `src/lib/schemas.ts`). All data in the prototype is hard-coded fixtures.

To view it: open `prototype/Reverse Search.dc.html` in a browser (it is self-contained; the
sibling `support.js` and `_ds/` folder must stay next to it). Navigation is real — the header
links and in-page buttons move between all screens.

## Fidelity
**High fidelity.** Colors, type, spacing, dividers, and interaction states are final and come from
the Modernist design system (`prototype/_ds/modernist-.../styles.css`, guide in the same folder's
`readme.md`). Recreate pixel-for-pixel. Copy is also final — treat all visible strings as
intentional; they carry the product's voice (blunt, specific, no hedging).

---

## The organising rule (most important thing in this document)

Every analysis screen is split into three numbered zones, in this order, each introduced by a
section header with a monospace accent-red kicker:

| Kicker | Means |
| --- | --- |
| `01 — CAPTURED` / `01 — WHAT WE HOLD` / `01 — WHAT WE READ` | Raw material the candidate supplied. Never model output. |
| `02 — ANALYSIS` / `02 — MAPPING` | Model output. Scores, verdicts, prose reads. |
| `03 — DO NEXT` | Actions. Every item has a button or a concrete instruction. |

Do not blend them. If a new feature adds content, decide which zone it belongs to and put it there.

**Section header markup** (used ~15 times across the app):
```
display:flex; align-items:baseline; gap:14px;
border-bottom:2px solid var(--color-divider); padding-bottom:8px;
  ├ kicker: font:400 10px/1 ui-monospace,Menlo,monospace; letter-spacing:.16em; color:var(--color-accent)
  ├ h3: font-size:22px (20px on narrower screens); margin:0
  └ right-aligned meta: margin-left:auto; font-size:12px; color:var(--color-neutral-700)
```

---

## Screens

### Global chrome
- **Header** — sticky, `padding:14px 40px`, `border-bottom:2px solid var(--color-divider)`,
  `background:var(--color-bg)`, `z-index:20`. Wordmark "Reverse Search" (heading font, 800, 18px,
  `letter-spacing:-0.02em`), then text links: Companies · Candidate profile · Admin (14px, no
  underline, `color:inherit`, `aria-current="page"` on the active one). Right side: month-to-date
  spend in monospace 11px `var(--color-neutral-600)`, then a 28×28 square avatar
  (`background:var(--color-neutral-900)`, `color:var(--color-bg)`, initials, heading font 11px).
- **Run strip** — appears below the header while any analysis is running. Full-bleed
  `background:var(--color-accent)`, `color:var(--color-bg)`, `padding:11px 40px`. A 9×9px pulsing
  square (`rsPulse`, 1s ease-in-out infinite, opacity 1 → .25), the run label (heading 800 13px),
  a detail line (13px, opacity .9) naming company + estimated cost, then a right-aligned 240×4px
  progress track (`rgba(255,255,255,.32)` with a `var(--color-bg)` fill) and elapsed seconds in
  monospace.
- **Done strip** — replaces the run strip on completion. `background:var(--color-neutral-900)`,
  `color:var(--color-bg)`, same padding. A `COMPLETE` chip (monospace 10px, 1px light border,
  `padding:4px 7px`), the result sentence, then a light-filled CTA button that navigates to the
  changed thing, and a bordered "Dismiss".

### 1. Companies list (`/`)
Purpose: pick a company project to work in, and see what the model thinks is worth opening next.
- Page header: kicker `COMPANY PROJECTS`, h1 42px `letter-spacing:-0.025em`, right-aligned
  buttons "Import company list" (`.btn-secondary`) and "New project" (`.btn-primary`).
- **Stat band**: 4 equal columns, `border-top`/`border-bottom: 2px solid var(--color-divider)`,
  `1px` vertical rules between. Value = heading 800 30px `line-height:1`; label = 12px
  `var(--color-neutral-700)`. Counts: profiles captured, job descriptions, **analyses out of date**
  (`color:var(--color-accent-700)`), API spend · 30 days.
- **Projects table** (`.table`): Company (name heading 800 16px + sector 12px muted) · Profiles ·
  Job descriptions · Fit (64×6px track, `var(--color-neutral-300)` background, fill
  `var(--color-neutral-900)` if fit ≥ 70 else `var(--color-accent)`, plus `nn/100` in monospace) ·
  Last analysis · State tag, right-aligned. Whole row is clickable (`cursor:pointer`) and opens the
  project. State tag is `.tag .tag-neutral` for "Current", `.tag .tag-accent` for everything else
  ("Out of date", "Too thin", "Never run").
- **`DO NEXT` — "Worth opening a project for"**: 3 cards in a grid with `gap:2px` over
  `background:var(--color-divider)` (the gap IS the rule — this pattern recurs everywhere; cards are
  `background:var(--color-surface); padding:20px`). Each: company name (heading 800 17px), a
  reasoning paragraph (13px `var(--color-neutral-800)`), a monospace `BASED ON — …` provenance line
  (11px `var(--color-neutral-600)`) — **required, every suggestion says what it was derived from** —
  and Promote / Dismiss buttons.

### 2. Company project (`/company/[slug]`)
- Back link `← ALL PROJECTS` (monospace 11px, `letter-spacing:.1em`). h1 40px company name, a
  13px meta line (sector · project opened · applications in tracker), and right-aligned
  `OVERALL FIT` with a heading-800 34px score and a 16px `/100` in `var(--color-neutral-600)`.
- **Tabs**: flush-left buttons on a `2px` divider baseline, each `padding:12px 20px 10px`,
  `margin-bottom:-2px`, `border-bottom:3px solid` (accent when active, transparent otherwise),
  label heading-800 14px + a monospace count at `opacity:.7`. Tabs: Profiles · Job descriptions · Chat.

#### 2a. Profiles tab
- `01 — CAPTURED` "People at Acxiom", meta = "9 people · 14 screenshots · 2 LinkedIn exports".
  4-column card grid (`gap:2px` over divider): 34×34 grey placeholder square
  (`var(--color-neutral-300)` — no avatar images anywhere in this app), name heading-800 14px,
  title 12px muted, and a monospace provenance footer above a `1px` top border
  (e.g. `3 SCREENSHOTS · 17 AUG`). Final cell is an "Add profiles" dropzone:
  `border:2px dashed var(--color-divider)`, `background:var(--color-bg)`, an Import primary button.
- `02 — ANALYSIS` "Role clusters and fit". **Staleness treatment** — when profiles were added
  after the last run: a bar with `border:2px solid var(--color-accent)`, `padding:12px 16px`,
  containing an `OUT OF DATE` monospace label in `var(--color-accent-700)`, a sentence naming
  exactly what changed ("3 profiles were added after this analysis ran. Numbers below are from the
  6-profile run."), and a right-aligned "Re-run analysis" primary button. The stale content below
  is wrapped in `filter:grayscale(1); opacity:.55`. Clicking re-run starts the run strip and clears
  both.
- Cluster cards, 3 across: label heading-800 18px + score heading-800 26px (accent when below
  threshold, `var(--color-neutral-900)` when strong), a 6px score bar, a monospace verdict line,
  reasoning prose 13px, then member name tags (`.tag .tag-neutral`).
- `03 — DO NEXT` "What would make this read sharper": 2 cards, each with a large accent
  ordinal (`01`, `02` heading-800 20px `var(--color-accent)`) beside a title, an explanation of
  why the analysis is weak, and a secondary button that fixes it by capturing more material.

#### 2b. Job descriptions tab
- `01 — CAPTURED`: posting cards, 2 across. The selected one gets
  `background:var(--color-accent-100)`, `border-left:3px solid var(--color-accent)`, and a
  monospace `SELECTED` marker. Title heading-800 17px, a level/function/comp meta line, and tags
  (application outcome + import date). Header action: "Paste a posting".
- `02 — ANALYSIS` "How your profile reads against this posting": a `200px 1fr` grid. Left cell:
  `ROLE FIT` monospace label, score heading-800 44px, 6px bar, and a comparison sentence against
  the company-level score. Right cell: `FUNCTION-TYPE ASSESSMENT` prose at 15px/1.55,
  `max-width:74ch`, then a `1px` divider and `LIKELY REJECTION REASON` prose at 14px. This is the
  product's core insight surface — the model names the mismatch in plain words, with counts
  ("eight of the eleven required-experience lines").
- `03 — DO NEXT` "Action plan", 2-column grid of `var(--color-surface)` panels, each with a
  monospace label:
  - `RANKED GAPS` — numbered accent ordinals + 14px lines.
  - `RESUME EDITS` — each edit is `border-left:2px solid var(--color-accent); padding-left:12px`
    with the instruction and a monospace target line (`IDENTITY · HEADLINE`, `SKILLS · PRIMARY`)
    naming which profile field it touches.
  - `PEOPLE TO REACH` — pulled from the Profiles tab (with a monospace `FROM PROFILES TAB ↗` link
    that actually navigates there); each person has shared-connection and cluster tags.
  - `OUTREACH DRAFT · <NAME>` — the draft in a `var(--color-bg)` box with a `1px` border,
    14px/1.6, plus Copy (secondary) and Regenerate (ghost).
  - `SKILLS AND EXPERIENCE TO ACQUIRE` — `grid-column:span 2`, three items, each justified by a
    count drawn from the captured profiles.
  - Same staleness treatment as the Profiles tab, with a reason sentence that names the cause
    (e.g. profile changes applied in the import review).

#### 2c. Chat tab
Max width 1000px. Header kicker `GROUNDED IN` + "9 profiles, 2 job descriptions, your profile" —
the grounding set is always stated. Messages stack with `gap:2px`, each
`border-left:3px solid` (accent for the app, divider for the candidate) and a monospace
`REVERSE SEARCH` / `YOU` speaker label; body 15px/1.6 `max-width:80ch`. Assistant answers end with
citation chips (`.tag .tag-outline`) naming their sources. Thinking state: a
`READING 9 PROFILES…` label above a 3px track with a 25%-wide accent bar sliding via the `rsBar`
keyframe (1.1s linear infinite). Below: `SUGGESTED QUESTIONS` as full-width left-aligned buttons
(`border-left:3px solid var(--color-divider)`, hover → accent border + `var(--color-accent-100)`),
then a `.input` + "Ask" row. Suggested questions are answerable from captured material only.

### 3. Candidate profile (`/candidate-profile`)
`1fr 340px` grid.
- Left: `01 — WHAT WE HOLD` Experience (a `160px 1fr` grid per entry: monospace date range,
  then title heading-800 16px, company · location, description `max-width:78ch`, and a monospace
  `SOURCE — <document>` line: **every field says which document it came from**), then
  "Skills and target criteria" (primary skills as `.tag-accent`, secondary as `.tag-neutral`, and a
  target-criteria key/value table: sectors, comp floor, relocation, deal-breakers). Then
  `02 — ANALYSIS` "How this profile reads" — 3 cards stating how the profile will be received,
  each backed by a count.
- Right rail (`var(--color-surface)`, `padding:24px`): `SOURCE DOCUMENTS` list (name + monospace
  meta, `1px` rules), then an "Add material" dashed box with the reassurance "Nothing is written
  until you review the proposed changes.", a document-type `select`, and a full-width
  "Choose file" primary button.

### 4. Import review (`/candidate-profile` ingest step)
The safety screen. Purpose: nothing is written to the profile without explicit approval.
- Top bar: `← BACK TO CANDIDATE PROFILE`, the note "Leaving without applying changes nothing.",
  and a "Discard import" secondary button.
- Kicker `REVIEW BEFORE WRITING`, h1 36px "7 proposed changes from <filename>", and the rule
  "Additive changes are pre-selected. Conflicts are not: leaving one unchecked keeps what the
  profile already holds."
- **`KNOCK-ON EFFECT` bar** (`border:2px solid var(--color-accent)`): names every downstream
  analysis this import will invalidate, before the candidate commits.
- `ADDITIVE` section — "New information, nothing overwritten", `4 changes`. Each row is a
  `label` with grid `24px 190px 1fr`: checkbox (`accent-color:var(--color-accent)`, 16×16, checked
  by default), monospace field path, then value 15px + description 13px muted.
- `CONFLICTING` — "Checking one overwrites what you have", `3 changes`. Grid
  `24px 190px 1fr 1fr`: unchecked box, field path, then CURRENT (`border-left:2px solid
  var(--color-neutral-400)`, muted text) beside PROPOSED (`border-left:2px solid
  var(--color-accent)`, full-strength text + rationale).
- Footer above a `2px` top rule: a primary button whose label counts the selection
  ("Apply N changes"), "Discard import", and the note "Document is kept either way, under source
  documents." Applying runs the write, then marks the dependent analyses out of date.

### 5. Company list import — mapping (`/companies/import`)
Purpose: read the candidate's own tracker spreadsheet without silently guessing.
- Top bar: `← BACK TO PROJECTS`, "Nothing is imported until you confirm the mapping.", "Cancel
  import".
- h1 36px "Tell us how to read <filename>", with the shape stated plainly: "61 rows, 13 columns.
  Only the company name is required. Everything else either becomes a field on the company, feeds
  the suggestion ranking, or is dropped."
- `01 — WHAT WE READ` "First three rows" — the raw CSV head in a `.table`, horizontally
  scrollable, with "Header row detected" as the right-aligned meta.
- `02 — MAPPING` "Where each column goes", meta "9 mapped automatically · 4 need a decision".
  One row per column: `180px 1fr 260px 150px` grid — monospace column name, a sample-values
  string, a `select` of destinations, and a monospace status: `MATCHED` in
  `var(--color-neutral-600)` or `GUESSED · CONFIRM` in `var(--color-accent-700)`. Guessed mappings
  are visually distinct from confident ones and must be confirmed.
- `03 — HOW IT DRIVES SUGGESTIONS` "Your priority, our read, or both" — two `var(--color-surface)`
  panels of `.radio` groups:
  - `RANK THE SUGGESTION STRIP BY`: my priority column only / my priority first with our fit as
    tiebreak (default) / our fit read only. Below it, a data-quality note ("fit_rating holds 1–5 on
    54 of 61 rows. The seven blanks sort last.").
  - `EXTRA COLUMNS WE DID NOT RECOGNISE`: the unmatched column names as tags, then keep on the
    record unanalysed (default) / fold into notes / drop.
- Footer: "Import 61 companies" primary, "Cancel", and the dedupe promise "5 names already exist
  as projects and will be matched, not duplicated." The import itself runs with no API call and
  reports how many were matched.

### 6. Admin (`/admin`)
Purpose: the candidate can see what the LLM spend bought.
- h1 42px "Where the money went", with a `.seg` period control (7 days / 30 days / All time).
- Stat band, 4 columns, same treatment as the companies list: total · per profile extracted ·
  per action plan · **spent on re-runs** (`var(--color-accent-700)` — re-runs are the waste the
  screen exists to expose).
- `01 — BY COMPANY` "Cost per project", meta "Broken out by the activity that spent it".
  `.table` with right-aligned monospace 13px numeric columns — Profiles · Action plans · Job
  descriptions · Profile updates · Runs (muted) · Total (heading-800 15px).
- `02 — BY ACTIVITY` "What each kind of analysis costs you": 4 cards, each with the amount
  heading-800 26px, a 6px proportion bar (accent for re-run-heavy activities, else
  `var(--color-neutral-900)`), the activity name, and a unit detail line ("22 profiles, 14
  screenshot batches").
- `03 — RECENT RUNS` "Last five calls": `.table` — When (monospace) · Activity · Company ·
  Tokens in / out (monospace, right) · Cost (monospace, right).

---

## Interactions & behavior

| Trigger | Behavior |
| --- | --- |
| Header link click | Route change. `aria-current="page"` on the active link. Candidate profile stays active while on the import-review screen. |
| Projects table row click | Opens that company project on the Profiles tab. |
| Import / Add profiles / Capture shared connections | Starts a run: "Extracting 3 screenshots", ~3.2s, then a done strip "3 profiles added. The cluster analysis is now out of date." with a CTA to the affected view. Profile count increments; cluster analysis becomes stale. |
| Re-run analysis (clusters) | ~4.2s run, then "Clusters rebuilt." naming the score deltas. Clears the stale state. |
| Re-run action plan | Same pattern; clears plan staleness. |
| Apply N changes (import review) | Writes, returns to the candidate profile, and marks the named downstream analyses out of date. |
| Import 61 companies | Returns to the projects list, runs a ~2.2s non-API "Importing company list" pass, done strip reports matched vs. created. |
| Suggested question click | Appends the question as a YOU message, shows the thinking bar ~1.4s, then appends the grounded answer with citation chips. |
| Done strip CTA | Navigates to the route/tab the run changed, and dismisses itself. |
| Run progress | Ticks every 80ms; percentage and elapsed seconds are both shown. |

**Rules to preserve in the real implementation**
1. No destructive write without a review screen listing every change, split additive vs. conflicting.
2. Every model output carries provenance: what it was computed from, and when.
3. Adding material invalidates downstream analysis rather than silently changing it. Stale content
   stays visible, greyed, with the old run's inputs named.
4. Every suggestion states its basis, including low-confidence ones ("Sector adjacency only …
   low confidence") — the app is allowed to say a suggestion is weak.
5. Cost is always visible: month-to-date in the header, an estimate in every run strip.

## State
- `route`: companies | company | candidate | review | mapping | admin
- `tab`: profiles | jobs | chat
- `run`: { label, detail } | null; `runPct`; `runElapsed`
- `done`: { text, cta, route, tab } | null
- `clustersStale`, `planStale`, `planStaleReason` — derived server-side in the real app from
  `analysisRunAt` vs. `profileUpdatedAt` / `candidateProfileUpdatedAt`
- `peopleCount` — captured profiles for the open project
- `thinking` — chat request in flight
- `chat[]`: { who, text, cites[] }
- `additiveChecked[]`, `conflictChecked[]` — import review selection

Data fetching in the real app: the run strip should be driven by the actual streaming/job status
of the API route, not a timer. Costs and token counts come from the API response usage fields.

## Design tokens
From `prototype/_ds/modernist-.../styles.css` — use the variables, not the literals.

- Ground `--color-bg` #f3f2f2 · Card `--color-surface` #eae9e9 · Ink `--color-text` #201e1d
- Accent `--color-accent` #ec3013; hover `--color-accent-600` #dd2b0f; text-on-light
  `--color-accent-700` #ae1800; tint `--color-accent-100` #fff2ef
- Neutrals: 300 #d7d3d3 (bars/placeholders) · 400 #bab6b6 · 600 #7d7979 (monospace labels) ·
  700 #605d5d (meta) · 800 #444141 (body prose) · 900 #2d2b2b (strong bars, dark strips)
- Divider `--color-divider` = `color-mix(in srgb, #201e1d 40%, transparent)`.
  **2px for section and structural rules, 1px for row rules.**
- Type: Archivo everywhere. Headings weight 800. h1 42px / 40px / 36px (`letter-spacing:-0.025em`),
  h3 22px / 20px, body 15px/1.55, secondary 14px, meta 13px, small meta 12px.
- Monospace: `ui-monospace, Menlo, monospace` at 10–12px with `letter-spacing` .1em–.16em for all
  kickers, labels, provenance, dates, and numeric table cells. This is the app's second voice —
  anything machine-derived is set in it.
- Spacing: 4 / 8 / 12 / 16 / 24 / 32. Page padding `44px 40px 80px` (`36px 40px 80px` inside tabs).
  Max width 1320px (1100px on the review screen, 1240px on mapping, 1000px on chat).
- Radius: **0 everywhere.** Never round a corner.
- Grid gaps: card grids use `gap:2px` over a `var(--color-divider)` background so the gap reads as
  a rule.
- Focus: `outline: 2px solid var(--color-accent); outline-offset: 2px` (from the system).

## Assets
None. No photography, no icon files, no avatars — person and logo slots are flat
`var(--color-neutral-300)` squares. If icons are added later, use Lucide (the design system's
choice). Archivo is expected to be available; the fallback is `system-ui`.

## Files
- `prototype/Reverse Search.dc.html` — the full prototype: all six screens, all interactions.
  Markup is inline-styled; the styling values in this README are lifted from it verbatim.
- `prototype/support.js` — prototype runtime only. Ignore.
- `prototype/_ds/modernist-.../styles.css` — the design system tokens and component classes
  (`.btn`, `.tag`, `.input`, `.radio`, `.seg`, `.table`, `.card`, `.hr`). Port these tokens into the
  app rather than re-deriving them.
- `prototype/_ds/modernist-.../readme.md` — the design system's own guide (do/don't rules).
- `CATCHUP.md` — **read this first if you have already implemented an earlier version of these
  screens.** It lists only what changed.
