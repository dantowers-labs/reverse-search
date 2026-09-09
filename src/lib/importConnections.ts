import Papa from "papaparse";
import { prisma } from "./prisma";

interface ConnectionRow {
  "First Name": string;
  "Last Name": string;
  URL: string;
  "Email Address": string;
  Company: string;
  Position: string;
  "Connected On": string;
}

// LinkedIn's export prepends a "Notes:" disclaimer paragraph before the real
// header row — strip everything up to the actual "First Name,Last Name,..."
// line so Papa.parse sees a clean header.
function stripPreamble(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const headerIndex = lines.findIndex((l) => l.startsWith("First Name,Last Name"));
  if (headerIndex === -1) throw new Error('Could not find the "First Name,Last Name,..." header row in this file');
  return lines.slice(headerIndex).join("\n");
}

function parseConnectedOn(raw: string): Date | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Full-refresh import — delete and reload, same pattern as TrackerCompany.
// This is the candidate's own manually-exported 1st-degree network, never
// scraped; re-running this after a fresh export is the expected way to
// keep it current.
export async function importConnectionsCsv(raw: string) {
  const cleaned = stripPreamble(raw);
  const parsed = Papa.parse<ConnectionRow>(cleaned, { header: true, skipEmptyLines: true });

  const rows = parsed.data
    .map((row) => {
      const name = `${row["First Name"]?.trim() ?? ""} ${row["Last Name"]?.trim() ?? ""}`.trim();
      if (!name) return null;
      return {
        name,
        company: row.Company?.trim() || null,
        position: row.Position?.trim() || null,
        url: row.URL?.trim() || null,
        email: row["Email Address"]?.trim() || null,
        connectedOn: row["Connected On"] ? parseConnectedOn(row["Connected On"]) : null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  await prisma.$transaction([
    prisma.connection.deleteMany(),
    prisma.connection.createMany({ data: rows }),
  ]);

  return { rowsRead: parsed.data.length, connectionsImported: rows.length };
}
