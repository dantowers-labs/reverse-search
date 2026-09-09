"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card, CardGrid } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { StaleBanner } from "@/components/ui/StaleBanner";
import { getPersonDisplayName } from "@/lib/personDisplay";
import { getScoreInk } from "@/lib/scoreInk";

interface ClusterMember {
  id: number;
  mergedName: string | null;
  mergedTitle: string | null;
  mergedHeadline: string | null;
}

interface AssociatedPosting {
  jobPostingAnalysisId: number;
  jobPostingId: number;
  title: string;
  fitScore: number;
  verdict: string;
  associatedClusterBasis: string | null;
}

interface ClusterDetail {
  id: number;
  clusterLabel: string;
  aggregateSummary: string;
  fitScore: number;
  fitVerdict: string;
  alignmentReasoning: string;
  divergenceReasoning: string | null;
  company: { slug: string; name: string };
  members: ClusterMember[];
  associatedPostings: AssociatedPosting[];
}

export default function ClusterDetailPage({ params }: PageProps<"/company/[slug]/cluster/[clusterId]">) {
  const { slug, clusterId } = use(params);
  const [cluster, setCluster] = useState<ClusterDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/role-clusters/${clusterId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setCluster(data.cluster ?? null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [clusterId]);

  if (loading) return null;

  if (!cluster) {
    return (
      <div className="px-10 pt-9 pb-20 max-w-[1320px] w-full">
        <EmptyState title="Cluster not found" description="It may have been cleared by a re-analysis." />
      </div>
    );
  }

  return (
    <div className="px-10 pt-9 pb-20 max-w-[1320px] w-full">
      <Link href={`/company/${slug}/profiles`} className="font-mono text-[11px] tracking-[0.1em] no-underline text-text">
        ← BACK TO PROFILES
      </Link>

      <div className="flex items-end gap-5 mt-4 mb-10">
        <div>
          <h1 className="text-[44px] m-0 mb-1.5 leading-tight tracking-tight">{cluster.clusterLabel}</h1>
          <div className="text-base">{cluster.fitVerdict}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="font-heading font-extrabold text-[76px] leading-none" style={{ color: getScoreInk(cluster.fitScore) }}>
            {cluster.fitScore}
          </div>
          <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600">/100</div>
        </div>
      </div>

      <SectionHeader eyebrow="01 — CAPTURED" title="Who's in this cluster" meta={`${cluster.members.length} people`} />
      <CardGrid columns={3} className="mb-11">
        {cluster.members.map((m) => (
          <Card key={m.id} tone="captured" padding="sm">
            <div className="flex gap-3 items-start">
              <Avatar name={m.mergedName} size={30} />
              <div>
                <div className="font-heading font-extrabold text-sm">{getPersonDisplayName(m)}</div>
                <div className="text-xs text-neutral-700">{m.mergedHeadline ?? m.mergedTitle ?? ""}</div>
              </div>
            </div>
          </Card>
        ))}
        {cluster.members.length === 0 && (
          <p className="text-xs text-neutral-600 m-0">No members resolved — the captured profiles may have been deleted since this run.</p>
        )}
      </CardGrid>

      <SectionHeader eyebrow="02 — ANALYSIS" title="What this cluster is, and how it maps to you" />
      <CardGrid columns={2} className="mb-11">
        <Card>
          <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-2.5">WHAT THIS CLUSTER IS</div>
          <p className="text-[15px] leading-relaxed m-0 max-w-[74ch]">{cluster.aggregateSummary}</p>
        </Card>
        <Card>
          <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-2.5">HOW IT MAPS TO YOU</div>
          <p className="text-[15px] leading-relaxed m-0 max-w-[74ch]">{cluster.alignmentReasoning}</p>
        </Card>
      </CardGrid>

      {cluster.divergenceReasoning && (
        <div className="mb-11">
          <StaleBanner label="WHERE IT DIVERGES" reason={cluster.divergenceReasoning} />
        </div>
      )}

      {cluster.associatedPostings.length > 0 && (
        <>
          <SectionHeader eyebrow="02 — ANALYSIS" title="Captured postings in this cluster" />
          <div className="flex flex-col gap-2 mb-11">
            {cluster.associatedPostings.map((p) => (
              <Link
                key={p.jobPostingAnalysisId}
                href={`/company/${slug}/job/${p.jobPostingId}`}
                className="flex items-center gap-3 border-b border-divider pb-2.5 no-underline text-text"
              >
                <span className="font-mono text-sm" style={{ color: getScoreInk(p.fitScore) }}>
                  {p.fitScore}
                </span>
                <div className="flex-1">
                  <div className="font-heading font-extrabold text-sm">{p.title}</div>
                  <div className="text-xs text-neutral-700">{p.verdict}</div>
                </div>
                <Tag variant="neutral">{p.associatedClusterBasis}</Tag>
              </Link>
            ))}
          </div>
        </>
      )}

      <SectionHeader eyebrow="03 — DO NEXT" title="Sharpen this cluster" />
      <Card className="border border-divider">
        <p className="text-sm m-0 mb-3.5">Capture more profiles in this role to firm up the pattern.</p>
        <Link href={`/company/${slug}/profiles`}>
          <Button variant="primary">Go to Profiles</Button>
        </Link>
      </Card>
    </div>
  );
}
