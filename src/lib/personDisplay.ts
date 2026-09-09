// Name capture is best-effort (some screenshots don't show it, or the capture
// is malformed) — never fabricate one. This is the one place that decides what
// to show instead, so every screen falls back the same way.
export function getPersonDisplayName(person: { mergedName: string | null; mergedTitle: string | null }): string {
  return person.mergedName ?? person.mergedTitle ?? "Unnamed profile";
}

// Used to catch re-uploads of the same person within one company (e.g. the
// same profile turning up across overlapping LinkedIn searches) without
// choking on incidental case/whitespace differences between captures.
export function normalizePersonName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
