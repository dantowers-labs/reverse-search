// Split at the first sentence boundary so long text collapses to one
// "paragraph" with a reveal, short text just renders in full — the disclosure
// pattern used for job-fit assessments and chat answers alike.
export function splitFirstParagraph(text: string): { first: string; rest: string | null } {
  if (text.length < 180) return { first: text, rest: null };
  const cut = text.indexOf(". ");
  if (cut === -1 || cut > text.length - 30) return { first: text, rest: null };
  return { first: text.slice(0, cut + 1), rest: text.slice(cut + 2) };
}
