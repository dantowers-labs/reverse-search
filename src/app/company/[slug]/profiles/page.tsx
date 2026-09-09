"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { CardGrid, Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { Avatar } from "@/components/ui/Avatar";
import { StaleBanner } from "@/components/ui/StaleBanner";
import { ScoreBadge } from "@/components/ui/FitBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { DashedUploadCard } from "@/components/ui/DashedUploadCard";
import { Textarea } from "@/components/ui/Field";
import { getPersonDisplayName } from "@/lib/personDisplay";
import { getClusterStaleness } from "@/lib/staleness";
import { getScoreInk } from "@/lib/scoreInk";
import { normalizeCompanyName, isLooseCompanyMatch } from "@/lib/companyNameMatching";
import { useRunStatus } from "@/lib/runStatus/RunStatusContext";

interface PersonRow {
  id: number;
  mergedName: string | null;
  mergedTitle: string | null;
  mergedHeadline: string | null;
  companyTenureStartDate: string | null;
  connectionDegree: string | null;
  priorEmployersJson: string | null;
  isKnownConnection: boolean;
  images: { id: number }[];
  sharedConnectionsJson: string | null;
}

interface RoleCluster {
  id: number;
  clusterLabel: string;
  aggregateSummary: string;
  fitScore: number;
  fitVerdict: string;
  memberPersonProfileIdsJson: string;
}

interface AnalysisRunRow {
  id: number;
  personCountAtRun: number;
  clusters: RoleCluster[];
}

export default function ProfilesTab({ params }: PageProps<"/company/[slug]/profiles">) {
  const { slug } = use(params);
  const { start, complete, fail } = useRunStatus();
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [runs, setRuns] = useState<AnalysisRunRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [detailMessage, setDetailMessage] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [candidateEmployers, setCandidateEmployers] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const { companies } = await fetch("/api/companies").then((r) => r.json());
    const company = companies.find((c: { slug: string }) => c.slug === slug);
    if (!company) return;
    setCompanyId(company.id);
    setCompanyName(company.name);
    setNotesDraft(company.researchNotes ?? "");
    const [peopleRes, analyzeRes, candidateRes] = await Promise.all([
      fetch(`/api/companies/${company.id}/people`).then((r) => r.json()),
      fetch(`/api/companies/${company.id}/analyze`).then((r) => r.json()),
      fetch(`/api/candidate-profile`).then((r) => r.json()),
    ]);
    setPeople(peopleRes.people ?? []);
    setRuns(analyzeRes.runs ?? []);
    const experience: { company: string }[] = candidateRes.profile?.data?.experience ?? [];
    setCandidateEmployers(experience.map((e) => normalizeCompanyName(e.company)).filter((n: string) => n.length >= 3));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- plain fetch-on-mount, no compiler/Suspense boundary in use
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function saveResearchNotes() {
    if (!companyId) return;
    setBusy(true);
    await fetch(`/api/companies/${companyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ researchNotes: notesDraft }),
    });
    setBusy(false);
    await refresh();
  }

  async function addPerson(e: React.ChangeEvent<HTMLInputElement>) {
    if (!companyId || !e.target.files?.length) return;
    const runId = start("extractPerson", "Extracting screenshot(s)", `${companyName} · vision extraction`);
    const form = new FormData();
    for (const file of Array.from(e.target.files)) form.append("files", file);
    const res = await fetch(`/api/companies/${companyId}/people`, { method: "POST", body: form });
    const data = await res.json();
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!res.ok) fail(runId, data.error ?? "Extraction failed");
    else complete(runId, "Person added. The cluster analysis may now be out of date.");
    await refresh();
  }

  async function addPeopleBulk(e: React.ChangeEvent<HTMLInputElement>) {
    if (!companyId || !e.target.files?.length) return;
    const count = e.target.files.length;
    const runId = start("extractPeopleBulk", `Extracting ${count} profile(s)`, `${companyName} · vision extraction`);
    const form = new FormData();
    form.append("mode", "bulk");
    for (const file of Array.from(e.target.files)) form.append("files", file);
    const res = await fetch(`/api/companies/${companyId}/people`, { method: "POST", body: form });
    const data = await res.json();
    if (bulkFileInputRef.current) bulkFileInputRef.current.value = "";
    if (!res.ok) {
      fail(runId, data.error ?? "Extraction failed");
    } else {
      const failed = data.errors?.length ?? 0;
      const dupes = data.duplicates?.length ?? 0;
      complete(runId, `Added ${data.personIds.length} of ${count} people.`);
      const notes: string[] = [];
      if (dupes > 0) {
        notes.push(`${dupes} already captured, skipped: ${data.duplicates.map((d: { name: string }) => d.name).join(", ")}`);
      }
      if (failed > 0) {
        notes.push(`${failed} failed: ${data.errors.map((e2: { name: string }) => e2.name).join(", ")}`);
      }
      setDetailMessage(notes.length > 0 ? notes.join(" · ") : null);
    }
    await refresh();
  }

  async function deletePerson(personId: number) {
    if (!companyId) return;
    if (!confirm("Delete this person and their captured screenshot(s)?")) return;
    setBusy(true);
    await fetch(`/api/companies/${companyId}/people/${personId}`, { method: "DELETE" });
    setBusy(false);
    await refresh();
  }

  async function addSharedConnections(personId: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    const runId = start("captureSharedConnections", "Extracting mutual connections");
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/companies/${companyId}/people/${personId}/shared-connections`, {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    e.target.value = "";
    if (!res.ok) fail(runId, data.error ?? "Failed");
    else complete(runId, `${data.connections.length} mutual connection(s) captured.`);
    await refresh();
  }

  async function removeSharedConnections(personId: number) {
    if (!companyId) return;
    if (!confirm("Remove the shared-connections capture from this person?")) return;
    await fetch(`/api/companies/${companyId}/people/${personId}/shared-connections`, { method: "DELETE" });
    await refresh();
  }

  async function clearAllPeople() {
    if (!companyId) return;
    if (!confirm(`Delete all ${people.length} people, and any analysis/chat run against them, for ${companyName}? This can't be undone.`)) return;
    setBusy(true);
    await fetch(`/api/companies/${companyId}/people`, { method: "DELETE" });
    setBusy(false);
    await refresh();
  }

  async function runAnalysis() {
    if (!companyId) return;
    const runId = start("analyzeCompany", latestRun ? "Re-clustering profiles" : "Clustering profiles", `${companyName} · ${people.length} profiles`);
    const res = await fetch(`/api/companies/${companyId}/analyze`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) fail(runId, data.error ?? "Analysis failed");
    else complete(runId, "Cluster analysis complete.");
    await refresh();
  }

  const latestRun = runs[0] ?? null;
  const staleness = latestRun ? getClusterStaleness(latestRun.personCountAtRun, people.length) : { stale: false, reason: "" };

  // Computed, not model-generated — a bigger sample isn't a better sample if
  // it's still all people you already know. LinkedIn's own company-people
  // browsing surfaces closer-network people first, so this is a real, honest
  // "have I gone beyond my own network" signal, not just a capture count.
  const DEGREE_ORDER = ["1st", "2nd", "3rd"];
  const degreeCounts = new Map<string, number>();
  for (const p of people) {
    if (!p.connectionDegree) continue;
    degreeCounts.set(p.connectionDegree, (degreeCounts.get(p.connectionDegree) ?? 0) + 1);
  }
  const knownDegreeCount = Array.from(degreeCounts.values()).reduce((a, b) => a + b, 0);
  const firstDegreeCount = degreeCounts.get("1st") ?? 0;
  const skewsToOwnNetwork = knownDegreeCount >= 3 && firstDegreeCount / knownDegreeCount > 0.7;
  const degreeSummary =
    knownDegreeCount > 0
      ? [...DEGREE_ORDER, ...Array.from(degreeCounts.keys()).filter((k) => !DEGREE_ORDER.includes(k))]
          .filter((k) => degreeCounts.has(k))
          .map((k) => `${degreeCounts.get(k)} ${k}`)
          .join(" · ")
      : null;

  const sharedEmployerCount = people.filter((p) => {
    const priorEmployers: string[] = p.priorEmployersJson ? JSON.parse(p.priorEmployersJson) : [];
    const normalized = priorEmployers.map(normalizeCompanyName);
    return normalized.some((e) => candidateEmployers.some((ce) => isLooseCompanyMatch(e, ce)));
  }).length;
  const knownConnectionCount = people.filter((p) => p.isKnownConnection).length;

  // Per-person, per design doc: a strong cluster fit with no mutuals captured
  // for THIS person specifically is worth a nudge to go grab their connections.
  // Accent (not cool) deliberately — this is a "go do something" prompt, not a
  // fact about the person, and cool is already spoken for by the known-connection star.
  const clusterFitScoreByPersonId = new Map<number, number>();
  if (latestRun) {
    for (const cl of latestRun.clusters) {
      const memberIds: number[] = JSON.parse(cl.memberPersonProfileIdsJson);
      for (const id of memberIds) {
        const existing = clusterFitScoreByPersonId.get(id);
        if (existing === undefined || cl.fitScore > existing) clusterFitScoreByPersonId.set(id, cl.fitScore);
      }
    }
  }
  const strongUnsupportedCount = people.filter((p) => {
    const fitScore = clusterFitScoreByPersonId.get(p.id);
    if (fitScore === undefined || fitScore < 75) return false;
    const connections: { name: string; headline: string | null }[] | null = p.sharedConnectionsJson
      ? JSON.parse(p.sharedConnectionsJson)
      : null;
    return !connections || connections.length === 0;
  }).length;

  const insights: { title: string; description: string }[] = [];
  if (latestRun) {
    for (const cl of latestRun.clusters) {
      const memberIds: number[] = JSON.parse(cl.memberPersonProfileIdsJson);
      if (memberIds.length < 4) {
        insights.push({
          title: `${cl.clusterLabel} is thin at ${memberIds.length} ${memberIds.length === 1 ? "person" : "people"}`,
          description: `${memberIds.length} ${memberIds.length === 1 ? "profile is" : "profiles is"} not enough to trust a cluster score — treat the ${cl.fitScore} as provisional until there are more.`,
        });
      }
    }
  }
  if (people.length > 0 && people.every((p) => !p.sharedConnectionsJson)) {
    insights.push({
      title: "No shared-connections capture yet",
      description: "Outreach targets in a job-description action plan are ranked by cluster fit alone. A shared-connections screenshot would let it rank by reachability instead.",
    });
  }

  return (
    <div className="px-10 pt-9 pb-20 max-w-[1320px] w-full">
      <Card tone="captured" className="mb-8">
        <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-2.5">YOUR CONTEXT</div>
        <Textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          placeholder="Your own history with this company — prior applications, contacts, timing, anything worth an analysis knowing about."
          rows={3}
          className="mb-2"
        />
        <Button variant="secondary" onClick={saveResearchNotes} disabled={busy}>
          Save
        </Button>
      </Card>

      <SectionHeader eyebrow="01 — CAPTURED" title={`People at ${companyName || slug}`} meta={`${people.length} people captured`} />

      {degreeSummary && (
        <p className={`font-mono text-[11px] mb-2 -mt-2 ${skewsToOwnNetwork ? "text-accent-700" : "text-neutral-600"}`}>
          {degreeSummary}
          {skewsToOwnNetwork
            ? " — mostly your own network. Worth going further out before trusting this pattern."
            : " — a real mix beyond your own network."}
        </p>
      )}

      {knownConnectionCount > 0 && (
        <p className="font-mono text-[11px] text-cool mb-2">
          <span className="mr-1">★</span>
          {knownConnectionCount} {knownConnectionCount === 1 ? "person" : "people"} here {knownConnectionCount === 1 ? "is" : "are"} already a 1st-degree LinkedIn connection of yours.
        </p>
      )}

      {sharedEmployerCount > 0 && (
        <p className="font-mono text-[11px] text-neutral-600 mb-2">
          {sharedEmployerCount} {sharedEmployerCount === 1 ? "person" : "people"} here {sharedEmployerCount === 1 ? "shares" : "share"} an employer with you — tagged &quot;SAME EMPLOYER&quot; below, easy to miss reading prose.
        </p>
      )}

      {strongUnsupportedCount > 0 && (
        <p className="font-mono text-[11px] text-accent-700 mb-4">
          <span className="mr-1">★</span>
          {strongUnsupportedCount} {strongUnsupportedCount === 1 ? "person sits" : "people sit"} in a strong cluster with no mutuals captured yet — go grab shared connections for a stronger read.
        </p>
      )}

      <CardGrid columns={4} className="mb-5">
        {people.map((p) => {
          const connections: { name: string; headline: string | null }[] | null = p.sharedConnectionsJson
            ? JSON.parse(p.sharedConnectionsJson)
            : null;
          const priorEmployers: string[] = p.priorEmployersJson ? JSON.parse(p.priorEmployersJson) : [];
          const sharedEmployer = priorEmployers.find((e) =>
            candidateEmployers.some((ce) => isLooseCompanyMatch(normalizeCompanyName(e), ce)),
          );
          const clusterFitScore = clusterFitScoreByPersonId.get(p.id);
          const hasStrongUnsupportedCluster =
            clusterFitScore !== undefined && clusterFitScore >= 75 && (!connections || connections.length === 0);
          return (
            <Card key={p.id} tone="captured">
              <div className="flex items-start gap-2.5 mb-2.5">
                <Avatar name={p.mergedName} />
                <div className="flex-1">
                  <div className="font-heading font-extrabold text-sm leading-tight">
                    {getPersonDisplayName(p)}
                    {p.isKnownConnection && (
                      <span title="You're already a 1st-degree LinkedIn connection of this person" className="text-cool ml-1">
                        ★
                      </span>
                    )}
                    {hasStrongUnsupportedCluster && (
                      <span
                        title="This person sits in a strong cluster with no mutuals captured — go grab shared connections."
                        className="text-accent ml-1"
                      >
                        ★
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-700 leading-snug">{p.mergedHeadline ?? p.mergedTitle}</div>
                  {(p.companyTenureStartDate || p.connectionDegree) && (
                    <div className="font-mono text-[10px] text-neutral-600 mt-1">
                      {p.companyTenureStartDate &&
                        `here since ${new Date(p.companyTenureStartDate).toLocaleDateString(undefined, { year: "numeric", month: "short" })}`}
                      {p.companyTenureStartDate && p.connectionDegree && " · "}
                      {p.connectionDegree && `${p.connectionDegree} degree`}
                    </div>
                  )}
                </div>
                <button onClick={() => deletePerson(p.id)} disabled={busy} className="text-[11px] text-accent-700 bg-transparent border-0 cursor-pointer disabled:opacity-40">
                  Delete
                </button>
              </div>
              <div className="font-mono text-[10px] text-neutral-600 border-t border-divider pt-2 flex items-center gap-1.5 flex-wrap">
                {p.images.length} image(s)
                {sharedEmployer && <Tag variant="neutral" title={`You both worked at ${sharedEmployer}`}>SAME EMPLOYER</Tag>}
                {connections && (
                  <>
                    <Tag variant="accent">{connections.length} mutual connection{connections.length === 1 ? "" : "s"}</Tag>
                    <button onClick={() => removeSharedConnections(p.id)} className="text-accent-700 cursor-pointer bg-transparent border-0 p-0 font-mono text-[10px]">
                      remove
                    </button>
                  </>
                )}
                <label
                  className="text-accent-700 cursor-pointer"
                  title="Adding shared connections enables a deeper read on network strength for this person."
                >
                  {connections ? "+ add more (LinkedIn caps at 5/screenshot)" : "+ add shared connections"}
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => addSharedConnections(p.id, e)} />
                </label>
              </div>
            </Card>
          );
        })}
        <DashedUploadCard
          title="Add profiles"
          description="Screenshots, a LinkedIn PDF export, or a shared-connections capture."
        >
          <div className="flex flex-col gap-2">
            <Button variant="primary" onClick={() => fileInputRef.current?.click()} type="button">
              Add one person
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple onChange={addPerson} className="hidden" />
            <Button variant="secondary" onClick={() => bulkFileInputRef.current?.click()} type="button">
              Bulk add (1 file = 1 person)
            </Button>
            <input ref={bulkFileInputRef} type="file" accept="image/*,.pdf" multiple onChange={addPeopleBulk} className="hidden" />
          </div>
        </DashedUploadCard>
      </CardGrid>

      {detailMessage && <p className="text-xs text-accent-700 mb-8">{detailMessage}</p>}

      <div className="flex justify-end gap-2 mb-10">
        <Button variant="secondary" onClick={clearAllPeople} disabled={busy || people.length === 0}>
          Clear all
        </Button>
        <Button variant="primary" onClick={runAnalysis} disabled={busy || people.length === 0}>
          {latestRun ? "Re-analyze" : "Analyze"}
        </Button>
      </div>

      <SectionHeader
        eyebrow="02 — ANALYSIS"
        title="Role clusters and fit"
        meta={latestRun ? `${latestRun.personCountAtRun}-profile run` : "not run yet"}
      />

      {staleness.stale && (
        <div className="mb-0.5">
          <StaleBanner reason={staleness.reason} action={<Button variant="primary" onClick={runAnalysis}>Re-run analysis</Button>} />
        </div>
      )}

      {!latestRun ? (
        <EmptyState title="No analysis yet" description="Capture a few people above, then run Analyze." />
      ) : (
        <div className={staleness.stale ? "grayscale opacity-40" : ""}>
          <CardGrid columns={3} className="mb-11">
            {latestRun.clusters.map((cl) => {
              const memberCount: number = JSON.parse(cl.memberPersonProfileIdsJson).length;
              return (
                <Link key={cl.id} href={`/company/${slug}/cluster/${cl.id}`} className="no-underline text-text">
                  <Card className="h-full">
                    <div className="flex items-baseline justify-between mb-3.5">
                      <div className="font-heading font-extrabold text-lg">{cl.clusterLabel}</div>
                      <ScoreBadge score={cl.fitScore} size={26} />
                    </div>
                    <div className="h-1.5 bg-neutral-300 mb-3.5">
                      <div className="h-full" style={{ width: `${cl.fitScore}%`, background: getScoreInk(cl.fitScore) }} />
                    </div>
                    <p className="text-sm m-0 mb-2">{cl.fitVerdict}</p>
                    <div className="font-mono text-[10px] tracking-[0.08em] text-neutral-600">
                      {memberCount} {memberCount === 1 ? "person" : "people"}
                    </div>
                  </Card>
                </Link>
              );
            })}
          </CardGrid>
        </div>
      )}

      {insights.length > 0 && (
        <>
          <SectionHeader eyebrow="03 — DO NEXT" title="What would make this read sharper" />
          <CardGrid columns={2}>
            {insights.map((insight, i) => (
              <Card key={i} className="flex gap-4 items-start">
                <span className="font-heading font-extrabold text-xl text-accent flex-none">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <div className="font-heading font-extrabold text-[15px] mb-1.5">{insight.title}</div>
                  <p className="text-[13px] m-0 text-neutral-800">{insight.description}</p>
                </div>
              </Card>
            ))}
          </CardGrid>
        </>
      )}
    </div>
  );
}
