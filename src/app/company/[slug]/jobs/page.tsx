"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card, CardGrid } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Textarea, Input } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Radio";
import { getScoreInk } from "@/lib/scoreInk";
import { useRunStatus } from "@/lib/runStatus/RunStatusContext";

interface JobPostingAnalysisRow {
  id: number;
  fitScore: number;
  verdict: string;
}

interface JobPostingRow {
  id: number;
  title: string;
  seniority: string;
  functionType: string;
  applicationStatus: string | null;
  createdAt: string;
  analyses: JobPostingAnalysisRow[];
}

export default function JobsTab({ params }: PageProps<"/company/[slug]/jobs">) {
  const { slug } = use(params);
  const { start, updateDetail, complete, fail } = useRunStatus();
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [jobPostings, setJobPostings] = useState<JobPostingRow[]>([]);
  const [jdText, setJdText] = useState("");
  const [jdStatus, setJdStatus] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sortBy, setSortBy] = useState<"recent" | "fit">("recent");

  async function refresh() {
    const { companies } = await fetch("/api/companies").then((r) => r.json());
    const company = companies.find((c: { slug: string }) => c.slug === slug);
    if (!company) return;
    setCompanyId(company.id);
    setCompanyName(company.name);
    const { jobPostings: jobs } = await fetch(`/api/companies/${company.id}/job-postings`).then((r) => r.json());
    setJobPostings(jobs ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- plain fetch-on-mount, no compiler/Suspense boundary in use
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function importJd(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || !jdText.trim()) return;
    const runId = start("importJobPosting", "Importing job posting", `${companyName} · extracting fields`);
    const res = await fetch("/api/job-postings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText: jdText, applicationStatus: jdStatus || null, companyId }),
    });
    const data = await res.json();
    if (!res.ok) {
      fail(runId, data.error ?? "Import failed");
      return;
    }
    setJdText("");
    setJdStatus("");
    setShowImport(false);
    complete(runId, "Job posting added.");
    await refresh();
  }

  async function analyzeJd(jobPostingId: number) {
    const runId = start("analyzeJobFit", "Assessing role fit", `${companyName} · drafting outreach`);
    const res = await fetch(`/api/job-postings/${jobPostingId}/analyze`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) fail(runId, data.error ?? "Analysis failed");
    else complete(runId, "Role-fit analysis complete.");
    await refresh();
  }

  async function analyzeAllUnanalyzed() {
    const targets = jobPostings.filter((jp) => jp.analyses.length === 0);
    if (targets.length === 0) return;

    const { averageCost } = await fetch("/api/admin/activity-cost?activity=analyzeJobFit").then((r) => r.json());
    const estimateText = averageCost != null ? ` Estimated cost: ~$${(averageCost * targets.length).toFixed(2)}.` : "";
    const ok = confirm(`Analyze ${targets.length} posting${targets.length === 1 ? "" : "s"}?${estimateText}`);
    if (!ok) return;

    const runId = start("analyzeJobFit", "Analyzing job postings", `0 of ${targets.length}`);
    let succeeded = 0;
    const failures: string[] = [];
    for (let i = 0; i < targets.length; i++) {
      const jp = targets[i];
      updateDetail(runId, `${i + 1} of ${targets.length} — ${jp.title}`);
      const res = await fetch(`/api/job-postings/${jp.id}/analyze`, { method: "POST" });
      if (res.ok) succeeded += 1;
      else failures.push(jp.title);
    }
    if (failures.length === 0) complete(runId, `${succeeded} of ${targets.length} postings analyzed.`);
    else fail(runId, `${succeeded} of ${targets.length} analyzed — failed: ${failures.join(", ")}`);
    await refresh();
  }

  async function deleteJd(jobPostingId: number, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm("Delete this job posting and its analysis?")) return;
    setBusy(true);
    await fetch(`/api/job-postings/${jobPostingId}`, { method: "DELETE" });
    setBusy(false);
    await refresh();
  }

  const sortedJobPostings = [...jobPostings].sort((a, b) => {
    if (sortBy === "fit") {
      const fitA = a.analyses[0]?.fitScore ?? -1;
      const fitB = b.analyses[0]?.fitScore ?? -1;
      if (fitA !== fitB) return fitB - fitA;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const unanalyzedCount = jobPostings.filter((jp) => jp.analyses.length === 0).length;

  return (
    <div className="px-10 pt-9 pb-20 max-w-[1320px] w-full">
      <SectionHeader
        eyebrow="01 — CAPTURED"
        title="Job descriptions"
        meta={
          <div className="flex items-center gap-3">
            {jobPostings.length > 1 && (
              <Segmented
                options={[
                  { value: "recent", label: "Most recent" },
                  { value: "fit", label: "Fit score" },
                ]}
                value={sortBy}
                onChange={setSortBy}
              />
            )}
            {unanalyzedCount > 1 && (
              <Button variant="secondary" onClick={analyzeAllUnanalyzed}>
                Analyze all ({unanalyzedCount})
              </Button>
            )}
            <button onClick={() => setShowImport((v) => !v)} className="text-xs text-neutral-700 hover:text-text bg-transparent border-0 cursor-pointer p-0 underline decoration-dotted">
              Paste a posting
            </button>
          </div>
        }
      />

      {showImport && (
        <Card className="mb-6 border border-divider">
          <form onSubmit={importJd} className="flex flex-col gap-2 max-w-2xl">
            <Field label="Job posting text">
              <Textarea value={jdText} onChange={(e) => setJdText(e.target.value)} placeholder="Paste the full job description text..." rows={4} />
            </Field>
            <div className="flex gap-2">
              <Input
                value={jdStatus}
                onChange={(e) => setJdStatus(e.target.value)}
                placeholder="Application status (optional) — e.g. 'rejected within hours'"
                className="flex-1"
              />
              <Button type="submit" disabled={!jdText.trim()}>
                Import
              </Button>
            </div>
          </form>
        </Card>
      )}

      {jobPostings.length === 0 ? (
        <EmptyState title="No job postings imported yet" description="Paste one above to get a role-specific fit read." />
      ) : (
        <CardGrid columns={4}>
          {sortedJobPostings.map((jp) => {
            const latest = jp.analyses[0] ?? null;
            return (
              <Link key={jp.id} href={`/company/${slug}/job/${jp.id}`} className="no-underline text-text">
                <Card padding="sm" tone="captured" className="cursor-pointer h-full">
                  <div className="font-heading font-extrabold text-[13px] leading-snug mb-1.5 line-clamp-2">{jp.title}</div>
                  <div className="text-[11px] text-neutral-700 mb-2.5 truncate">
                    {jp.seniority} · {jp.functionType}
                  </div>
                  {latest?.verdict && <div className="text-xs mb-2.5 line-clamp-2">{latest.verdict}</div>}
                  <div className="flex gap-1.5 items-center flex-wrap mb-2.5">
                    {latest ? (
                      <span className="font-mono text-[11px] tracking-[0.02em]" style={{ color: getScoreInk(latest.fitScore) }}>
                        Fit {latest.fitScore}/100
                      </span>
                    ) : (
                      <Tag variant="neutral">Not analyzed</Tag>
                    )}
                    {jp.applicationStatus && <Tag variant="neutral">{jp.applicationStatus}</Tag>}
                  </div>
                  <div className="flex gap-2.5 items-center border-t border-divider pt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        analyzeJd(jp.id);
                      }}
                      className="text-[11px] text-neutral-700 hover:text-text bg-transparent border-0 cursor-pointer p-0"
                    >
                      {latest ? "Re-analyze" : "Analyze"}
                    </button>
                    <button
                      onClick={(e) => deleteJd(jp.id, e)}
                      disabled={busy}
                      className="ml-auto text-[11px] text-accent-700 bg-transparent border-0 cursor-pointer disabled:opacity-40 p-0"
                    >
                      Delete
                    </button>
                  </div>
                </Card>
              </Link>
            );
          })}
        </CardGrid>
      )}
    </div>
  );
}
