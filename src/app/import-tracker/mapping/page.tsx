"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardGrid } from "@/components/ui/Card";
import { Table, Th, Td } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { Field, Input, Select } from "@/components/ui/Field";
import { Radio } from "@/components/ui/Radio";
import { useRunStatus } from "@/lib/runStatus/RunStatusContext";

type TrackerFieldTarget = "ignore" | "company" | "sector" | "role" | "status" | "date" | "notes" | "priority" | "extra";

const TARGET_OPTIONS: { value: TrackerFieldTarget; label: string }[] = [
  { value: "company", label: "Company name" },
  { value: "sector", label: "Sector" },
  { value: "role", label: "Role" },
  { value: "status", label: "Status" },
  { value: "date", label: "Date applied" },
  { value: "notes", label: "Notes" },
  { value: "priority", label: "Your priority" },
  { value: "extra", label: "Keep as extra field" },
  { value: "ignore", label: "Ignore" },
];

const MATCHED_TARGETS = new Set<TrackerFieldTarget>(["company", "sector", "role", "status", "date", "notes"]);

interface Preview {
  path: string;
  headers: string[];
  previewRows: Record<string, string>[];
  totalRows: number;
  guessedMapping: Record<string, TrackerFieldTarget>;
}

export default function MappingWizardPage() {
  const router = useRouter();
  const { start, complete, fail } = useRunStatus();
  const [path, setPath] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, TrackerFieldTarget>>({});
  const [rankingStrategy, setRankingStrategy] = useState("priorityFitTiebreak");
  const [extraColumnsPolicy, setExtraColumnsPolicy] = useState("keepUnanalyzed");
  const [loading, setLoading] = useState(false);
  const [usedRememberedMapping, setUsedRememberedMapping] = useState(false);
  const [lastMapping, setLastMapping] = useState<Record<string, TrackerFieldTarget> | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setRankingStrategy(data.settings.trackerRankingStrategy);
        setExtraColumnsPolicy(data.settings.trackerExtraColumnsPolicy);
        if (data.settings.trackerLastPath) setPath(data.settings.trackerLastPath);
        if (data.settings.trackerLastMappingJson) {
          try {
            setLastMapping(JSON.parse(data.settings.trackerLastMappingJson));
          } catch {
            setLastMapping(null);
          }
        }
      });
  }, []);

  async function loadCsv(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/import-tracker/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      alert(data.error ?? "Could not read that CSV");
      return;
    }
    setPreview(data);
    // Reuse the last confirmed mapping when this CSV has the exact same
    // columns as last time — same tracker file, no need to re-map.
    const sameColumns =
      lastMapping != null &&
      Object.keys(lastMapping).length === data.headers.length &&
      data.headers.every((h: string) => h in lastMapping);
    setUsedRememberedMapping(sameColumns);
    setMapping(sameColumns ? lastMapping! : data.guessedMapping);
  }

  async function saveSettings(next: {
    trackerRankingStrategy?: string;
    trackerExtraColumnsPolicy?: string;
    trackerLastPath?: string;
    trackerLastMappingJson?: string;
  }) {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
  }

  async function runImport() {
    if (!preview) return;
    const runId = start("importTracker", "Importing company list", `${preview.totalRows} rows · no API call`);
    const res = await fetch("/api/import-tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: preview.path, mapping }),
    });
    const data = await res.json();
    if (!res.ok) {
      fail(runId, data.error ?? "Import failed");
      return;
    }
    await saveSettings({ trackerLastPath: preview.path, trackerLastMappingJson: JSON.stringify(mapping) });
    complete(
      runId,
      `${data.rowsRead} rows read. ${data.companiesMatched} matched to existing projects, ${data.companiesCreated} newly created.`,
      "/",
      "View projects",
    );
    router.push("/");
  }

  const hasCompanyMapped = Object.values(mapping).includes("company");
  const mappedCount = preview ? preview.headers.filter((h) => mapping[h] !== "extra" && mapping[h] !== "ignore").length : 0;
  const needsConfirmCount = preview
    ? preview.headers.filter((h) => mapping[h] === "priority" || mapping[h] === "extra").length
    : 0;

  return (
    <div className="px-10 pt-11 pb-20 max-w-[1240px] w-full">
      <div className="flex items-center gap-4 border-b-2 border-divider pb-3.5">
        <Link href="/" className="font-mono text-[11px] tracking-[0.1em] no-underline text-text">
          ← BACK TO PROJECTS
        </Link>
        <span className="text-xs text-neutral-700">Nothing is imported until you confirm the mapping.</span>
        <Link href="/" className="ml-auto">
          <Button variant="secondary">Cancel import</Button>
        </Link>
      </div>

      <div className="my-6">
        <div className="font-mono text-[10px] tracking-[0.16em] text-accent mb-2.5">COMPANY LIST IMPORT</div>
        <h1 className="text-[36px] m-0 mb-2 leading-tight tracking-tight">Tell us how to read your tracker CSV</h1>
        <p className="text-[15px] text-neutral-800 max-w-[78ch] m-0">
          Only the company name is required. Everything else either becomes a field on the company, feeds the
          suggestion ranking, or is dropped.
        </p>
      </div>

      {!preview && (
        <Card className="mb-10 max-w-2xl border border-divider">
          <form onSubmit={loadCsv} className="flex flex-col gap-2">
            <Field label="CSV file path">
              <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/path/to/tracker.csv" />
            </Field>
            <Button type="submit" disabled={loading || !path.trim()}>
              {loading ? "Reading…" : "Load CSV"}
            </Button>
          </form>
        </Card>
      )}

      {preview && (
        <>
          <div className="flex items-baseline gap-3.5 border-b-2 border-divider pb-2 mb-4">
            <span className="font-mono text-[10px] tracking-[0.16em] text-accent">01 — WHAT WE READ</span>
            <h3 className="m-0 text-xl">First {preview.previewRows.length} rows</h3>
            <span className="ml-auto text-xs text-neutral-700">{preview.totalRows} rows · header row detected</span>
          </div>

          <div className="mb-11">
            <Table>
              <thead>
                <tr>
                  {preview.headers.map((h) => (
                    <Th key={h}>{h}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.previewRows.map((row, i) => (
                  <tr key={i}>
                    {preview.headers.map((h) => (
                      <Td key={h}>{row[h]}</Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <div className="flex items-baseline gap-3.5 border-b-2 border-divider pb-2 mb-1">
            <span className="font-mono text-[10px] tracking-[0.16em] text-accent">02 — MAPPING</span>
            <h3 className="m-0 text-xl">Where each column goes</h3>
            <span className="ml-auto text-xs text-neutral-700">
              {usedRememberedMapping
                ? "Same columns as last time — your confirmed mapping was reused"
                : `${mappedCount} mapped · ${needsConfirmCount} need a decision`}
            </span>
          </div>

          <div className="mb-11">
            {preview.headers.map((h) => {
              const target = mapping[h];
              const sample = preview.previewRows.map((r) => r[h]).filter(Boolean).slice(0, 3).join(", ");
              const note =
                target === "company"
                  ? "REQUIRED · MATCHED"
                  : target === "ignore"
                    ? "NOT USED"
                    : MATCHED_TARGETS.has(target)
                      ? "MATCHED"
                      : "GUESSED · CONFIRM";
              return (
                <div key={h} className="grid gap-5 items-center py-3 border-b border-divider" style={{ gridTemplateColumns: "180px 1fr 260px 150px" }}>
                  <span className="font-mono text-xs">{h}</span>
                  <span className="text-[13px] text-neutral-700 truncate">{sample}</span>
                  <Select value={target} onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value as TrackerFieldTarget }))}>
                    {TARGET_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                  <span className={`font-mono text-[10px] tracking-[0.1em] ${note === "GUESSED · CONFIRM" ? "text-accent-700" : "text-neutral-600"}`}>
                    {note}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-baseline gap-3.5 border-b-2 border-divider pb-2 mb-5">
            <span className="font-mono text-[10px] tracking-[0.16em] text-accent">03 — HOW IT DRIVES SUGGESTIONS</span>
            <h3 className="m-0 text-xl">Your priority, our read, or both</h3>
          </div>

          <CardGrid columns={2} className="mb-8">
            <Card>
              <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-3.5">RANK THE SUGGESTION STRIP BY</div>
              <div className="flex flex-col gap-3">
                <Radio name="rank" checked={rankingStrategy === "priorityOnly"} onChange={() => { setRankingStrategy("priorityOnly"); saveSettings({ trackerRankingStrategy: "priorityOnly" }); }}>
                  My priority column only
                </Radio>
                <Radio name="rank" checked={rankingStrategy === "priorityFitTiebreak"} onChange={() => { setRankingStrategy("priorityFitTiebreak"); saveSettings({ trackerRankingStrategy: "priorityFitTiebreak" }); }}>
                  My priority first, our fit read as the tiebreak
                </Radio>
                <Radio name="rank" checked={rankingStrategy === "fitOnly"} onChange={() => { setRankingStrategy("fitOnly"); saveSettings({ trackerRankingStrategy: "fitOnly" }); }}>
                  Our fit read only — ignore my column
                </Radio>
              </div>
            </Card>
            <Card>
              <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-3.5">EXTRA COLUMNS WE DID NOT RECOGNISE</div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {preview.headers.filter((h) => mapping[h] === "extra").map((h) => (
                  <Tag key={h} variant="neutral">{h}</Tag>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                <Radio name="extra" checked={extraColumnsPolicy === "keepUnanalyzed"} onChange={() => { setExtraColumnsPolicy("keepUnanalyzed"); saveSettings({ trackerExtraColumnsPolicy: "keepUnanalyzed" }); }}>
                  Keep them on the company record, unanalyzed
                </Radio>
                <Radio name="extra" checked={extraColumnsPolicy === "foldIntoNotes"} onChange={() => { setExtraColumnsPolicy("foldIntoNotes"); saveSettings({ trackerExtraColumnsPolicy: "foldIntoNotes" }); }}>
                  Fold them into the notes field
                </Radio>
                <Radio name="extra" checked={extraColumnsPolicy === "drop"} onChange={() => { setExtraColumnsPolicy("drop"); saveSettings({ trackerExtraColumnsPolicy: "drop" }); }}>
                  Drop them
                </Radio>
              </div>
            </Card>
          </CardGrid>

          <div className="flex items-center gap-3 border-t-2 border-divider pt-5">
            <Button variant="primary" onClick={runImport} disabled={!hasCompanyMapped}>
              Import {preview.totalRows} rows
            </Button>
            <Link href="/">
              <Button variant="secondary">Cancel</Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
