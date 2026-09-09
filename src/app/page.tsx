"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardGrid } from "@/components/ui/Card";
import { Table, Th, Td } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { FitBar } from "@/components/ui/FitBar";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { GettingStartedChecklist } from "@/components/GettingStartedChecklist";
import { useRunStatus } from "@/lib/runStatus/RunStatusContext";

interface CompanyRow {
  id: number;
  slug: string;
  name: string;
  sector: string | null;
  personCount: number;
  jobPostingCount: number;
  connectionCount: number;
  isStale: boolean;
  dismissedAt: string | null;
  latestAnalysis: { overallVerdict: string; overallScore: number; createdAt: string } | null;
}

interface SuggestionRow {
  id: number;
  reasoning: string;
  verdict: string | null;
  basedOnPattern: string;
  confidenceScore: number | null;
  feedbackNote: string | null;
  trackerCompany: { id: number; name: string; sector: string | null; role: string | null; status: string | null };
}

interface SettingsRow {
  staleThresholdDays: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { start, complete, fail } = useRunStatus();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [jdText, setJdText] = useState("");
  const [jdStatus, setJdStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [dismissedCompanyUndo, setDismissedCompanyUndo] = useState<{ id: number; name: string } | null>(null);
  const [dismissedSuggestionUndo, setDismissedSuggestionUndo] = useState<{ id: number; name: string } | null>(null);
  // Lazy initializer, not a direct Date.now() call in the render body — React
  // requires render to be pure, but a one-time state initializer is the
  // accepted escape hatch for this exact case (a stable "now" for this page's
  // lifetime, close enough for day-granularity staleness math).
  const [now] = useState(() => Date.now());

  async function refresh() {
    const [companiesRes, suggestionsRes, settingsRes] = await Promise.all([
      fetch("/api/companies").then((r) => r.json()),
      fetch("/api/suggestions").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]);
    setCompanies(companiesRes.companies ?? []);
    setSuggestions(suggestionsRes.suggestions ?? []);
    setSettings(settingsRes.settings ?? null);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- plain fetch-on-mount, no compiler/Suspense boundary in use
    refresh();
  }, []);

  async function createCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    setBusy(true);
    await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCompanyName.trim() }),
    });
    setNewCompanyName("");
    setShowNewProject(false);
    await refresh();
    setBusy(false);
  }

  async function regenerateSuggestions() {
    const runId = start("generateSuggestions", "Refreshing suggestions", "scanning tracker pool against analyzed companies");
    const res = await fetch("/api/suggestions", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      fail(runId, data.error ?? "Suggestion generation failed");
      return;
    }
    complete(runId, data.skipped ?? `Generated ${data.suggestions?.length ?? 0} suggestion(s).`);
    await refresh();
  }

  async function promote(id: number) {
    await fetch(`/api/suggestions/${id}/promote`, { method: "POST" });
    await refresh();
  }

  async function dismiss(id: number) {
    const suggestion = suggestions.find((s) => s.id === id);
    await fetch(`/api/suggestions/${id}/dismiss`, { method: "POST" });
    if (suggestion) setDismissedSuggestionUndo({ id, name: suggestion.trackerCompany.name });
    await refresh();
  }

  async function undoDismissSuggestion() {
    if (!dismissedSuggestionUndo) return;
    await fetch(`/api/suggestions/${dismissedSuggestionUndo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "new" }),
    });
    setDismissedSuggestionUndo(null);
    await refresh();
  }

  async function dismissCompany(company: CompanyRow, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissed: true }),
    });
    setDismissedCompanyUndo({ id: company.id, name: company.name });
    await refresh();
  }

  async function undoDismissCompany() {
    if (!dismissedCompanyUndo) return;
    await fetch(`/api/companies/${dismissedCompanyUndo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissed: false }),
    });
    setDismissedCompanyUndo(null);
    await refresh();
  }

  async function saveNote(id: number) {
    await fetch(`/api/suggestions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedbackNote: noteDrafts[id] ?? "" }),
    });
    await refresh();
  }

  async function importJd(e: React.FormEvent) {
    e.preventDefault();
    if (!jdText.trim()) return;
    const runId = start("importJobPosting", "Importing job posting", "extracting fields and resolving company");
    const res = await fetch("/api/job-postings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText: jdText, applicationStatus: jdStatus || null }),
    });
    const data = await res.json();
    if (!res.ok) {
      fail(runId, data.error ?? "Import failed");
      return;
    }
    complete(runId, `Imported into ${data.companySlug}.`, `/company/${data.companySlug}/jobs`, "View");
    router.push(`/company/${data.companySlug}/jobs`);
  }

  const visibleCompanies = companies.filter((c) => !c.dismissedAt);

  // Companies where the people-pattern already resembles you strongly, but
  // there's no job posting tracked yet — a good fishing hole worth a
  // proactive outreach, not one you found by searching for an open role.
  const strongFitNoTarget = visibleCompanies.filter(
    (c) => c.latestAnalysis != null && c.latestAnalysis.overallScore >= 70 && c.jobPostingCount === 0,
  );

  // The dashboard leads with a finding, not a count: the highest-scoring
  // company whose analysis is still within the stale threshold. Recomputed
  // live on every load — no stored "current lead" row, consistent with how
  // every other derived value in this app (staleness, fit bars) works.
  const staleThresholdMs = (settings?.staleThresholdDays ?? 30) * 24 * 60 * 60 * 1000;
  const daysSinceAnalysis = (c: CompanyRow) =>
    c.latestAnalysis ? Math.floor((now - new Date(c.latestAnalysis.createdAt).getTime()) / (24 * 60 * 60 * 1000)) : null;
  const eligibleForLead = visibleCompanies.filter(
    (c) => c.latestAnalysis != null && now - new Date(c.latestAnalysis.createdAt).getTime() <= staleThresholdMs,
  );
  const lead = eligibleForLead.reduce<CompanyRow | null>(
    (best, c) => (best == null || c.latestAnalysis!.overallScore > best.latestAnalysis!.overallScore ? c : best),
    null,
  );
  const tooStaleToLead = visibleCompanies.filter(
    (c) => c.latestAnalysis != null && now - new Date(c.latestAnalysis.createdAt).getTime() > staleThresholdMs,
  );

  const sortedCompanies = [...visibleCompanies].sort((a, b) => {
    const scoreA = a.latestAnalysis?.overallScore ?? -1;
    const scoreB = b.latestAnalysis?.overallScore ?? -1;
    return scoreB - scoreA;
  });

  return (
    <div className="px-10 pt-11 pb-20 max-w-[1320px] w-full">
      <GettingStartedChecklist />
      <PageHeader
        eyebrow="COMPANY PROJECTS"
        title={lead ? `${lead.name} is your strongest lead` : visibleCompanies.length === 0 ? "No projects yet" : "No current lead"}
        subcopy={
          lead ? (
            <>
              {lead.latestAnalysis!.overallScore}/100 · analyzed {daysSinceAnalysis(lead)} day{daysSinceAnalysis(lead) === 1 ? "" : "s"} ago
              {lead.latestAnalysis!.overallVerdict ? ` · ${lead.latestAnalysis!.overallVerdict}` : ""}
            </>
          ) : visibleCompanies.length > 0 ? (
            "Every analyzed project is past the stale threshold — re-run one to get a current lead."
          ) : undefined
        }
        actions={
          <>
            <Link href="/import-tracker/mapping">
              <Button variant="secondary">Import company list</Button>
            </Link>
            <Button variant="primary" onClick={() => setShowNewProject((v) => !v)}>
              New project
            </Button>
          </>
        }
      />

      {showNewProject && (
        <Card className="mb-8 border border-divider">
          <form onSubmit={createCompany} className="flex gap-2">
            <Input
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              placeholder="Company name..."
              autoFocus
              className="max-w-sm"
            />
            <Button type="submit" disabled={busy || !newCompanyName.trim()}>
              Create
            </Button>
          </form>
        </Card>
      )}

      {tooStaleToLead.length > 0 && (
        <div className="font-mono text-[11px] tracking-[0.04em] text-accent-700 mb-10">
          Too stale to lead — {tooStaleToLead.map((c) => c.name).join(", ")}
        </div>
      )}

      <div className="mb-8">
        <details>
          <summary className="cursor-pointer text-sm font-heading font-extrabold mb-3">Import a job description</summary>
          <p className="text-xs text-neutral-700 mb-3 mt-2">
            Paste a job posting you&apos;re interested in (or already applied to). The company is resolved
            automatically from the posting text — creates a new project if it doesn&apos;t exist yet, or attaches
            to the existing one — then takes you there for a role-fit read and outreach draft.
          </p>
          <form onSubmit={importJd} className="flex flex-col gap-2 max-w-2xl">
            <Field label="Job posting text">
              <Textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder="Paste the full job description text..."
                rows={4}
              />
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
        </details>
      </div>

      {visibleCompanies.length === 0 ? (
        <EmptyState
          title="No company projects yet"
          description="Add one above, or import your tracker to pull suggestions from your existing pipeline."
        />
      ) : (
        <>
          <Table className="mb-2">
            <thead>
              <tr>
                <Th style={{ width: "30%" }}>Company</Th>
                <Th>Profiles</Th>
                <Th>Job descriptions</Th>
                <Th>Fit</Th>
                <Th>Last analysis</Th>
                <Th className="text-right">State</Th>
                <Th className="text-right"></Th>
              </tr>
            </thead>
            <tbody>
              {sortedCompanies.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer hover:bg-surface"
                  onClick={() => router.push(`/company/${c.slug}`)}
                >
                  <Td>
                    <div className="font-heading font-extrabold text-base">{c.name}</div>
                    <div className="text-xs text-neutral-700">{c.sector}</div>
                    {c.connectionCount > 0 && (
                      <Link
                        href={`/connections?company=${c.slug}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-[10px] text-cool no-underline hover:underline"
                      >
                        {c.connectionCount} connection{c.connectionCount === 1 ? "" : "s"}
                      </Link>
                    )}
                  </Td>
                  <Td>{c.personCount}</Td>
                  <Td>{c.jobPostingCount}</Td>
                  <Td>
                    <FitBar score={c.latestAnalysis?.overallScore ?? null} />
                  </Td>
                  <Td className="text-xs text-neutral-700">
                    {c.latestAnalysis ? new Date(c.latestAnalysis.createdAt).toLocaleDateString() : "—"}
                  </Td>
                  <Td className="text-right">
                    <Tag variant={!c.latestAnalysis || c.isStale ? "accent" : "neutral"}>
                      {!c.latestAnalysis ? "Never run" : c.isStale ? "Out of date" : "Current"}
                    </Tag>
                  </Td>
                  <Td className="text-right">
                    <button
                      onClick={(e) => dismissCompany(c, e)}
                      className="text-[11px] text-neutral-600 hover:text-accent-700 bg-transparent border-0 cursor-pointer p-0"
                    >
                      Dismiss
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {dismissedCompanyUndo && (
            <p className="text-xs text-neutral-700 mb-14">
              Dismissed {dismissedCompanyUndo.name}.{" "}
              <button
                onClick={undoDismissCompany}
                className="text-accent-700 underline decoration-dotted bg-transparent border-0 cursor-pointer p-0"
              >
                Undo
              </button>
            </p>
          )}
          {!dismissedCompanyUndo && <div className="mb-14" />}
        </>
      )}

      {strongFitNoTarget.length > 0 && (
        <>
          <div className="flex items-baseline gap-3.5 border-b-2 border-divider pb-2 mb-5">
            <span className="font-mono text-[10px] tracking-[0.16em] text-accent">DO NEXT</span>
            <h3 className="m-0 text-xl">Strong fit, no target yet</h3>
            <span className="ml-auto text-xs text-neutral-700">Analyzed companies with no job posting tracked</span>
          </div>
          <CardGrid columns={3} className="mb-14">
            {strongFitNoTarget.map((c) => (
              <Card key={c.id}>
                <div className="flex items-baseline justify-between mb-2">
                  <div className="font-heading font-extrabold text-[17px]">{c.name}</div>
                  <Tag variant="neutral">{c.latestAnalysis!.overallScore}/100</Tag>
                </div>
                <p className="text-[13px] m-0 mb-3.5 text-neutral-800">
                  {c.personCount} captured {c.personCount === 1 ? "profile" : "profiles"} already resemble your
                  background — no live posting yet, worth reaching out before one appears.
                </p>
                <Link href={`/company/${c.slug}/jobs`}>
                  <Button variant="primary">Find a posting</Button>
                </Link>
              </Card>
            ))}
          </CardGrid>
        </>
      )}

      <div className="flex items-baseline gap-3.5 border-b-2 border-divider pb-2 mb-5">
        <span className="font-mono text-[10px] tracking-[0.16em] text-accent">DO NEXT</span>
        <h3 className="m-0 text-xl">Worth opening a project for</h3>
        <div className="ml-auto flex items-center gap-3">
          {suggestions.length > 0 && (
            <span className="text-xs text-neutral-700">Ranked by your priority column and your profile</span>
          )}
          <button
            onClick={regenerateSuggestions}
            disabled={busy}
            className="text-xs text-neutral-600 hover:text-text underline decoration-dotted bg-transparent border-0 cursor-pointer p-0"
          >
            Refresh
          </button>
        </div>
      </div>

      {suggestions.length === 0 ? (
        <EmptyState
          title="No suggestions yet"
          description="Analyze at least two companies to give the suggestion engine a fit pattern to match against."
        />
      ) : (
        <CardGrid columns={3}>
          {suggestions.map((s) => (
            <Card key={s.id}>
              <div className="font-heading font-extrabold text-[17px] mb-2">{s.trackerCompany.name}</div>
              {s.verdict && <p className="text-sm font-heading font-extrabold m-0 mb-2">{s.verdict}</p>}
              <p className="text-[13px] m-0 mb-3 text-neutral-800">{s.reasoning}</p>
              <div className="font-mono text-[11px] leading-relaxed text-neutral-600 mb-3.5">
                BASED ON — {s.basedOnPattern}
              </div>
              <div className="flex gap-2 mb-3.5">
                <Button variant="primary" onClick={() => promote(s.id)}>
                  Promote
                </Button>
                <Button variant="secondary" onClick={() => dismiss(s.id)}>
                  Dismiss
                </Button>
              </div>
              <div className="border-t border-divider pt-3">
                <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-1.5">YOUR NOTES</div>
                <Textarea
                  value={noteDrafts[s.id] ?? s.feedbackNote ?? ""}
                  onChange={(e) => setNoteDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
                  placeholder="Any history or context with this one — carries forward if you promote it."
                  rows={2}
                  className="mb-2"
                />
                <Button variant="secondary" onClick={() => saveNote(s.id)}>
                  Save note
                </Button>
              </div>
            </Card>
          ))}
        </CardGrid>
      )}
      {dismissedSuggestionUndo && (
        <p className="text-xs text-neutral-700 mt-4">
          Dismissed {dismissedSuggestionUndo.name}.{" "}
          <button
            onClick={undoDismissSuggestion}
            className="text-accent-700 underline decoration-dotted bg-transparent border-0 cursor-pointer p-0"
          >
            Undo
          </button>
        </p>
      )}
    </div>
  );
}
