"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Table, Th, Td } from "@/components/ui/Table";
import { CardGrid, Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Radio";
import { EmptyState } from "@/components/ui/EmptyState";

interface CompanyRow {
  id: number;
  name: string;
  meta: string;
  profiles: string;
  clusters: string;
  jds: string;
  plans: string;
  interviews: string;
  runs: number;
  total: string;
}

interface ActivityRow {
  activity: string;
  label: string;
  total: string;
  count: number;
  pct: number;
  color: string;
  detail: string;
}

interface RunRow {
  id: number;
  when: string;
  activity: string;
  company: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
}

interface Summary {
  stats: { totalSpend: number; costPerProfile: number; costPerActionPlan: number; rerunSpend: number };
  byCompany: CompanyRow[];
  notAttached: { meta: string; total: string; runs: number } | null;
  byActivity: ActivityRow[];
}

interface DashboardStats {
  personCount: number;
  jobPostingCount: number;
  staleCount: number;
}

export default function AdminPage() {
  const [period, setPeriod] = useState<"7" | "30" | "180">("30");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [vectorMapEnabled, setVectorMapEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setVectorMapEnabled(Boolean(data.settings?.vectorMapEnabled)));
  }, []);

  function toggleVectorMap(next: boolean) {
    setVectorMapEnabled(next);
    fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vectorMapEnabled: next }),
    });
  }

  useEffect(() => {
    fetch(`/api/admin/summary?period=${period}`)
      .then((r) => r.json())
      .then(setSummary);
    fetch("/api/admin/runs?limit=10")
      .then((r) => r.json())
      .then((data) => setRuns(data.runs ?? []));
  }, [period]);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then(setDashboardStats);
  }, []);

  const stats = summary?.stats;

  return (
    <div className="px-10 pt-11 pb-20 max-w-[1320px] w-full">
      <PageHeader
        eyebrow="ADMIN"
        title="Where the money went"
        actions={
          <Segmented
            options={[
              { value: "7", label: "7 days" },
              { value: "30", label: "30 days" },
              { value: "180", label: "6 months" },
            ]}
            value={period}
            onChange={setPeriod}
          />
        }
      />

      {/* Operational counts — moved here from the dashboard, which now leads
          with a finding instead of a count. */}
      <div className="grid grid-cols-3 border-t-2 border-b-2 border-divider mb-6">
        <div className="py-4 pr-5 border-r border-divider">
          <div className="font-heading font-extrabold text-3xl leading-none">{dashboardStats?.personCount ?? 0}</div>
          <div className="text-xs text-neutral-700 mt-1">profiles captured</div>
        </div>
        <div className="py-4 px-5 border-r border-divider">
          <div className="font-heading font-extrabold text-3xl leading-none">{dashboardStats?.jobPostingCount ?? 0}</div>
          <div className="text-xs text-neutral-700 mt-1">job descriptions</div>
        </div>
        <div className="py-4 pl-5">
          <div className="font-heading font-extrabold text-3xl leading-none text-accent-700">{dashboardStats?.staleCount ?? 0}</div>
          <div className="text-xs text-neutral-700 mt-1">analyses out of date</div>
        </div>
      </div>

      <div className="grid grid-cols-4 border-b-2 border-divider mb-11">
        <div className="py-4 pr-5 border-r border-divider">
          <div className="font-heading font-extrabold text-3xl leading-none">${(stats?.totalSpend ?? 0).toFixed(2)}</div>
          <div className="text-xs text-neutral-700 mt-1">total, {period === "180" ? "6 months" : `${period} days`}</div>
        </div>
        <div className="py-4 px-5 border-r border-divider">
          <div className="font-heading font-extrabold text-3xl leading-none">${(stats?.costPerProfile ?? 0).toFixed(2)}</div>
          <div className="text-xs text-neutral-700 mt-1">per profile extracted</div>
        </div>
        <div className="py-4 px-5 border-r border-divider">
          <div className="font-heading font-extrabold text-3xl leading-none">${(stats?.costPerActionPlan ?? 0).toFixed(2)}</div>
          <div className="text-xs text-neutral-700 mt-1">per action plan</div>
        </div>
        <div className="py-4 pl-5">
          <div className="font-heading font-extrabold text-3xl leading-none text-accent-700">${(stats?.rerunSpend ?? 0).toFixed(2)}</div>
          <div className="text-xs text-neutral-700 mt-1">spent on re-runs</div>
        </div>
      </div>

      <SectionHeader eyebrow="01 — BY COMPANY" title="Cost per project" meta="Broken out by the activity that spent it" />

      {!summary || (summary.byCompany.length === 0 && !summary.notAttached) ? (
        <div className="mb-12">
          <EmptyState title="No spend recorded yet" description="Cost data appears here once you run an analysis, import a job posting, or capture a profile." />
        </div>
      ) : (
        <Table className="mb-12">
          <thead>
            <tr>
              <Th style={{ width: "26%" }}>Company</Th>
              <Th className="text-right">Profiles</Th>
              <Th className="text-right">Cluster analysis</Th>
              <Th className="text-right">Job descriptions</Th>
              <Th className="text-right">Action plans</Th>
              <Th className="text-right">Interview prep</Th>
              <Th className="text-right">Runs</Th>
              <Th className="text-right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {summary.byCompany.map((r) => (
              <tr key={r.id}>
                <Td>
                  <div className="font-heading font-extrabold text-[15px]">{r.name}</div>
                  <div className="text-xs text-neutral-700">{r.meta}</div>
                </Td>
                <Td className="text-right font-mono text-[13px]">{r.profiles}</Td>
                <Td className="text-right font-mono text-[13px]">{r.clusters}</Td>
                <Td className="text-right font-mono text-[13px]">{r.jds}</Td>
                <Td className="text-right font-mono text-[13px]">{r.plans}</Td>
                <Td className="text-right font-mono text-[13px]">{r.interviews}</Td>
                <Td className="text-right font-mono text-[13px] text-neutral-700">{r.runs}</Td>
                <Td className="text-right font-heading font-extrabold text-[15px]">{r.total}</Td>
              </tr>
            ))}
            {summary.notAttached && (
              <tr>
                <Td>
                  <div className="font-heading font-extrabold text-[15px]">Not attached to a company</div>
                  <div className="text-xs text-neutral-700">{summary.notAttached.meta}</div>
                </Td>
                <Td className="text-right font-mono text-[13px]">—</Td>
                <Td className="text-right font-mono text-[13px]">—</Td>
                <Td className="text-right font-mono text-[13px]">—</Td>
                <Td className="text-right font-mono text-[13px]">—</Td>
                <Td className="text-right font-mono text-[13px]">—</Td>
                <Td className="text-right font-mono text-[13px] text-neutral-700">{summary.notAttached.runs}</Td>
                <Td className="text-right font-heading font-extrabold text-[15px]">{summary.notAttached.total}</Td>
              </tr>
            )}
          </tbody>
        </Table>
      )}

      <SectionHeader eyebrow="02 — BY ACTIVITY" title="What each kind of analysis costs you" />

      <CardGrid columns={4} className="mb-12">
        {(summary?.byActivity ?? []).map((a) => (
          <Card key={a.activity}>
            <div className="font-heading font-extrabold text-[26px] leading-none mb-2.5">{a.total}</div>
            <div className="h-1.5 bg-neutral-300 mb-3">
              <div className="h-full" style={{ width: `${a.pct}%`, background: a.color }} />
            </div>
            <div className="font-heading font-extrabold text-sm mb-1">{a.label}</div>
            <div className="text-xs text-neutral-700">{a.detail}</div>
          </Card>
        ))}
      </CardGrid>

      <SectionHeader eyebrow="03 — RECENT RUNS" title="Last 10 calls" />

      {runs.length === 0 ? (
        <EmptyState title="Nothing logged yet" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th style={{ width: "150px" }}>When</Th>
              <Th>Activity</Th>
              <Th>Company</Th>
              <Th className="text-right">Tokens in / out</Th>
              <Th className="text-right">Cost</Th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <Td className="font-mono text-xs text-neutral-700">{new Date(r.when).toLocaleString()}</Td>
                <Td className="text-sm">{r.activity}</Td>
                <Td className="text-sm">{r.company}</Td>
                <Td className="text-right font-mono text-xs text-neutral-700">
                  {(r.tokensIn / 1000).toFixed(1)}k / {(r.tokensOut / 1000).toFixed(1)}k
                </Td>
                <Td className="text-right font-mono text-[13px]">${r.cost.toFixed(2)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <SectionHeader eyebrow="04 — FEATURES" title="Experimental" className="mt-11" />
      <Card>
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="font-heading font-extrabold text-sm mb-1">Vector map</div>
            <p className="text-[13px] text-neutral-700 m-0 max-w-[62ch]">
              A scatter-plot view of captured profiles by text similarity, using Voyage AI
              embeddings — requires a VOYAGE_API_KEY in .env. Off by default, since turning it on
              sends captured profile text (title/headline/about/skills) to Voyage for this one
              feature. See docs/METHODOLOGY.md for what this is and isn&apos;t measuring.
            </p>
          </div>
          {vectorMapEnabled != null && (
            <Segmented
              options={[
                { value: "off", label: "Off" },
                { value: "on", label: "On" },
              ]}
              value={vectorMapEnabled ? "on" : "off"}
              onChange={(v) => toggleVectorMap(v === "on")}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
