// Shared by the candidate-document review screen and the CSV mapping wizard:
// both navigate to a real URL after an upload/parse, but the payload that URL
// needs (a proposed change set, a column-mapping preview) is already fully in
// the client's hands and doesn't need to live in the database — this is a
// single-user, single-machine app, so losing an in-progress review on an
// accidental refresh is a minor annoyance, not data loss (the source file is
// still on disk; re-uploading re-triggers extraction).
const PREFIX = "reverse-search:import:";

export function savePendingImport<T>(data: T): string {
  const id = crypto.randomUUID();
  sessionStorage.setItem(PREFIX + id, JSON.stringify(data));
  return id;
}

export function loadPendingImport<T>(id: string | null): T | null {
  if (!id) return null;
  const raw = sessionStorage.getItem(PREFIX + id);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearPendingImport(id: string) {
  sessionStorage.removeItem(PREFIX + id);
}
