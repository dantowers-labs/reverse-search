"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card, CardGrid } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { getPersonDisplayName } from "@/lib/personDisplay";
import { isLiveRoundState } from "@/lib/interviewRoundState";

interface JobPostingRow {
  id: number;
  title: string;
}

interface PersonRow {
  id: number;
  mergedName: string | null;
  mergedTitle: string | null;
}

interface RoundRow {
  id: number;
  sequence: number;
  stage: string;
  date: string | null;
  state: string | null;
  interviewerName: string;
  interviewerPersonId: number | null;
  guideJson: string | null;
}

interface EventRow {
  id: number;
  type: "round" | "opened" | "contact";
  date: string;
  note: string | null;
  roundId: number | null;
}

interface InterviewRow {
  id: number;
  jobPostingId: number | null;
  jobPosting: { id: number; title: string } | null;
  label: string | null;
  disposition: string | null;
  createdAt: string;
  rounds: RoundRow[];
  events: EventRow[];
}

interface TimelineEntry {
  key: string;
  date: string | null; // null only for the synthetic NEXT row
  dotSize: number;
  accent: boolean;
  title: string;
  sub: string;
  href: string | null;
  isNext?: boolean;
}


export default function InterviewsTab({ params }: PageProps<"/company/[slug]/interviews">) {
  const { slug } = use(params);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [jobPostings, setJobPostings] = useState<JobPostingRow[]>([]);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [interviews, setInterviews] = useState<InterviewRow[]>([]);
  const [busy, setBusy] = useState(false);

  const [newJobPostingId, setNewJobPostingId] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const [targetInterviewId, setTargetInterviewId] = useState("");
  const [roundStage, setRoundStage] = useState("");
  const [roundInterviewerName, setRoundInterviewerName] = useState("");
  const [roundInterviewerPersonId, setRoundInterviewerPersonId] = useState("");
  const [roundDate, setRoundDate] = useState("");

  const [contactInterviewId, setContactInterviewId] = useState("");
  const [contactNote, setContactNote] = useState("");
  const [contactDate, setContactDate] = useState("");

  const [manageInterviewId, setManageInterviewId] = useState("");
  const [dispositionDraft, setDispositionDraft] = useState("");

  async function refresh() {
    const { companies } = await fetch("/api/companies").then((r) => r.json());
    const company = companies.find((c: { slug: string }) => c.slug === slug);
    if (!company) return;
    setCompanyId(company.id);
    setCompanyName(company.name);
    const [interviewsRes, jobsRes, peopleRes] = await Promise.all([
      fetch(`/api/companies/${company.id}/interviews`).then((r) => r.json()),
      fetch(`/api/companies/${company.id}/job-postings`).then((r) => r.json()),
      fetch(`/api/companies/${company.id}/people`).then((r) => r.json()),
    ]);
    setInterviews(interviewsRes.interviews ?? []);
    setJobPostings(jobsRes.jobPostings ?? []);
    setPeople(peopleRes.people ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- plain fetch-on-mount, no compiler/Suspense boundary in use
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    const interview = interviews.find((i) => String(i.id) === manageInterviewId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing an editable draft to the selected interview, not derived state
    setDispositionDraft(interview?.disposition ?? "");
  }, [manageInterviewId, interviews]);

  const timeline: TimelineEntry[] = useMemo(() => {
    const entries: TimelineEntry[] = [];
    for (const interview of interviews) {
      const title = interview.jobPosting?.title ?? interview.label ?? "Unlabeled opportunity";
      const roundsById = new Map(interview.rounds.map((r) => [r.id, r]));
      for (const event of interview.events) {
        if (event.type === "round") {
          const round = event.roundId != null ? roundsById.get(event.roundId) : undefined;
          if (!round) continue;
          const guideStatus = round.guideJson ? "guide ready" : "no guide yet";
          entries.push({
            key: `event-${event.id}`,
            date: event.date,
            dotSize: 11,
            accent: isLiveRoundState(round.state),
            title: `Round ${String(round.sequence).padStart(2, "0")} · ${round.stage}`,
            sub: `${round.interviewerName} — ${guideStatus}`,
            href: `/company/${slug}/round/${round.id}`,
          });
        } else if (event.type === "opened") {
          entries.push({
            key: `event-${event.id}`,
            date: event.date,
            dotSize: 7,
            accent: false,
            title: `Opportunity opened · ${title}`,
            sub: interview.jobPosting ? "Linked to a captured posting" : "Not linked to a posting yet",
            href: interview.jobPostingId ? `/company/${slug}/job/${interview.jobPostingId}` : null,
          });
        } else {
          entries.push({
            key: `event-${event.id}`,
            date: event.date,
            dotSize: 7,
            accent: false,
            title: "Contact logged",
            sub: event.note ?? "",
            href: null,
          });
        }
      }
    }
    entries.sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime());

    // Synthetic NEXT — the single most-recently-active still-open thread,
    // not a stored row. Matches the prototype's own example: shown even
    // while a round is already in progress, since it represents whatever
    // comes after, not a gap-filler for an idle thread.
    const open = interviews.filter((i) => i.disposition == null);
    const mostRecent = open
      .map((i) => ({
        interview: i,
        lastActivity: i.events.reduce((max, e) => (e.date > max ? e.date : max), i.createdAt),
      }))
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())[0];
    if (mostRecent) {
      const title = mostRecent.interview.jobPosting?.title ?? mostRecent.interview.label ?? "Unlabeled opportunity";
      entries.unshift({
        key: "next",
        date: null,
        dotSize: 11,
        accent: true,
        title: `Next round · ${title}`,
        sub: "Not yet scheduled — add it below",
        href: "#add-round",
        isNext: true,
      });
    }
    return entries;
  }, [interviews, slug]);

  async function createInterview(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    setBusy(true);
    await fetch(`/api/companies/${companyId}/interviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobPostingId: newJobPostingId ? Number(newJobPostingId) : null,
        label: newJobPostingId ? null : newLabel,
      }),
    });
    setBusy(false);
    setNewJobPostingId("");
    setNewLabel("");
    await refresh();
  }

  async function addRound(e: React.FormEvent) {
    e.preventDefault();
    if (!targetInterviewId || !roundStage.trim() || !roundInterviewerName.trim()) return;
    setBusy(true);
    await fetch(`/api/interviews/${targetInterviewId}/rounds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stage: roundStage,
        interviewerName: roundInterviewerName,
        interviewerPersonId: roundInterviewerPersonId ? Number(roundInterviewerPersonId) : null,
        date: roundDate || null,
      }),
    });
    setBusy(false);
    setRoundStage("");
    setRoundInterviewerName("");
    setRoundInterviewerPersonId("");
    setRoundDate("");
    await refresh();
  }

  async function logContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contactInterviewId || !contactNote.trim()) return;
    setBusy(true);
    await fetch(`/api/interviews/${contactInterviewId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: contactNote, date: contactDate || null }),
    });
    setBusy(false);
    setContactNote("");
    setContactDate("");
    await refresh();
  }

  async function saveDisposition() {
    if (!manageInterviewId) return;
    setBusy(true);
    await fetch(`/api/interviews/${manageInterviewId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disposition: dispositionDraft }),
    });
    setBusy(false);
    await refresh();
  }

  async function deleteInterview() {
    if (!manageInterviewId || !confirm("Delete this interview thread and all its rounds?")) return;
    setBusy(true);
    await fetch(`/api/interviews/${manageInterviewId}`, { method: "DELETE" });
    setBusy(false);
    setManageInterviewId("");
    await refresh();
  }

  const interviewOptions = interviews.map((i) => ({
    id: i.id,
    label: i.jobPosting?.title ?? i.label ?? "Unlabeled opportunity",
  }));

  return (
    <div className="px-10 pt-9 pb-20 max-w-[1000px] w-full">
      <SectionHeader eyebrow="01 — TRACKED" title="Interview timeline" meta={<span className="text-xs text-neutral-600">{interviews.length} thread{interviews.length === 1 ? "" : "s"}</span>} />

      {timeline.length === 0 ? (
        <EmptyState title="No interview activity tracked yet" description="Open an opportunity below once a process actually starts." />
      ) : (
        <div className="border-l-2 border-divider pl-6 mb-11">
          {timeline.map((entry) => {
            const body = (
              <div className="pb-6 relative">
                <div
                  className="absolute rounded-full border-2 border-bg"
                  style={{
                    left: -31,
                    top: 3,
                    width: entry.dotSize,
                    height: entry.dotSize,
                    background: entry.accent ? "var(--color-accent)" : "var(--color-neutral-400)",
                  }}
                />
                <div className="font-mono text-[10px] tracking-[0.1em] text-neutral-600 mb-1">
                  {entry.isNext ? "NEXT" : new Date(entry.date!).toLocaleDateString()}
                </div>
                <div className="font-heading font-extrabold text-sm">{entry.title}</div>
                <div className="text-xs text-neutral-700">{entry.sub}</div>
              </div>
            );
            return entry.href ? (
              <Link key={entry.key} href={entry.href} className="block no-underline text-inherit hover:bg-surface">
                {body}
              </Link>
            ) : (
              <div key={entry.key}>{body}</div>
            );
          })}
        </div>
      )}

      <SectionHeader eyebrow="03 — DO NEXT" title="Manage threads" />
      <CardGrid columns={2} className="mb-8">
        <Card>
          <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-3">NEW OPPORTUNITY</div>
          <form onSubmit={createInterview} className="flex flex-col gap-2.5">
            <Field label="Job posting">
              <Select value={newJobPostingId} onChange={(e) => setNewJobPostingId(e.target.value)}>
                <option value="">— Unlinked / TBD —</option>
                {jobPostings.map((jp) => (
                  <option key={jp.id} value={jp.id}>
                    {jp.title}
                  </option>
                ))}
              </Select>
            </Field>
            {!newJobPostingId && (
              <Field label="Label">
                <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. 'Referral via Jane'" />
              </Field>
            )}
            <Button type="submit" disabled={busy}>
              Open opportunity
            </Button>
          </form>
        </Card>

        <div id="add-round" className="scroll-mt-6">
          <Card>
            <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-3">ADD A ROUND</div>
            <form onSubmit={addRound} className="flex flex-col gap-2.5">
              <Field label="Thread">
                <Select value={targetInterviewId} onChange={(e) => setTargetInterviewId(e.target.value)}>
                  <option value="">— choose —</option>
                  {interviewOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Stage">
                <Input value={roundStage} onChange={(e) => setRoundStage(e.target.value)} placeholder="Recruiter screen, hiring manager…" />
              </Field>
              <Field label="Interviewer name">
                <Input value={roundInterviewerName} onChange={(e) => setRoundInterviewerName(e.target.value)} placeholder="Name" />
              </Field>
              <Field label="Link captured profile (optional)">
                <Select
                  value={roundInterviewerPersonId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setRoundInterviewerPersonId(id);
                    const person = people.find((p) => String(p.id) === id);
                    if (person) setRoundInterviewerName(getPersonDisplayName(person));
                  }}
                >
                  <option value="">— none captured —</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {getPersonDisplayName(p)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Date (optional — leave blank if not yet scheduled)">
                <Input type="date" value={roundDate} onChange={(e) => setRoundDate(e.target.value)} />
              </Field>
              <Button type="submit" disabled={busy || !targetInterviewId || !roundStage.trim() || !roundInterviewerName.trim()}>
                Add round
              </Button>
            </form>
          </Card>
        </div>

        <Card>
          <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-3">LOG A CONTACT TOUCHPOINT</div>
          <form onSubmit={logContact} className="flex flex-col gap-2.5">
            <Field label="Thread">
              <Select value={contactInterviewId} onChange={(e) => setContactInterviewId(e.target.value)}>
                <option value="">— choose —</option>
                {interviewOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="What happened">
              <Textarea value={contactNote} onChange={(e) => setContactNote(e.target.value)} rows={2} placeholder="e.g. 'Replied within a day, asked about...'" />
            </Field>
            <Field label="Date">
              <Input type="date" value={contactDate} onChange={(e) => setContactDate(e.target.value)} />
            </Field>
            <Button type="submit" disabled={busy || !contactInterviewId || !contactNote.trim()}>
              Log it
            </Button>
          </form>
        </Card>

        <Card>
          <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-3">THREAD STATUS</div>
          <div className="flex flex-col gap-2.5">
            <Field label="Thread">
              <Select value={manageInterviewId} onChange={(e) => setManageInterviewId(e.target.value)}>
                <option value="">— choose —</option>
                {interviewOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            {manageInterviewId && (
              <>
                <Field label="Disposition">
                  <Input
                    value={dispositionDraft}
                    onChange={(e) => setDispositionDraft(e.target.value)}
                    placeholder="e.g. 'offer', 'declined', 'passed over' — blank if still in progress"
                  />
                </Field>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={saveDisposition} disabled={busy}>
                    Save
                  </Button>
                  <button
                    onClick={deleteInterview}
                    disabled={busy}
                    className="text-[11px] text-accent-700 bg-transparent border-0 cursor-pointer disabled:opacity-40 p-0 ml-auto"
                  >
                    Delete thread
                  </button>
                </div>
              </>
            )}
          </div>
        </Card>
      </CardGrid>

      {people.length === 0 && (
        <p className="text-xs text-neutral-600 mb-0">
          No profiles captured at {companyName} yet — <Link href={`/company/${slug}/profiles`}>capture one</Link> to link an interviewer.
        </p>
      )}
    </div>
  );
}
