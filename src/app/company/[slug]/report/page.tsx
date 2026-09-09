"use client";

import { use, useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { getScoreInk } from "@/lib/scoreInk";
import { INTERVIEW_ROUND_STATE_LABELS, type InterviewRoundState } from "@/lib/interviewRoundState";

interface CompanySummary {
  id: number;
  slug: string;
  name: string;
  sector: string | null;
  connectionCount: number;
  latestAnalysis: { overallVerdict: string; overallScore: number; createdAt: string } | null;
}

interface ClusterRow {
  id: number;
  clusterLabel: string;
  fitScore: number;
  fitVerdict: string;
}

interface AnalysisRunRow {
  confidenceNote: string;
  clusters: ClusterRow[];
}

interface JobPostingRow {
  id: number;
  title: string;
  analyses: { fitScore: number; verdict: string }[];
}

interface RoundRow {
  sequence: number;
  stage: string;
  state: string | null;
}

interface InterviewRow {
  disposition: string | null;
  rounds: RoundRow[];
}

interface ConnectionRow {
  name: string;
  matchedCompany: { id: number; name: string } | null;
}

export default function CompanyReportPage({ params }: PageProps<"/company/[slug]/report">) {
  const { slug } = use(params);
  const [company, setCompany] = useState<CompanySummary | null>(null);
  const [latestRun, setLatestRun] = useState<AnalysisRunRow | null>(null);
  const [jobPostings, setJobPostings] = useState<JobPostingRow[]>([]);
  const [interviews, setInterviews] = useState<InterviewRow[]>([]);
  const [connectionNames, setConnectionNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    async function load() {
      const { companies } = await fetch("/api/companies").then((r) => r.json());
      const c: CompanySummary | null = companies?.find((x: CompanySummary) => x.slug === slug) ?? null;
      setCompany(c);
      if (!c) {
        setLoading(false);
        return;
      }
      const [analyzeRes, jobsRes, interviewsRes, connectionsRes] = await Promise.all([
        fetch(`/api/companies/${c.id}/analyze`).then((r) => r.json()),
        fetch(`/api/companies/${c.id}/job-postings`).then((r) => r.json()),
        fetch(`/api/companies/${c.id}/interviews`).then((r) => r.json()),
        fetch(`/api/connections/list`).then((r) => r.json()),
      ]);
      setLatestRun(analyzeRes.runs?.[0] ?? null);
      setJobPostings(jobsRes.jobPostings ?? []);
      setInterviews(interviewsRes.interviews ?? []);
      const names = (connectionsRes.connections ?? [])
        .filter((conn: ConnectionRow) => conn.matchedCompany?.id === c.id)
        .map((conn: ConnectionRow) => conn.name);
      setConnectionNames(names);
      setLoading(false);
    }
    load();
  }, [slug]);

  if (loading) return null;

  if (!company) {
    return (
      <div className="px-10 pt-9 pb-20 max-w-[820px] w-full">
        <EmptyState title="Project not found" />
      </div>
    );
  }

  const topClusters = [...(latestRun?.clusters ?? [])].sort((a, b) => b.fitScore - a.fitScore).slice(0, 3);
  const analyzedPostings = jobPostings.filter((jp) => jp.analyses.length > 0);
  const daysSince = company.latestAnalysis
    ? Math.floor((now - new Date(company.latestAnalysis.createdAt).getTime()) / (24 * 60 * 60 * 1000))
    : null;

  const latestInterview = interviews
    .flatMap((i) => i.rounds.map((r) => ({ ...r, disposition: i.disposition })))
    .sort((a, b) => b.sequence - a.sequence)[0];

  return (
    <div className="px-10 pt-9 pb-20 max-w-[820px] w-full print:pt-4">
      <div className="mb-8">
        <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-2">PROJECT SUMMARY</div>
        <h1 className="text-[34px] m-0 mb-1.5 leading-tight tracking-tight">{company.name}</h1>
        {company.latestAnalysis ? (
          <>
            <div className="text-base m-0">{company.latestAnalysis.overallVerdict}</div>
            <div className="font-mono text-[11px] text-neutral-600 mt-1.5">
              <span style={{ color: getScoreInk(company.latestAnalysis.overallScore) }}>{company.latestAnalysis.overallScore}/100</span>
              {" · analyzed "}
              {daysSince}
              {daysSince === 1 ? " day ago" : " days ago"}
            </div>
          </>
        ) : (
          <p className="text-sm text-neutral-600 m-0">Not analyzed yet.</p>
        )}
      </div>

      {topClusters.length > 0 && (
        <>
          <SectionHeader eyebrow="02 — ANALYSIS" title="Strongest role clusters" />
          <div className="flex flex-col gap-2.5 mb-8">
            {topClusters.map((cl) => (
              <div key={cl.id} className="flex items-baseline gap-3">
                <span className="font-heading font-extrabold text-sm" style={{ color: getScoreInk(cl.fitScore) }}>
                  {cl.fitScore}
                </span>
                <span className="font-heading font-extrabold text-sm">{cl.clusterLabel}</span>
                <span className="text-sm text-neutral-700">{cl.fitVerdict}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {latestRun?.confidenceNote && (
        <div className="mb-8">
          <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-1.5">SAMPLE CONFIDENCE</div>
          <p className="text-sm text-neutral-800 m-0">{latestRun.confidenceNote}</p>
        </div>
      )}

      <SectionHeader eyebrow="02 — ANALYSIS" title="Job postings" />
      {analyzedPostings.length === 0 ? (
        <p className="text-sm text-neutral-600 mb-8">No analyzed postings yet.</p>
      ) : (
        <div className="flex flex-col gap-2.5 mb-8">
          {analyzedPostings.map((jp) => (
            <div key={jp.id} className="flex items-baseline gap-3">
              <span className="font-heading font-extrabold text-sm" style={{ color: getScoreInk(jp.analyses[0].fitScore) }}>
                {jp.analyses[0].fitScore}
              </span>
              <span className="font-heading font-extrabold text-sm">{jp.title}</span>
              <span className="text-sm text-neutral-700">{jp.analyses[0].verdict}</span>
            </div>
          ))}
        </div>
      )}

      <SectionHeader eyebrow="02 — ANALYSIS" title="Interview activity" />
      <p className="text-sm text-neutral-800 mb-8">
        {interviews.length === 0
          ? "No interview activity yet."
          : `${interviews.reduce((n, i) => n + i.rounds.length, 0)} round${interviews.reduce((n, i) => n + i.rounds.length, 0) === 1 ? "" : "s"} tracked across ${interviews.length} thread${interviews.length === 1 ? "" : "s"}${
              latestInterview
                ? ` — most recent: ${latestInterview.stage} (${
                    latestInterview.state ? INTERVIEW_ROUND_STATE_LABELS[latestInterview.state as InterviewRoundState] : "no state set"
                  })`
                : ""
            }`}
      </p>

      <SectionHeader eyebrow="01 — CAPTURED" title="Connections" />
      <p className="text-sm text-neutral-800">
        {company.connectionCount === 0
          ? "No connections at this company yet."
          : `${company.connectionCount} connection${company.connectionCount === 1 ? "" : "s"} here${
              connectionNames.length > 0 ? `: ${connectionNames.slice(0, 5).join(", ")}${connectionNames.length > 5 ? ", …" : ""}` : ""
            }`}
      </p>
    </div>
  );
}
