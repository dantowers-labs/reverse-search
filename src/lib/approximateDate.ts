// LinkedIn profile dates are rarely more precise than month/year (sometimes
// just a year), so extraction emits free text ("2023-01", "2023") rather
// than a date the model would have to invent day-precision for. This turns
// that best-effort string into a real Date at persistence time — day 1 of
// the month/year, since only relative ordering (who joined more recently)
// matters for the tenure analysis this feeds, not the exact day.
export function parseApproximateDate(raw: string | null): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const yearMonth = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (yearMonth) return new Date(Number(yearMonth[1]), Number(yearMonth[2]) - 1, 1);
  const yearOnly = /^(\d{4})$/.exec(trimmed);
  if (yearOnly) return new Date(Number(yearOnly[1]), 0, 1);
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
