"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Select, Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { DashedUploadCard } from "@/components/ui/DashedUploadCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { savePendingImport } from "@/lib/sessionImportStore";
import { countQuantifiedOutcomes, countCertificationLikeEntries } from "@/lib/insights/candidateProfileInsights";
import { splitFirstParagraph } from "@/lib/splitFirstParagraph";
import { useRunStatus } from "@/lib/runStatus/RunStatusContext";
import type { CandidateDocExtraction, CandidateProfileData, ProfileChangeSet } from "@/lib/schemas";

// Ground-coloured chip with a 1px cool border, for skills sitting on the
// cool-tinted surface — a raised/filled Tag would fight the tint instead of
// sitting quietly on it (design change order, candidate-profile §6).
function SkillChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center text-[11px] tracking-[0.02em] px-2.5 py-[3px] bg-bg border border-cool-rule text-text">
      {children}
    </span>
  );
}

// An unset target-criterion is a thing that needs the user, so it takes the
// accent per the colour-discipline rule — a bare "—" tells the reader
// nothing about whether it matters (design change order, candidate-profile §4).
function CriterionValue({ value, missingHint }: { value: string | null; missingHint: string }) {
  if (value) return <span>{value}</span>;
  return <span className="text-accent-700">Not set — {missingHint}</span>;
}

function ExperienceEntry({ e }: { e: CandidateProfileData["experience"][number] }) {
  const [expanded, setExpanded] = useState(false);
  const split = splitFirstParagraph(e.description);
  return (
    <div className="grid gap-5 py-4.5 border-b border-divider" style={{ gridTemplateColumns: "160px 1fr" }}>
      <div className="font-mono text-[11px] leading-relaxed text-neutral-600">{e.dates}</div>
      <div>
        <div className="font-heading font-extrabold text-base">{e.title}</div>
        <div className="text-[13px] text-neutral-700 mb-2">
          {e.company} {e.location && `· ${e.location}`}
        </div>
        <p className="text-sm leading-relaxed m-0 mb-2 max-w-[78ch]">
          {split.first}
          {split.rest && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="ml-1.5 text-xs text-accent-700 underline decoration-dotted bg-transparent border-0 cursor-pointer p-0"
            >
              Read the full entry
            </button>
          )}
          {split.rest && expanded && <span> {split.rest}</span>}
        </p>
      </div>
    </div>
  );
}

interface IngestResult {
  savedPath: string;
  fileType: string;
  fileName: string;
  extraction: CandidateDocExtraction;
  changeSet: ProfileChangeSet;
}

interface DocumentRow {
  id: number;
  fileType: string;
  fileName: string;
  ingestedAt: string;
}

export default function CandidateProfilePage() {
  const { start, complete, fail } = useRunStatus();
  const [profile, setProfile] = useState<CandidateProfileData | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [fileType, setFileType] = useState("cv");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const res = await fetch("/api/candidate-profile").then((r) => r.json());
    setProfile(res.profile?.data ?? null);
    setUpdatedAt(res.profile?.updatedAt ?? null);
    setDocuments(res.documents ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- plain fetch-on-mount, no compiler/Suspense boundary in use
    refresh();
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const runId = start("candidateProfileIngest", `Extracting ${file.name}`, "cross-referencing against your current profile");
    const form = new FormData();
    form.append("file", file);
    form.append("fileType", fileType);
    const res = await fetch("/api/candidate-profile/ingest", { method: "POST", body: form });
    const data = await res.json();
    e.target.value = "";
    if (!res.ok) {
      fail(runId, data.error ?? "Extraction failed");
      return;
    }
    const additiveCount = data.changeSet.additive.length;
    const conflictingCount = data.changeSet.conflicting.length;
    const importId = savePendingImport<IngestResult>(data as IngestResult);
    complete(
      runId,
      `${additiveCount + conflictingCount} proposed changes found — ${additiveCount} additive, ${conflictingCount} conflicting.`,
      `/candidate-profile/review?importId=${importId}`,
      "Review changes",
    );
  }

  const experience = profile?.experience ?? [];
  const quantifiedCount = countQuantifiedOutcomes(experience);
  const certCount = countCertificationLikeEntries(profile?.education ?? []);

  return (
    <div className="px-10 pt-11 pb-20 max-w-[1320px] w-full">
      <PageHeader
        eyebrow="CANDIDATE PROFILE"
        title={profile?.identity.name ?? "No profile yet"}
        subcopy={profile ? [profile.identity.headline, profile.identity.location].filter(Boolean).join(" · ") : undefined}
        actions={
          profile && (
            <div className="text-xs text-neutral-700 text-right">
              Built from {documents.length} document{documents.length === 1 ? "" : "s"}
              <br />
              {updatedAt && `Last updated ${new Date(updatedAt).toLocaleString()}`}
            </div>
          )
        }
      />

      {!profile ? (
        <EmptyState
          title="No candidate profile yet"
          description="Add a resume or LinkedIn export using the panel on the right to build your first profile."
        />
      ) : (
        <div className="grid gap-9" style={{ gridTemplateColumns: "1fr 340px" }}>
          <div>
            <SectionHeader eyebrow="01 — CAPTURED" title="Skills" />
            <div className="bg-cool-tint px-5 py-4.5 mb-11">
              <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-2.5">PRIMARY</div>
              <div className="flex flex-wrap gap-1.5 mb-4.5">
                {profile.skills.primary.map((s) => (
                  <SkillChip key={s}>{s}</SkillChip>
                ))}
              </div>
              <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-2.5">SECONDARY</div>
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.secondary.map((s) => (
                  <SkillChip key={s}>{s}</SkillChip>
                ))}
              </div>
            </div>

            <SectionHeader eyebrow="01 — CAPTURED" title="Experience" />
            <div className="flex flex-col mb-11">
              {experience.map((e, i) => (
                <ExperienceEntry key={i} e={e} />
              ))}
            </div>

            <SectionHeader eyebrow="02 — ANALYSIS" title="How this profile reads" />
            <div className="grid grid-cols-3 gap-[1px] bg-divider mb-11">
              <div className="bg-bg p-4">
                <div className="font-heading font-extrabold text-[15px] mb-1.5">Quantified outcomes</div>
                <p className="text-[13px] m-0 text-neutral-800">
                  {quantifiedCount} of {experience.length} experience entries name a figure (revenue, %, deal size, headcount).
                </p>
              </div>
              <div className="bg-bg p-4">
                <div className="font-heading font-extrabold text-[15px] mb-1.5">Certifications</div>
                <p className="text-[13px] m-0 text-neutral-800">
                  {certCount} recorded on the profile.
                </p>
              </div>
              <div className="bg-bg p-4 opacity-60">
                <div className="font-heading font-extrabold text-[15px] mb-1.5">How this profile frames you</div>
                <p className="text-[13px] m-0 text-neutral-800">
                  Not computed yet — ask in a company&apos;s Chat tab for a grounded read against that company&apos;s captured profiles.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-cool-tint p-6">
            <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-2.5">TARGET CRITERIA</div>
            <table className="w-full text-sm border-collapse mb-6">
              <tbody>
                <tr>
                  <td className="py-1.5 text-neutral-700 w-[100px] align-top">Sectors</td>
                  <td className="py-1.5">{profile.targetCriteria.targetSectors.join(", ") || <CriterionValue value={null} missingHint="name a sector to sharpen ranking" />}</td>
                </tr>
                <tr>
                  <td className="py-1.5 text-neutral-700 align-top">Comp floor</td>
                  <td className="py-1.5">
                    <CriterionValue value={profile.targetCriteria.compFloor} missingHint="add one to sharpen ranking" />
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 text-neutral-700 align-top">Relocation</td>
                  <td className="py-1.5">
                    <CriterionValue value={profile.targetCriteria.relocation} missingHint="state your stance to sharpen ranking" />
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 text-neutral-700 align-top">Deal-breakers</td>
                  <td className="py-1.5">{profile.targetCriteria.dealBreakers.join(", ") || <CriterionValue value={null} missingHint="name one to sharpen ranking" />}</td>
                </tr>
              </tbody>
            </table>

            <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-3.5">SOURCE DOCUMENTS</div>
            <div className="flex flex-col mb-6">
              {documents.map((d) => (
                <div key={d.id} className="py-2.5 border-b border-divider">
                  <div className="text-[13px] font-heading font-extrabold">{d.fileName}</div>
                  <div className="font-mono text-[10px] text-neutral-600">
                    {d.fileType.toUpperCase()} · {new Date(d.ingestedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
              {documents.length === 0 && <p className="text-xs text-neutral-600">No documents ingested yet.</p>}
            </div>

            <DashedUploadCard title="Add material" description="Nothing is written until you review the proposed changes.">
              <Field label="Document type">
                <Select value={fileType} onChange={(e) => setFileType(e.target.value)}>
                  <option value="cv">Resume / CV</option>
                  <option value="linkedin">LinkedIn export</option>
                  <option value="cover_letter">Cover letter</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
              <Button variant="primary" block onClick={() => fileInputRef.current?.click()} type="button">
                Choose file
              </Button>
              <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.md,.csv" onChange={handleUpload} className="hidden" />
            </DashedUploadCard>
          </div>
        </div>
      )}
    </div>
  );
}
