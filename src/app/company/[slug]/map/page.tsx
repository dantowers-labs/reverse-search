"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

interface MapPerson {
  id: number;
  name: string | null;
  title: string | null;
  clusterLabel: string | null;
  x: number;
  y: number;
}

interface MapResponse {
  enabled: boolean;
  missingApiKey?: boolean;
  tooFew?: boolean;
  candidate: { x: number; y: number } | null;
  people: MapPerson[];
}

// Small, fixed, deterministic palette — cluster labels are dynamic per
// company, so colors are assigned by a stable hash of the label rather than
// a fixed lookup table.
const PALETTE = ["#1c3d5a", "#b02a13", "#5a7a1c", "#7a1c5a", "#1c7a6e", "#7a5a1c"];
function colorForLabel(label: string | null): string {
  if (!label) return "#9b9797";
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export default function VectorMapPage({ params }: PageProps<"/company/[slug]/map">) {
  const { slug } = use(params);
  const [companyName, setCompanyName] = useState("");
  const [data, setData] = useState<MapResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { companies } = await fetch("/api/companies").then((r) => r.json());
      const company = companies.find((c: { slug: string; name: string }) => c.slug === slug);
      if (!company || cancelled) return;
      setCompanyName(company.name);
      const res = await fetch(`/api/companies/${company.id}/embeddings-map`).then((r) => r.json());
      if (!cancelled) {
        setData(res);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) return null;

  if (!data?.enabled) {
    return (
      <div className="px-10 pt-9 pb-20 max-w-[1320px] w-full">
        <SectionHeader eyebrow="ANALYSIS" title="Vector map" />
        <EmptyState
          title={data?.missingApiKey ? "VOYAGE_API_KEY isn't set" : "This feature is off"}
          description={
            data?.missingApiKey
              ? "Enabled in Admin, but the vector map needs a Voyage AI API key to compute embeddings — add VOYAGE_API_KEY to .env and restart the app."
              : "The vector map plots captured profiles by text similarity using Voyage AI embeddings — off by default, since it sends captured profile text to a third-party service for this one feature. Turn it on from Admin to try it."
          }
          action={
            <Link href="/admin">
              <Button variant="secondary">Go to Admin</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (data.tooFew || !data.candidate) {
    return (
      <div className="px-10 pt-9 pb-20 max-w-[1320px] w-full">
        <SectionHeader eyebrow="ANALYSIS" title="Vector map" />
        <EmptyState title="Not enough captured profiles yet" description="Capture at least 2 people at this company to plot a map." />
      </div>
    );
  }

  const allX = [data.candidate.x, ...data.people.map((p) => p.x)];
  const allY = [data.candidate.y, ...data.people.map((p) => p.y)];
  const minX = Math.min(...allX), maxX = Math.max(...allX);
  const minY = Math.min(...allY), maxY = Math.max(...allY);
  const pad = 40;
  const size = 640;
  const scaleX = (x: number) => pad + ((x - minX) / (maxX - minX || 1)) * (size - pad * 2);
  const scaleY = (y: number) => pad + ((y - minY) / (maxY - minY || 1)) * (size - pad * 2);

  const labels = Array.from(new Set(data.people.map((p) => p.clusterLabel).filter((l): l is string => l != null)));

  return (
    <div className="px-10 pt-9 pb-20 max-w-[1320px] w-full">
      <SectionHeader
        eyebrow="ANALYSIS"
        title="Vector map"
        meta={`${companyName} — text-similarity, not fit score`}
      />
      <p className="text-[13px] text-neutral-700 max-w-[70ch] mb-2">
        Each point is a captured profile&apos;s title/headline/about/skills text, embedded via
        Voyage AI and projected to 2D — distance here means vocabulary similarity, not the
        LLM&apos;s fit judgment.
        A different lens on the same clusters, not a replacement score (see
        docs/METHODOLOGY.md in the repo for how this is computed).
      </p>
      <p className="text-[13px] text-neutral-700 max-w-[70ch] mb-6">
        The axes (PC1, PC2) aren&apos;t a named dimension like seniority or company size — they&apos;re
        just the two directions of most variance across everyone&apos;s embedding, computed fresh
        for this company. Only relative position carries meaning (who&apos;s near whom); the axis
        values themselves, and even which way is &quot;up,&quot; are arbitrary.
      </p>

      <svg viewBox={`0 0 ${size + 50} ${size + 40}`} width="100%" style={{ maxWidth: 690 }}>
        <rect x={50} y={0} width={size} height={size} className="fill-bg stroke-divider" />
        <text x={50 + size / 2} y={size + 28} textAnchor="middle" className="fill-neutral-600" style={{ font: "10px var(--font-mono)", letterSpacing: "0.08em" }}>
          PC1 →
        </text>
        <text
          x={16}
          y={size / 2}
          textAnchor="middle"
          className="fill-neutral-600"
          style={{ font: "10px var(--font-mono)", letterSpacing: "0.08em" }}
          transform={`rotate(-90, 16, ${size / 2})`}
        >
          PC2 →
        </text>
        <g transform="translate(50, 0)">
        {data.people.map((p) => (
          <circle
            key={p.id}
            cx={scaleX(p.x)}
            cy={scaleY(p.y)}
            r={7}
            fill={colorForLabel(p.clusterLabel)}
            fillOpacity={0.85}
          >
            <title>
              {(p.name ?? p.title ?? "Unnamed profile") + (p.clusterLabel ? ` — ${p.clusterLabel}` : "")}
            </title>
          </circle>
        ))}
        <polygon
          points={`${scaleX(data.candidate.x)},${scaleY(data.candidate.y) - 9} ${scaleX(data.candidate.x) + 9},${scaleY(data.candidate.y)} ${scaleX(data.candidate.x)},${scaleY(data.candidate.y) + 9} ${scaleX(data.candidate.x) - 9},${scaleY(data.candidate.y)}`}
          fill="var(--color-text)"
        >
          <title>You</title>
        </polygon>
        </g>
      </svg>

      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-neutral-700">
          <span className="inline-block w-2.5 h-2.5" style={{ background: "var(--color-text)", transform: "rotate(45deg)" }} />
          You
        </div>
        {labels.map((label) => (
          <div key={label} className="flex items-center gap-1.5 font-mono text-[11px] text-neutral-700">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: colorForLabel(label) }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
