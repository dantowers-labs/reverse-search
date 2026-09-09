import { readFileSync } from "fs";
import Papa from "papaparse";
import { prisma } from "./prisma";

export type TrackerFieldTarget =
  | "ignore"
  | "company"
  | "sector"
  | "role"
  | "status"
  | "date"
  | "notes"
  | "priority"
  | "extra";

export interface TrackerCsvPreview {
  headers: string[];
  previewRows: Record<string, string>[];
  totalRows: number;
  guessedMapping: Record<string, TrackerFieldTarget>;
}

// Best-effort header-name matching, shown to the user as a starting point —
// they confirm or correct it on the mapping wizard, nothing is committed
// from a guess alone. File-path-like columns and "source" default to
// ignored rather than kept, since they're rarely useful on the company
// record itself; everything else unmatched defaults to "extra" (kept,
// unanalyzed) rather than silently dropped.
function guessTarget(header: string): TrackerFieldTarget {
  const h = header.toLowerCase();
  if (/company|employer/.test(h)) return "company";
  if (/sector|industry/.test(h)) return "sector";
  if (/\brole\b|title|position/.test(h)) return "role";
  if (/status|outcome/.test(h)) return "status";
  if (/date/.test(h)) return "date";
  if (/note/.test(h)) return "notes";
  if (/priority|fit.?rating|rank/.test(h)) return "priority";
  if (/file$/.test(h) || h === "source") return "ignore";
  return "extra";
}

// Step 1 of the mapping wizard: parse the CSV and propose a mapping, without
// writing anything.
export function parseTrackerCsv(csvPath: string): TrackerCsvPreview {
  const raw = readFileSync(csvPath, "utf-8");
  const parsed = Papa.parse<Record<string, string>>(raw, { header: true, skipEmptyLines: true });
  const headers = parsed.meta.fields ?? [];
  const guessedMapping: Record<string, TrackerFieldTarget> = {};
  for (const h of headers) guessedMapping[h] = guessTarget(h);

  return {
    headers,
    previewRows: parsed.data.slice(0, 3),
    totalRows: parsed.data.length,
    guessedMapping,
  };
}

// Step 2: commit using a user-confirmed column mapping. Rows are grouped by
// the mapped company column (one company can span many application rows);
// the most recent row (by the mapped date column, if any) drives role/status,
// and every row contributes to a synthesized notes summary — same shape the
// original hardcoded importer produced, just driven by a real mapping now
// instead of assumed column names.
export async function commitTrackerImport(csvPath: string, mapping: Record<string, TrackerFieldTarget>) {
  const raw = readFileSync(csvPath, "utf-8");
  const parsed = Papa.parse<Record<string, string>>(raw, { header: true, skipEmptyLines: true });

  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  const extraColumnsPolicy = settings?.trackerExtraColumnsPolicy ?? "keepUnanalyzed";

  const headerFor = (target: TrackerFieldTarget) => Object.entries(mapping).find(([, t]) => t === target)?.[0];
  const companyHeader = headerFor("company");
  if (!companyHeader) throw new Error("A column must be mapped to Company name");
  const dateHeader = headerFor("date");
  const sectorHeader = headerFor("sector");
  const roleHeader = headerFor("role");
  const statusHeader = headerFor("status");
  const notesHeader = headerFor("notes");
  const priorityHeader = headerFor("priority");
  const extraHeaders = Object.entries(mapping)
    .filter(([, t]) => t === "extra")
    .map(([h]) => h);

  const byCompany = new Map<string, Record<string, string>[]>();
  for (const row of parsed.data) {
    const company = row[companyHeader]?.trim();
    if (!company) continue;
    const list = byCompany.get(company) ?? [];
    list.push(row);
    byCompany.set(company, list);
  }

  const existing = await prisma.trackerCompany.findMany({
    where: { name: { in: [...byCompany.keys()] } },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((e) => e.name));

  let matched = 0;
  let created = 0;
  for (const [company, rows] of byCompany) {
    if (dateHeader) rows.sort((a, b) => ((a[dateHeader] ?? "") < (b[dateHeader] ?? "") ? 1 : -1));
    const latest = rows[0];

    const sector = sectorHeader ? rows.find((r) => r[sectorHeader]?.trim())?.[sectorHeader]?.trim() || null : null;
    const role = roleHeader ? latest[roleHeader]?.trim() || null : null;
    const status = statusHeader ? latest[statusHeader]?.trim() || null : null;
    const noteText = notesHeader ? latest[notesHeader]?.trim() : "";
    const dateText = dateHeader ? latest[dateHeader]?.trim() : "";
    let summary = `${rows.length} application(s) in tracker. Most recent: "${role ?? "unknown role"}" — ${status || "unknown status"}${dateText ? ` (${dateText})` : ""}.${noteText ? ` Notes: ${noteText}` : ""}`;

    let priority: number | null = null;
    if (priorityHeader) {
      const rawValue = latest[priorityHeader]?.trim();
      const n = rawValue ? Number(rawValue) : NaN;
      priority = Number.isFinite(n) ? n : null;
    }

    const extraFields: Record<string, string> = {};
    if (extraColumnsPolicy !== "drop") {
      for (const h of extraHeaders) {
        const v = latest[h]?.trim();
        if (v) extraFields[h] = v;
      }
    }
    if (extraColumnsPolicy === "foldIntoNotes" && Object.keys(extraFields).length > 0) {
      summary += ` ${Object.entries(extraFields).map(([k, v]) => `${k}: ${v}`).join("; ")}.`;
    }
    const extraFieldsJson = extraColumnsPolicy === "keepUnanalyzed" ? JSON.stringify(extraFields) : "{}";

    await prisma.trackerCompany.upsert({
      where: { name: company },
      update: {
        sector,
        role,
        status,
        notes: summary,
        priority,
        extraFieldsJson,
        lastSeenAt: new Date(),
      },
      create: {
        name: company,
        sector,
        role,
        status,
        notes: summary,
        priority,
        extraFieldsJson,
      },
    });
    if (existingNames.has(company)) matched += 1;
    else created += 1;
  }

  return { rowsRead: parsed.data.length, companiesUpserted: matched + created, companiesMatched: matched, companiesCreated: created };
}

// Headless convenience for the CLI seed script: parse, take the guessed
// mapping as-is, commit. The UI flow never calls this — it always shows the
// guess for confirmation first.
export async function runFullImport(csvPath: string) {
  const preview = parseTrackerCsv(csvPath);
  return commitTrackerImport(csvPath, preview.guessedMapping);
}
