# Reverse Search

A local, single-user tool for researching companies and job postings against
your own candidate profile. It never scrapes or auto-collects anything from
the web — every piece of data in it is something you deliberately captured
(a resume, a screenshot, a pasted job description) and imported yourself.

Every LLM call costs real money (Anthropic API usage). The Admin screen
tracks actual spend per activity so you can see what things cost before
doing them in bulk.

**Wireframes:** [`design/design_handoff_reverse_search_0904/prototype/Reverse Search - wireframes.dc.html`](design/design_handoff_reverse_search_0904/prototype/Reverse%20Search%20-%20wireframes.dc.html)
is a self-contained visual tour of the workflow and five key screens (mock data throughout) — open
it in a browser to see what the app actually does before setting it up.

**How it actually works:** [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md) — what's genuinely
deterministic logic versus what's LLM judgment, and the real methodological caveats built into
the analysis itself.

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or later.
- An [Anthropic API key](https://console.anthropic.com/) — see above re: real cost.

That's it. SQLite (via `better-sqlite3`) and the database schema (via Prisma
migrations) are set up by the install steps below — nothing else to install
separately. `better-sqlite3` ships prebuilt binaries for common platforms, so
`npm install` shouldn't need to compile anything; if it does fall back to
building from source on your setup, you'll need Python 3 and a C++ toolchain
(node-gyp's actual requirements).

## Setup

```bash
npm install
cp .env.example .env   # then paste in your ANTHROPIC_API_KEY
npx prisma migrate dev
npx prisma generate     # if the app errors with "Module not found: .../generated/client",
                         # migrate dev's auto-generate step silently failed — this re-runs it directly
npm run dev
```

The app runs at `http://localhost:5050`.

Hit a snag getting this running, or found a bug? [Open an issue](https://github.com/dantowers-labs/reverse-search/issues).
For anything softer — a question, an idea, just a reaction —
[Discussions](https://github.com/dantowers-labs/reverse-search/discussions) is the friendlier spot.

If you've got Claude Code or Claude.ai handy, pasting a setup error there is usually
the fastest fix — it can see your actual local environment, which I can't from a
GitHub thread. Open an issue or discussion here for anything that turns out to be
a real bug in the app itself, not just a local setup snag.

All research data (SQLite database, uploaded screenshots) lives in
`/data` and `dev.db`, both gitignored — nothing personal is shared by
cloning the repo, but nothing is shared *between* clones either. Each
person who runs this runs their own independent instance and builds up
their own data from scratch.

## The workflow

This app is built around a specific research loop. Roughly, in order:

### 1. Set up your candidate profile

Go to **Candidate profile** and import a resume (PDF or .docx) and,
optionally, a cover letter. You can also export your full LinkedIn data
(Settings → "Get a copy of your data" on LinkedIn) and import the
individual CSVs from that export (e.g. `Profile.csv`, `Positions.csv`) —
pick "LinkedIn export" as the source type when uploading. Each import is
reviewed as a proposed change set before it's applied, so nothing
overwrites your profile silently.

### 2. Import your company list

If you're tracking target companies in a spreadsheet, go to the
**Companies** list and use "Import company list" to bring in a CSV.
A mapping wizard lets you tell it which column is which — no fixed
header names required. You can also just click "New project" to add
one company at a time.

### 3. Capture profiles at a target company

On a company's **Profiles** tab, this is the core research step:

- Search LinkedIn for people at that company in the roles you care about
  (e.g. "solutions consulting," then a second pass for "presales," then
  maybe "solutions architect" — however many search variations surface
  the right people).
- Screenshot the profiles that look relevant and upload them. Use
  **bulk mode** when each screenshot is a different person; use
  **single mode** (multiple files, one person) when you have several
  screenshots of the *same* profile (e.g. scrolled sections). Re-uploading
  someone already captured is caught automatically and skipped rather than
  creating a duplicate.
- Aim for a real sample — 10-20 profiles per company is enough for the
  role-clustering analysis to find real patterns.

At the top of the Profiles tab there's also a **your context** note — free
text for your own history with this company (a prior application, a layoff,
a contact who's gone quiet, an idea about who to approach). It's not
required, but anything you put there is fed into every analysis run for
that company from then on, so it's worth filling in as soon as you know it
rather than losing it later.

### 4. Run the company fit analysis

Once you've captured a handful of profiles, click **Analyze** on the
Profiles tab. This clusters the captured people into role groups, scores
how closely each cluster's background resembles your own, and rolls up an
overall verdict for the company — plus an honest confidence note on
whether the sample is big enough to trust yet. The first run also seeds
the company's **Chat** tab with an opening take, and you can keep chatting
from there, grounded in everything captured so far.

### 5. Capture shared/mutual connections (optional, but improves outreach)

Still on the Profiles tab: for any captured person, LinkedIn shows an
"X mutual connections" panel on their profile. Screenshot that panel
and upload it as a shared-connections capture for that person. This is
what lets the job-fit analysis later rank outreach targets by *actual
reachability* (a warm path through someone you know) instead of by
cluster fit alone. LinkedIn only shows 5 mutuals per screenshot, so you
can upload more than one for the same person and they'll be merged.

### 6. Suggestions — "worth opening a project for"

Once you've analyzed at least two companies, the dashboard's **DO NEXT**
section starts suggesting other companies from your tracker that
structurally resemble a confirmed fit (or mismatch) pattern, or where you
already have a direct connection. Each suggestion can be **promoted**
(opens it as a real project) or **dismissed** — and either way, you can
leave your own note on it first ("great match, but I already got screened
out here" or "worth a shot, but here's the wrinkle"). A note survives a
dismiss (so the engine won't just re-flag the same situation blindly next
time) and carries forward automatically into the company's own context
note if you promote it.

### 7. Import a job posting and run the fit analysis

On the company's **Jobs** tab, paste the full text of a posting you're
interested in. Once it's imported, run the analysis — it produces a fit
score, resume-positioning gaps, ranked outreach targets, draft outreach
messages (a direct-tone version always, plus a more personal version when
there's a real warm connection to ground it in), and a separate
cold-outreach template addressed to "[Hiring Manager Name]" for when you
track down who that actually is yourself — the app doesn't guess who's hiring,
it just gives you something worth sending once you know. "Analyze all"
on this tab runs every not-yet-analyzed posting in one go, with a real
cost estimate shown first.

### 8. Track interviews

Once a process actually starts, the company's **Interviews** tab shows one
timeline across every thread at that company, newest first — each round,
each opportunity opening, and any free-text contact touchpoint you log
(a reply from a hiring manager, a referral conversation) all on the same
spine, with a NEXT entry at the top for whichever thread is still open.
Click a round to get its own page: prep guide (likely focus areas,
anticipated questions, stories to prepare, questions to ask them) grounded
in that interviewer's real captured profile when you have one, across a
four-tab layout. Notes you leave after a round feed into the next round's
guide automatically, so prep compounds instead of starting cold each time —
and optionally into guides for *other* interview threads at the same
company too. A thread (tied to a job posting, or standalone if you're in
early conversations before a real posting exists) gets a disposition
(offer, declined, passed over, whatever actually happened) once it
resolves; nothing stops you from starting a second, independent thread
later if the situation changes.

### 9. Your LinkedIn connections (Connections page)

Separately from the per-company screenshot capture above, you can
import your *entire* first-degree network in one shot: on LinkedIn,
export "Connections" specifically (not the full data export — it's its
own download, a plain list of everyone you're connected to) and import
that CSV on the **Connections** page. Two views, behind a segmented
control:

- **By company** — the companies you're actively analyzing come first
  as their own group (including "no connections here yet" when a
  project has none), followed by your top 18 other companies by raw
  connection volume. Click a company to expand its people in place.
- **By person** — a filterable, sortable table (name / company /
  title, each with its own "contains" filter), defaulting to "at an
  analyzed company" only, since the vast majority of a real network
  isn't at a company you're tracking. Rows at an analyzed company carry
  a faint tint and a tooltip naming it.

Below both views: "DO NEXT" opportunity suggestions — companies in
your tracker where you already have a first-degree connection, even if
you haven't captured that person's profile yet, with a button to open
it as a project.

Matching is name-based and fuzzy (e.g. it'll catch "Databricks" whether
your tracker or your connections list spells it slightly differently),
so double-check a match before treating it as a real warm path. The
same matching feeds a live connection count on each company's header
and on its row in the dashboard's companies table — both link straight
into the Connections page, scoped to that company.

### 10. Admin

The **Admin** page shows real spend, broken down by activity (profile
extraction, cluster analysis, job-fit analysis, interview-guide
generation, ...) and by company — pulled from actual API usage, not an
estimate. Bulk actions (like "Analyze all" job postings) show a cost
estimate based on this real history before you confirm.

## What this app deliberately doesn't do

No web search, no scraping, no background data collection. If it's not
something you uploaded or pasted in yourself, the app doesn't know about
it. This is intentional — it keeps the data trustworthy and the cost
shape predictable.

## License

[GNU AGPL v3](LICENSE). Commercial use and modification are fine; if you
deploy a modified — or unmodified — version as a network service, its
full source has to be published under the same license.
