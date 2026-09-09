"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { getPersonDisplayName } from "@/lib/personDisplay";
import { splitFirstParagraph } from "@/lib/splitFirstParagraph";
import { useRunStatus } from "@/lib/runStatus/RunStatusContext";
import { INTERVIEW_ROUND_STATES, INTERVIEW_ROUND_STATE_LABELS } from "@/lib/interviewRoundState";
import type { InterviewGuide } from "@/lib/schemas";

interface InterviewerPerson {
  id: number;
  mergedName: string | null;
  mergedTitle: string | null;
  mergedHeadline: string | null;
  mergedAbout: string | null;
}

interface RoundDetail {
  id: number;
  sequence: number;
  stage: string;
  date: string | null;
  state: string | null;
  interviewerName: string;
  interviewerPersonId: number | null;
  interviewerPerson: InterviewerPerson | null;
  guideJson: string | null;
  guideGeneratedAt: string | null;
  notes: string | null;
  interview: {
    id: number;
    companyId: number;
    disposition: string | null;
    company: { slug: string; name: string };
    jobPosting: { id: number; title: string } | null;
  };
}

type Tab = "focus" | "questions" | "stories" | "askThem";

export default function RoundDetailPage({ params }: PageProps<"/company/[slug]/round/[roundId]">) {
  const { slug, roundId } = use(params);
  const { start, complete, fail } = useRunStatus();
  const [round, setRound] = useState<RoundDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("focus");
  const [notesDraft, setNotesDraft] = useState("");
  const [includeCrossOpportunity, setIncludeCrossOpportunity] = useState(true);
  const [showFullContext, setShowFullContext] = useState(false);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const data = await fetch(`/api/interview-rounds/${roundId}`).then((r) => r.json());
    const r: RoundDetail | null = data.round ?? null;
    setRound(r);
    setNotesDraft(r?.notes ?? "");
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- plain fetch-on-mount, no compiler/Suspense boundary in use
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId]);

  async function generateGuide() {
    if (!round) return;
    setBusy(true);
    const runId = start("generateInterviewGuide", `Prepping for ${round.stage}`, `${round.interview.company.name} · round ${round.sequence}`);
    const res = await fetch(`/api/interview-rounds/${round.id}/guide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includeCrossOpportunityContext: includeCrossOpportunity }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) fail(runId, data.error ?? "Guide generation failed");
    else complete(runId, "Interview guide ready.");
    await refresh();
  }

  async function saveNotes() {
    if (!round) return;
    setBusy(true);
    await fetch(`/api/interview-rounds/${round.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesDraft }),
    });
    setBusy(false);
    await refresh();
  }

  async function changeState(state: string) {
    if (!round) return;
    setBusy(true);
    await fetch(`/api/interview-rounds/${round.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
    setBusy(false);
    await refresh();
  }

  if (loading) return null;

  if (!round) {
    return (
      <div className="px-10 pt-9 pb-20 max-w-[1000px] w-full">
        <EmptyState title="Round not found" />
      </div>
    );
  }

  const guide: InterviewGuide | null = round.guideJson ? JSON.parse(round.guideJson) : null;
  const context = guide ? splitFirstParagraph(guide.interviewerContext) : null;
  const interviewerLabel = round.interviewerPerson ? getPersonDisplayName(round.interviewerPerson) : round.interviewerName;

  const TABS: { key: Tab; label: string }[] = [
    { key: "focus", label: "Likely focus areas" },
    { key: "questions", label: "Anticipated questions" },
    { key: "stories", label: "Stories to prepare" },
    { key: "askThem", label: "Questions to ask them" },
  ];

  return (
    <div className="px-10 pt-9 pb-20 max-w-[1000px] w-full">
      <Link href={`/company/${slug}/interviews`} className="font-mono text-[11px] tracking-[0.1em] no-underline text-text">
        ← {round.interview.company.name.toUpperCase()} · INTERVIEWS
      </Link>

      <div className="mt-4 mb-3">
        <div className="font-mono text-[11px] tracking-[0.1em] text-neutral-600 mb-1.5">
          ROUND {String(round.sequence).padStart(2, "0")} · {round.stage.toUpperCase()}
          {round.date ? ` · ${new Date(round.date).toLocaleDateString()}` : ""}
        </div>
        <div className="flex items-end justify-between gap-5">
          <h1 className="text-[40px] m-0 mb-1.5 leading-tight tracking-tight">{interviewerLabel}</h1>
          <select
            value={round.state ?? "NOT_SCHEDULED"}
            onChange={(e) => changeState(e.target.value)}
            disabled={busy}
            className="font-mono text-[10px] tracking-[0.1em] bg-transparent border border-divider px-2 py-1.5 mb-1.5"
          >
            {INTERVIEW_ROUND_STATES.map((s) => (
              <option key={s} value={s}>
                {INTERVIEW_ROUND_STATE_LABELS[s].toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <div className="text-[13px] text-neutral-700">
          {round.interviewerPerson?.mergedTitle ?? "No profile captured for this interviewer"}
          {round.interviewerPersonId && (
            <>
              {" · "}
              <Link href={`/company/${slug}/profiles`} className="text-text">
                view captured profile
              </Link>
            </>
          )}
        </div>
      </div>

      {!guide ? (
        <>
          <SectionHeader eyebrow="03 — DO NEXT · NO GUIDE YET" title="Generate a prep guide for this round" />
          <Card className="border border-divider">
            <label className="flex items-center gap-1.5 text-[11px] text-neutral-700 mb-3">
              <input
                type="checkbox"
                checked={includeCrossOpportunity}
                onChange={(e) => setIncludeCrossOpportunity(e.target.checked)}
              />
              include other interview threads at {round.interview.company.name} as secondary context
            </label>
            <Button variant="primary" onClick={generateGuide} disabled={busy}>
              Generate guide
            </Button>
          </Card>
        </>
      ) : (
        <>
          <div className="bg-cool-tint px-5 py-4 mb-8">
            <div className="font-mono text-[10px] tracking-[0.14em] text-cool mb-2">INTERVIEWER CONTEXT</div>
            <p className="text-[15px] leading-relaxed m-0 max-w-[74ch]">
              {context?.first}
              {context?.rest && !showFullContext && (
                <button
                  onClick={() => setShowFullContext(true)}
                  className="ml-1.5 text-xs text-accent-700 underline decoration-dotted bg-transparent border-0 cursor-pointer p-0"
                >
                  Read the full context
                </button>
              )}
              {context?.rest && showFullContext && <span> {context.rest}</span>}
            </p>
          </div>

          <div className="flex gap-2 mb-6 border-b-2 border-divider">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`bg-transparent border-0 px-4 pt-2 pb-2.5 -mb-0.5 font-heading font-extrabold text-sm cursor-pointer border-b-[3px] ${
                  tab === t.key ? "border-accent text-accent" : "border-transparent text-neutral-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-4 mb-11">
            {tab === "focus" &&
              guide.likelyFocusAreas.map((f, i) => (
                <div key={i}>
                  <div className="font-heading font-extrabold text-sm">{f.theme}</div>
                  <div className="text-sm text-neutral-700">{f.why}</div>
                </div>
              ))}
            {tab === "questions" &&
              guide.anticipatedQuestions.map((q, i) => (
                <div key={i}>
                  <div className="font-heading font-extrabold text-sm">{q.question}</div>
                  <div className="text-sm text-neutral-700">{q.prepGuidance}</div>
                </div>
              ))}
            {tab === "stories" &&
              guide.storiesToPrepare.map((s, i) => (
                <div key={i}>
                  <div className="font-heading font-extrabold text-sm">{s.prompt}</div>
                  <div className="text-sm text-neutral-700">{s.candidateAngle}</div>
                </div>
              ))}
            {tab === "askThem" &&
              guide.questionsToAskThem.map((q, i) => (
                <div key={i} className="text-sm">
                  {q}
                </div>
              ))}
          </div>

          {guide.continuityNotes && (
            <>
              <SectionHeader eyebrow="02 — ANALYSIS" title="Since last round" />
              <Card className="mb-8 border border-divider">
                <p className="text-sm leading-relaxed m-0">{guide.continuityNotes}</p>
              </Card>
            </>
          )}

          <SectionHeader eyebrow="03 — DO NEXT" title="Leave a note after the round" meta="Feeds the next round's guide automatically" />
          <Card className="mb-6 border border-divider">
            <Textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="What came up, how it went, anything the next round should account for…"
              rows={4}
              className="mb-2.5"
            />
            <Button variant="secondary" onClick={saveNotes} disabled={busy}>
              Save notes
            </Button>
          </Card>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[11px] text-neutral-700">
              <input
                type="checkbox"
                checked={includeCrossOpportunity}
                onChange={(e) => setIncludeCrossOpportunity(e.target.checked)}
              />
              include other threads
            </label>
            <Button variant="secondary" onClick={generateGuide} disabled={busy}>
              Regenerate guide
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
