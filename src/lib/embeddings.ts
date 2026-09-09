// Voyage AI embeddings — Anthropic's own recommended embeddings partner.
// Plain fetch against their REST API rather than an SDK dependency; the
// request shape is small and stable enough not to warrant one. Requires
// VOYAGE_API_KEY (optional — the vector-map feature is simply unavailable
// without it). Captured profile text is sent to Voyage for this feature
// only; nothing else in the app calls out to a third party.

const VOYAGE_MODEL = "voyage-3.5";

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("VOYAGE_API_KEY is not set — the vector map needs it to compute embeddings.");
  }

  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: texts, model: VOYAGE_MODEL }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Voyage embeddings request failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}
