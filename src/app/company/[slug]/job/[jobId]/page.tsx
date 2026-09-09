"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card, CardGrid } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { Avatar } from "@/components/ui/Avatar";
import { StaleBanner } from "@/components/ui/StaleBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Segmented } from "@/components/ui/Radio";
import { getPersonDisplayName } from "@/lib/personDisplay";
import { getPlanStaleness } from "@/lib/staleness";
import { getScoreInk } from "@/lib/scoreInk";
import { splitFirstParagraph } from "@/lib/splitFirstParagraph";
import { useRunStatus } from "@/lib/runStatus/RunStatusContext";

interface OutreachTarget {
  targetType: string;
  reasoning: string;
  warmPath: boolean;
  targetPersonId: number | null;
}

interface OutreachVariant {
  tone: "direct" | "personal";
  message: string;
}

interface OutreachDraft {
  variants: OutreachVariant[];
}

const TONE_LABELS: Record<OutreachVariant["tone"], string> = { direct: "Direct", personal: "Personal" };

function normalizeOutreachMessages(raw: unknown): OutreachDraft[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) =>
    typeof entry === "string" ? { variants: [{ tone: "direct", message: entry }] } : (entry as OutreachDraft),
  );
}

interface PositioningGap {
  gap: string;
  screenerVisible: boolean;
}

// Analyses saved before the screener-visibility split existed stored
// positioningGaps as a flat string[] — normalize both shapes so old rows
// render (all treated as screener-visible, the safer default) without
// needing a re-run.
function normalizePositioningGaps(raw: unknown): PositioningGap[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => (typeof entry === "string" ? { gap: entry, screenerVisible: true } : (entry as PositioningGap)));
}

interface AnalysisRow {
  id: number;
  createdAt: string;
  fitScore: number;
  verdict: string;
  functionTypeAssessment: string;
  likelyRejectionReason: string;
  positioningGapsJson: string;
  outreachTargetsJson: string;
  outreachMessagesJson: string;
  coldOutreachToHiringManager: string;
  resumeEditsJson: string;
  skillsToAcquireJson: string;
  personCountAtRun: number;
  candidateProfileUpdatedAt: string;
}

interface JobPostingDetail {
  id: number;
  title: string;
  seniority: string;
  functionType: string;
  applicationStatus: string | null;
  company: { slug: string; name: string };
  analyses: AnalysisRow[];
}

interface PersonRow {
  id: number;
  mergedName: string | null;
  mergedTitle: string | null;
  mergedHeadline: string | null;
}

export default function JobDetailPage({ params }: PageProps<"/company/[slug]/job/[jobId]">) {
  const { slug, jobId } = use(params);
  const router = useRouter();
  const { start, complete, fail } = useRunStatus();
  const [jobPosting, setJobPosting] = useState<JobPostingDetail | null>(null);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [candidateProfileUpdatedAt, setCandidateProfileUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedTone, setSelectedTone] = useState<Record<number, OutreachVariant["tone"]>>({});
  const [showFullAssessment, setShowFullAssessment] = useState(false);
  const [costEstimate, setCostEstimate] = useState<number | null>(null);

  async function refresh() {
    const data = await fetch(`/api/job-postings/${jobId}`).then((r) => r.json());
    const jp: JobPostingDetail | null = data.jobPosting ?? null;
    setJobPosting(jp);
    if (jp) {
      const { companies } = await fetch("/api/companies").then((r) => r.json());
      const company = companies.find((c: { slug: string }) => c.slug === slug);
      const [peopleRes, profileRes] = await Promise.all([
        company ? fetch(`/api/companies/${company.id}/people`).then((r) => r.json()) : Promise.resolve({ people: [] }),
        fetch(`/api/candidate-profile`).then((r) => r.json()),
      ]);
      setPeople(peopleRes.people ?? []);
      setCandidateProfileUpdatedAt(profileRes.profile?.updatedAt ?? null);
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- plain fetch-on-mount, no compiler/Suspense boundary in use
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    if (jobPosting && jobPosting.analyses.length === 0) {
      fetch("/api/admin/activity-cost?activity=analyzeJobFit")
        .then((r) => r.json())
        .then((d) => setCostEstimate(d.averageCost ?? null));
    }
  }, [jobPosting]);

  async function analyze() {
    if (!jobPosting) return;
    const runId = start("analyzeJobFit", "Assessing role fit", `${jobPosting.company.name} · drafting outreach`);
    const res = await fetch(`/api/job-postings/${jobId}/analyze`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) fail(runId, data.error ?? "Analysis failed");
    else complete(runId, "Role-fit analysis complete.");
    await refresh();
  }

  async function deletePosting() {
    if (!confirm("Delete this job posting and its analysis?")) return;
    setBusy(true);
    await fetch(`/api/job-postings/${jobId}`, { method: "DELETE" });
    setBusy(false);
    router.push(`/company/${slug}/jobs`);
  }

  if (loading) return null;

  if (!jobPosting) {
    return (
      <div className="px-10 pt-9 pb-20 max-w-[1320px] w-full">
        <EmptyState title="Job posting not found" />
      </div>
    );
  }

  const analysis = jobPosting.analyses[0] ?? null;
  const peopleById = new Map(people.map((p) => [p.id, p]));

  const positioningGaps: PositioningGap[] = analysis ? normalizePositioningGaps(JSON.parse(analysis.positioningGapsJson)) : [];
  const screenerVisibleGaps = positioningGaps.filter((g) => g.screenerVisible);
  const interviewPrepGaps = positioningGaps.filter((g) => !g.screenerVisible);
  const outreachTargets: OutreachTarget[] = analysis ? JSON.parse(analysis.outreachTargetsJson) : [];
  const outreachMessages: OutreachDraft[] = analysis ? normalizeOutreachMessages(JSON.parse(analysis.outreachMessagesJson)) : [];
  const resumeEdits: { suggestion: string; targetField: string }[] = analysis ? JSON.parse(analysis.resumeEditsJson) : [];
  const skillsToAcquire: { title: string; rationale: string }[] = analysis ? JSON.parse(analysis.skillsToAcquireJson) : [];

  const planStaleness = analysis
    ? getPlanStaleness(analysis.personCountAtRun, people.length, analysis.candidateProfileUpdatedAt, candidateProfileUpdatedAt)
    : { stale: false, reason: "" };

  const assessment = analysis ? splitFirstParagraph(analysis.functionTypeAssessment) : null;

  return (
    <div className="px-10 pt-9 pb-20 max-w-[1320px] w-full">
      <Link href={`/company/${slug}/jobs`} className="font-mono text-[11px] tracking-[0.1em] no-underline text-text">
        ← BACK TO JOB DESCRIPTIONS
      </Link>

      <div className="flex items-end gap-5 mt-4 mb-3">
        <div>
          <h1 className="text-[40px] m-0 mb-1.5 leading-tight tracking-tight">{jobPosting.title}</h1>
          <div className="text-sm">{analysis ? analysis.verdict : ""}</div>
          <div className="text-xs text-neutral-700 mt-1">
            {jobPosting.seniority} · {jobPosting.functionType}
            {jobPosting.applicationStatus ? ` · ${jobPosting.applicationStatus}` : ""}
          </div>
        </div>
        <div className="ml-auto text-right flex items-center gap-3">
          <button
            onClick={deletePosting}
            disabled={busy}
            className="text-[11px] text-accent-700 bg-transparent border-0 cursor-pointer disabled:opacity-40 p-0"
          >
            Delete
          </button>
          {analysis ? (
            <div className="font-heading font-extrabold text-[76px] leading-none" style={{ color: getScoreInk(analysis.fitScore) }}>
              {analysis.fitScore}
            </div>
          ) : (
            <div className="font-mono text-[13px] tracking-[0.1em] text-neutral-600">NOT SCORED</div>
          )}
        </div>
      </div>

      {!analysis ? (
        <>
          <SectionHeader eyebrow="03 — DO NEXT · NEVER ANALYZED" title="This posting hasn't been scored yet" />
          <Card className="border border-divider">
            <p className="text-sm m-0 mb-3.5">
              Run the role-fit analysis to get a score, resume-positioning gaps, outreach targets, and draft messages for this posting.
              {costEstimate != null && ` Estimated cost: ~$${costEstimate.toFixed(2)}.`}
            </p>
            <Button variant="primary" onClick={analyze}>
              Analyze
            </Button>
          </Card>
        </>
      ) : (
        <>
          <SectionHeader eyebrow="02 — ANALYSIS" title="How your profile reads against this posting" />
          {people.length === 0 && (
            <div className="mb-3">
              <StaleBanner
                label="TIP"
                reason="No profiles captured yet — this read is posting-only. Capture a few people at this company for a sharper one."
                action={
                  <Link href={`/company/${slug}/profiles`}>
                    <Button variant="primary">Go to Profiles</Button>
                  </Link>
                }
              />
            </div>
          )}
          <CardGrid columns={2} className="mb-11">
            <Card>
              <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-2.5">FUNCTION-TYPE ASSESSMENT</div>
              <p className="text-[15px] leading-relaxed m-0 mb-4 max-w-[74ch]">
                {assessment?.first}
                {assessment?.rest && !showFullAssessment && (
                  <button
                    onClick={() => setShowFullAssessment(true)}
                    className="ml-1.5 text-xs text-accent-700 underline decoration-dotted bg-transparent border-0 cursor-pointer p-0"
                  >
                    Read the full assessment
                  </button>
                )}
                {assessment?.rest && showFullAssessment && <span> {assessment.rest}</span>}
              </p>
              <div className="border-t border-divider pt-3.5">
                <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-2">LIKELY REJECTION REASON</div>
                <p className="text-sm leading-relaxed m-0 max-w-[74ch]">{analysis.likelyRejectionReason}</p>
              </div>
            </Card>
            <Card>
              <div className="flex items-baseline gap-2.5 pb-2.5 mb-3.5 border-b border-divider">
                <span className="font-mono text-[10px] tracking-[0.14em] text-neutral-600">OUTREACH TARGETS</span>
                <Link href={`/company/${slug}/profiles`} className="font-mono text-[10px] tracking-[0.08em] ml-auto text-text no-underline">
                  FROM PROFILES TAB ↗
                </Link>
              </div>
              <div className="flex flex-col gap-3">
                {outreachTargets.map((t, i) => {
                  const person = t.targetPersonId != null ? peopleById.get(t.targetPersonId) : null;
                  return (
                    <div key={i} className="flex gap-3 items-start border-b border-divider pb-3 last:border-b-0 last:pb-0">
                      <Avatar name={person?.mergedName ?? null} size={30} />
                      <div>
                        <div className="font-heading font-extrabold text-sm">{person ? getPersonDisplayName(person) : t.targetType}</div>
                        <div className="text-xs text-neutral-700">{person?.mergedHeadline ?? person?.mergedTitle ?? t.reasoning}</div>
                        <div className="mt-1.5 flex gap-1.5">
                          {t.warmPath && <Tag variant="accent">warm path</Tag>}
                          {t.targetPersonId != null && !person?.mergedName && <Tag variant="neutral">name not captured</Tag>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {outreachTargets.length === 0 && <p className="text-xs text-neutral-600 m-0">No outreach targets yet.</p>}
              </div>
            </Card>
          </CardGrid>

          <SectionHeader eyebrow="03 — DO NEXT" title="Action plan" />

          {planStaleness.stale && (
            <StaleBanner reason={planStaleness.reason} action={<Button variant="primary" onClick={analyze}>Re-run action plan</Button>} />
          )}
          {!planStaleness.stale && (
            <div className="mb-3">
              <Button variant="secondary" onClick={analyze}>
                Re-analyze
              </Button>
            </div>
          )}

          <div className={`pt-2 ${planStaleness.stale ? "grayscale opacity-40" : ""}`}>
            <CardGrid columns={2}>
              <Card>
                <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-3.5">RANKED GAPS</div>
                {screenerVisibleGaps.length > 0 && (
                  <div className="flex flex-col gap-3 mb-4">
                    <div className="font-mono text-[9px] tracking-[0.1em] text-accent-700">WOULD SHOW ON A RESUME SCREEN</div>
                    {screenerVisibleGaps.map((g, i) => (
                      <div key={i} className="flex gap-3 items-baseline">
                        <span className="font-heading font-extrabold text-accent text-[13px]">{String(i + 1).padStart(2, "0")}</span>
                        <span className="text-sm leading-relaxed">{g.gap}</span>
                      </div>
                    ))}
                  </div>
                )}
                {interviewPrepGaps.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="font-mono text-[9px] tracking-[0.1em] text-neutral-600">MATTERS LATER, IN THE ROOM</div>
                    {interviewPrepGaps.map((g, i) => (
                      <div key={i} className="flex gap-3 items-baseline">
                        <span className="font-heading font-extrabold text-neutral-500 text-[13px]">{String(i + 1).padStart(2, "0")}</span>
                        <span className="text-sm leading-relaxed">{g.gap}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-3.5">RESUME EDITS</div>
                <div className="flex flex-col gap-2.5">
                  {resumeEdits.map((edit, i) => (
                    <div key={i} className="border-l-2 border-accent pl-3">
                      <div className="text-sm leading-relaxed">{edit.suggestion}</div>
                      <div className="font-mono text-[11px] text-neutral-600 mt-1">{edit.targetField}</div>
                    </div>
                  ))}
                  {resumeEdits.length === 0 && <p className="text-xs text-neutral-600 m-0">Re-run analysis to get resume edits for this posting.</p>}
                </div>
              </Card>

              <Card className="col-span-2">
                <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 pb-2.5 mb-3.5 border-b border-divider">OUTREACH DRAFTS</div>
                <div className="flex flex-col gap-5">
                  {outreachMessages.map((draft, i) => {
                    const target = outreachTargets[i];
                    const targetPerson = target?.targetPersonId != null ? peopleById.get(target.targetPersonId) : null;
                    const targetLabel = targetPerson ? getPersonDisplayName(targetPerson) : (target?.targetType ?? `Target ${i + 1}`);
                    const defaultTone = draft.variants.find((v) => v.tone === "personal") ? "personal" : "direct";
                    const activeTone = selectedTone[i] ?? defaultTone;
                    const activeVariant = draft.variants.find((v) => v.tone === activeTone) ?? draft.variants[0];
                    return (
                      <div key={i}>
                        <div className="flex items-center gap-2.5 mb-2">
                          <span className="font-mono text-[10px] tracking-[0.1em] text-neutral-600">DRAFT · {targetLabel.toUpperCase()}</span>
                          <span className="font-mono text-[10px] tracking-[0.05em] text-neutral-600">
                            {target?.warmPath ? "GROUNDED IN A WARM PATH" : "NO WARM PATH USED"}
                          </span>
                          {draft.variants.length > 1 && (
                            <Segmented
                              options={draft.variants.map((v) => ({ value: v.tone, label: TONE_LABELS[v.tone] }))}
                              value={activeTone}
                              onChange={(tone) => setSelectedTone((s) => ({ ...s, [i]: tone }))}
                            />
                          )}
                        </div>
                        <p className="text-sm leading-relaxed m-0 mb-2 bg-bg p-3.5 border border-divider">{activeVariant.message}</p>
                        <Button variant="secondary" onClick={() => navigator.clipboard.writeText(activeVariant.message)}>
                          Copy
                        </Button>
                      </div>
                    );
                  })}
                  {outreachMessages.length === 0 && <p className="text-xs text-neutral-600 m-0">No drafts yet.</p>}
                </div>
              </Card>

              <Card className="col-span-2">
                <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 pb-2.5 mb-3.5 border-b border-divider">
                  COLD OUTREACH — ONCE YOU IDENTIFY THE HIRING MANAGER
                </div>
                {analysis.coldOutreachToHiringManager ? (
                  <>
                    <p className="text-sm leading-relaxed m-0 mb-2 bg-bg p-3.5 border border-divider max-w-[74ch]">{analysis.coldOutreachToHiringManager}</p>
                    <Button variant="secondary" onClick={() => navigator.clipboard.writeText(analysis.coldOutreachToHiringManager)}>
                      Copy
                    </Button>
                  </>
                ) : (
                  <p className="text-xs text-neutral-600 m-0">Re-run analysis to get this for this posting.</p>
                )}
              </Card>

              <Card className="col-span-2">
                <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-3.5">SKILLS AND EXPERIENCE TO ACQUIRE</div>
                <div className="grid grid-cols-3 gap-5">
                  {skillsToAcquire.map((s, i) => (
                    <div key={i}>
                      <div className="font-heading font-extrabold text-sm mb-1">{s.title}</div>
                      <p className="text-[13px] m-0 text-neutral-800">{s.rationale}</p>
                    </div>
                  ))}
                  {skillsToAcquire.length === 0 && <p className="text-xs text-neutral-600 m-0">Re-run analysis to get this for this posting.</p>}
                </div>
              </Card>
            </CardGrid>
          </div>
        </>
      )}
    </div>
  );
}
