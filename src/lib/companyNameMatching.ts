// Pure string logic only — deliberately has zero imports (no prisma) so it's
// safe to import from client components. connectionMatching.ts re-exports
// these for its existing server-side callers; anything running in the
// browser (e.g. the profiles tab's shared-employer star) must import
// directly from here instead of from connectionMatching.ts, since that file
// pulls in Prisma's native SQLite bindings, which can't bundle for the browser.

// Only unambiguous legal-entity markers — deliberately NOT stripping words
// like "global"/"group"/"tech"/"holdings", since those are exactly the kind
// of word that distinguishes two genuinely different real companies (e.g.
// "Insight" vs "Insight Global" are different actual companies, not the same
// one written two ways — stripping "Global" there would wrongly conflate them).
const COMPANY_SUFFIXES = /\b(inc|llc|ltd|corp|corporation)\b\.?/gi;

// Loose, best-effort normalization — a free-text company field ("Northwind
// Data") won't always match how this app names a company ("Northwind") exactly.
// This is a candidates-to-confirm signal, not a guarantee.
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(COMPANY_SUFFIXES, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// The shared prefix-match predicate, on already-normalized strings —
// deliberately a PREFIX check (one must start with the other), not "contains
// anywhere" — containment-anywhere produces coincidental mid-word collisions
// (a 3-letter fragment like "ema" turns up inside "thyme market", "braemac",
// etc.), while a prefix relationship is what real name variants ("Northwind" /
// "Northwind Data", "MDS" / "Meridian Data Solutions", "Kestrel" / "Kestrel
// Data Management") actually look like once normalized.
export function isLooseCompanyMatch(a: string, b: string): boolean {
  if (a.length < 3 || b.length < 3) return false;
  return a.startsWith(b) || b.startsWith(a);
}
