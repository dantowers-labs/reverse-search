"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardGrid } from "@/components/ui/Card";
import { Table, Th, Td } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { Input } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Radio";
import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/ui/Avatar";
import { useRunStatus } from "@/lib/runStatus/RunStatusContext";

interface ConnectionRow {
  id: number;
  name: string;
  company: string | null;
  position: string | null;
  url: string | null;
  connectedOn: string | null;
  matchedCompany: { id: number; name: string } | null;
}

interface CompanyPerson {
  id: number;
  name: string;
  company: string | null;
  position: string | null;
  connectedOn: string | null;
}

interface AnalyzedCompanyGroup {
  id: number;
  slug: string;
  name: string;
  connections: CompanyPerson[];
}

interface OtherCompanyGroup {
  label: string;
  connections: CompanyPerson[];
}

interface Opportunity {
  trackerCompanyIds: number[];
  name: string;
  alsoMatchedNames?: string[];
  sector: string | null;
  connections: { id: number; name: string; company: string | null; position: string | null }[];
}

type View = "company" | "person";
type SortKey = "recent" | "name" | "company" | "title";

function CompanyRowGroup({ label, connections, defaultOpen }: { label: string; connections: CompanyPerson[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-divider">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-3 bg-transparent border-0 cursor-pointer text-left"
        disabled={connections.length === 0}
      >
        <span className="font-heading font-extrabold text-sm">{label}</span>
        <span className="font-mono text-xs text-cool">
          {connections.length === 0 ? "no connections here yet" : `${connections.length} connection${connections.length === 1 ? "" : "s"}`}
        </span>
      </button>
      {open && connections.length > 0 && (
        <div className="max-h-[280px] overflow-y-auto mb-3">
          {connections.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-1.5 pl-4 text-sm">
              <span className="font-heading font-semibold">{c.name}</span>
              <span className="text-xs text-neutral-700">{c.position ?? "—"}</span>
              <span className="font-mono text-[11px] text-neutral-600">
                {c.connectedOn ? new Date(c.connectedOn).toLocaleDateString() : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectionsPageContent() {
  const router = useRouter();
  const { start, complete, fail } = useRunStatus();
  const deepLinkCompanySlug = useSearchParams().get("company");
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [analyzed, setAnalyzed] = useState<AnalyzedCompanyGroup[]>([]);
  const [topOther, setTopOther] = useState<OtherCompanyGroup[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [view, setView] = useState<View>("company");

  const [filterName, setFilterName] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [filterTitle, setFilterTitle] = useState("");
  const [onlyAnalyzed, setOnlyAnalyzed] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const [listRes, byCompanyRes, oppRes] = await Promise.all([
      fetch("/api/connections/list").then((r) => r.json()),
      fetch("/api/connections/by-company").then((r) => r.json()),
      fetch("/api/connections/opportunities").then((r) => r.json()),
    ]);
    setConnections(listRes.connections ?? []);
    setAnalyzed(byCompanyRes.analyzed ?? []);
    setTopOther(byCompanyRes.topOther ?? []);
    setOpportunities(oppRes.opportunities ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- plain fetch-on-mount, no compiler/Suspense boundary in use
    refresh();
  }, []);

  async function importConnections(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const runId = start("importConnections", "Importing connections", "no API call");
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/connections/import", { method: "POST", body: form });
    const data = await res.json();
    e.target.value = "";
    if (!res.ok) fail(runId, data.error ?? "Import failed");
    else complete(runId, `${data.connectionsImported} connections imported from ${data.rowsRead} rows.`);
    await refresh();
  }

  async function openProject(name: string, sector: string | null) {
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, sector: sector ?? undefined }),
    });
    const data = await res.json();
    if (res.ok) router.push(`/company/${data.company.slug}`);
  }

  const filtered = useMemo(() => {
    const nameQ = filterName.trim().toLowerCase();
    const companyQ = filterCompany.trim().toLowerCase();
    const titleQ = filterTitle.trim().toLowerCase();
    let rows = connections;
    if (onlyAnalyzed) rows = rows.filter((c) => c.matchedCompany != null);
    if (nameQ) rows = rows.filter((c) => c.name.toLowerCase().includes(nameQ));
    if (companyQ) rows = rows.filter((c) => c.company?.toLowerCase().includes(companyQ));
    if (titleQ) rows = rows.filter((c) => c.position?.toLowerCase().includes(titleQ));
    return [...rows].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "company") return (a.company ?? "").localeCompare(b.company ?? "");
      if (sortBy === "title") return (a.position ?? "").localeCompare(b.position ?? "");
      return new Date(b.connectedOn ?? 0).getTime() - new Date(a.connectedOn ?? 0).getTime();
    });
  }, [connections, filterName, filterCompany, filterTitle, onlyAnalyzed, sortBy]);

  const totalConnections = connections.length;

  return (
    <div className="px-10 pt-11 pb-20 max-w-[1320px] w-full">
      <PageHeader
        eyebrow="CONNECTIONS"
        title={totalConnections > 0 ? `${totalConnections.toLocaleString()} connections imported` : "No connections imported yet"}
        subcopy="Your own LinkedIn network — who you know, and where. Feeds warm-path outreach and company-suggestion confidence elsewhere in the app."
        actions={
          <>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              {totalConnections > 0 ? "Re-import connections" : "Import connections"}
            </Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={importConnections} />
          </>
        }
      />

      {totalConnections === 0 ? (
        <EmptyState
          title="Nothing imported yet"
          description="Export Connections.csv from LinkedIn (Settings & Privacy → Data privacy → Get a copy of your data) and import it above."
        />
      ) : (
        <>
          <SectionHeader
            eyebrow="01 — CAPTURED"
            title="Your network"
            meta={
              <Segmented
                options={[
                  { value: "company", label: "By company" },
                  { value: "person", label: "By person" },
                ]}
                value={view}
                onChange={setView}
              />
            }
          />

          {view === "company" ? (
            <div className="mb-11">
              <div className="text-xs text-neutral-600 mb-2 mt-1">Companies you&apos;re analyzing</div>
              <div className="mb-6">
                {analyzed.map((c) => (
                  <CompanyRowGroup
                    key={c.id}
                    label={c.name}
                    connections={c.connections}
                    defaultOpen={c.slug === deepLinkCompanySlug}
                  />
                ))}
                {analyzed.length === 0 && <div className="text-sm text-neutral-600 py-3">No company projects opened yet.</div>}
              </div>
              <div className="text-xs text-neutral-600 mb-2">Top companies by volume</div>
              <div className="max-h-[420px] overflow-y-auto">
                {topOther.map((c) => (
                  <CompanyRowGroup key={c.label} label={c.label} connections={c.connections} defaultOpen={false} />
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-11">
              <div className="flex items-center gap-3 mb-3">
                <Input value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="Name contains…" className="w-56" />
                <Input
                  value={filterCompany}
                  onChange={(e) => setFilterCompany(e.target.value)}
                  placeholder="Company contains…"
                  className="w-56"
                />
                <Input value={filterTitle} onChange={(e) => setFilterTitle(e.target.value)} placeholder="Title contains…" className="w-56" />
                <label className="flex items-center gap-1.5 text-xs text-neutral-700 ml-2">
                  <input type="checkbox" checked={onlyAnalyzed} onChange={(e) => setOnlyAnalyzed(e.target.checked)} />
                  At an analyzed company
                </label>
                <div className="ml-auto">
                  <Segmented
                    options={[
                      { value: "recent", label: "Most recent" },
                      { value: "name", label: "Name" },
                      { value: "company", label: "Company" },
                      { value: "title", label: "Title" },
                    ]}
                    value={sortBy}
                    onChange={setSortBy}
                  />
                </div>
              </div>

              <div className="max-h-[640px] overflow-y-auto border-b-2 border-divider">
                <Table>
                  <thead>
                    <tr>
                      <Th className="sticky top-0 bg-bg" style={{ width: 200 }}>Name</Th>
                      <Th className="sticky top-0 bg-bg">Company</Th>
                      <Th className="sticky top-0 bg-bg">Title</Th>
                      <Th className="sticky top-0 bg-bg text-right">Connected</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr key={c.id} className={c.matchedCompany ? "!bg-cool-tint" : ""} title={c.matchedCompany ? `At ${c.matchedCompany.name}` : undefined}>
                        <Td>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={c.name} size={26} />
                            {c.url ? (
                              <a href={c.url} target="_blank" rel="noreferrer" className="font-heading font-extrabold text-sm text-text">
                                {c.name}
                              </a>
                            ) : (
                              <span className="font-heading font-extrabold text-sm">{c.name}</span>
                            )}
                          </div>
                        </Td>
                        <Td className="text-sm">{c.company ?? "—"}</Td>
                        <Td className="text-sm text-neutral-700">{c.position ?? "—"}</Td>
                        <Td className="text-right text-xs text-neutral-700">
                          {c.connectedOn ? new Date(c.connectedOn).toLocaleDateString() : "—"}
                        </Td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <Td colSpan={4} className="text-center text-neutral-600 text-sm py-8">
                          No connections match these filters.
                        </Td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </div>
          )}

          <SectionHeader
            eyebrow="03 — DO NEXT"
            title="Companies you already have a way in"
            meta="From your tracker, not yet opened as a project"
          />
          {opportunities.length === 0 ? (
            <EmptyState title="No overlaps found" description="None of your un-promoted tracker companies match a connection's company yet." />
          ) : (
            <div className="max-h-[640px] overflow-y-auto">
            <CardGrid columns={2}>
              {opportunities.map((o) => (
                <Card key={o.trackerCompanyIds.join("-")}>
                  <div className="flex items-baseline justify-between mb-1">
                    <div className="font-heading font-extrabold text-[17px]">{o.name}</div>
                    <Tag variant="accent">
                      {o.connections.length} connection{o.connections.length === 1 ? "" : "s"}
                    </Tag>
                  </div>
                  {o.alsoMatchedNames && (
                    <div className="text-[11px] text-neutral-600 mb-2">
                      Also matched your tracker&apos;s &quot;{o.alsoMatchedNames.join('", "')}&quot; — likely the same
                      company logged twice, worth a quick check.
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5 mb-3.5 mt-2">
                    {o.connections.slice(0, 3).map((c) => (
                      <div key={c.id} className="text-xs text-neutral-800">
                        <span className="font-heading font-extrabold">{c.name}</span> — {c.position ? `${c.position} · ` : ""}
                        {c.company}
                      </div>
                    ))}
                    {o.connections.length > 3 && (
                      <div className="text-xs text-neutral-600">+{o.connections.length - 3} more</div>
                    )}
                  </div>
                  <Button variant="primary" onClick={() => openProject(o.name, o.sector)}>
                    Open project
                  </Button>
                </Card>
              ))}
            </CardGrid>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense>
      <ConnectionsPageContent />
    </Suspense>
  );
}
