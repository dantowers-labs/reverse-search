# How this actually works

Short answer, for anyone wondering what's under the hood: mostly it's an LLM reading data you
deliberately captured, not a trained model or a statistical formula. This page draws the line
honestly between the two, because overstating it would undercut the one thing this app is actually
trying to do — give an honest read, not a flattering one.

## The core idea ("birds of a feather")

The premise: the LinkedIn profiles of people who already work somewhere are a real, if imperfect,
signal for whether you'd fit there — closer to their backgrounds and language means a better shot,
independent of whether a specific role is open right now. That's a heuristic, not a law, and the
app is explicit about its own limits (below), not just its findings.

## What's genuinely algorithmic — deterministic, describable, no model involved

- **Company-name matching** (`src/lib/companyNameMatching.ts`): strip legal suffixes (inc/llc/ltd/
  corp), lowercase, strip non-alphanumerics, then a bidirectional prefix check. That's it — it's how
  "Acme" and "Acme Global" get recognized as the same company across a tracker CSV, a LinkedIn
  connections export, and a resume, without a fixed name registry.
- **Person-name matching**: trim, lowercase, collapse whitespace. Used to recognize when a captured
  profile is also a name in your bulk LinkedIn connections export.
- **The "own network" signal**: a plain ratio — if 3+ captured people have a known LinkedIn
  connection-degree badge and more than 70% of them are 1st-degree, the sample is flagged as
  skewed toward people you already know, not a read on the company's actual hiring pattern.
- **Staleness detection**: a straight count comparison (has the number of captured profiles, or the
  candidate profile's own timestamp, moved since an analysis last ran) that decides whether a result
  gets marked out of date.
- **Cost tracking**: `(input_tokens × price_per_token_in) + (output_tokens × price_per_token_out)`,
  logged per API call from the real token counts the model actually returns — not an estimate.

None of this is machine learning. It's string normalization, ratios, and arithmetic — small enough
to read in one sitting, which is deliberate.

## The vector map (optional, off by default)

One genuine exception to "no embeddings" above: an opt-in visualization (toggled in Admin, needs a
`VOYAGE_API_KEY`) that embeds each captured profile's title/headline/about/skills text via Voyage
AI, then projects those vectors to 2D via PCA — computed through the sample's own Gram matrix
(`src/lib/pca.ts`), since there are always far fewer captured profiles than embedding dimensions.
That projection is real, describable linear algebra, not a black box.

What it isn't: a replacement for the fit score, or a second opinion on it. Embedding distance
measures vocabulary overlap in how people describe themselves — it'll happily cluster people who
use similar buzzwords regardless of the more structural distinctions (company stage, career
altitude, pedigree) that actually drive the LLM's alignment/divergence read. Treat it as a
different lens on the same clusters, worth a glance, not a number to trust over the qualitative
read above.

## What's LLM judgment, not math

Role clustering, fit scores (0-100), the alignment/divergence case for each cluster, positioning
gaps, likely-rejection reads, and outreach targeting are all produced by one model call reading the
captured profiles/job posting/candidate data directly — there's no embedding similarity, no trained
classifier, no weighted feature model behind the score. The actual engineering work here is in what
gets fed to the model and what shape it's forced to answer in (a strict output schema — a score, a
one-sentence verdict that has to name specifics, a separate field for the case against, not just
the case for), not in a formula computing the number.

This means two runs of the same analysis can differ slightly, and a fit score is a considered
judgment call, not a repeatable measurement. Treat scores as a strong, structured opinion — worth
taking seriously, not worth treating as ground truth to two decimal places.

## The honest caveats built into the analysis itself

A few real methodological limits are surfaced as part of the output, not hidden:

- **Network-proximity confound**: LinkedIn's own people-search surfaces closer connections first, so
  a captured "sample" of who a company hires is filtered through your own network before any
  analysis happens — and network proximity independently predicts response rate, so the two get
  confounded. The connection-degree ratio above is the app's attempt to make this visible rather
  than pretend a bigger sample is automatically a better one.
- **Supply vs. demand**: captured profiles are who applied and got hired, not necessarily who a
  company wanted most or actively recruits. The confidence note on each analysis calls this out
  explicitly rather than treating a small captured sample as "the company's type."
- **Reverse causality in connections**: a LinkedIn connection formed *during* an active job search
  isn't validated rapport — it's very likely a result of the search itself, not evidence you knew
  someone beforehand. Outreach targeting checks connection dates against when the project was opened
  and says so explicitly when a connection is recent rather than pre-existing.
- **Screener-visible vs. not**: a positioning gap only matters as a rejection explanation if an
  actual resume screen would catch it in ~6 seconds. The app splits gaps into what a skim would see
  versus what only matters once a human is actually evaluating you, rather than treating every gap
  as equally likely to be why an application went nowhere.
