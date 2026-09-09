"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StaleBanner } from "@/components/ui/StaleBanner";
import { loadPendingImport, clearPendingImport } from "@/lib/sessionImportStore";
import type { CandidateDocExtraction, ProfileChangeSet } from "@/lib/schemas";

interface IngestResult {
  savedPath: string;
  fileType: string;
  fileName: string;
  extraction: CandidateDocExtraction;
  changeSet: ProfileChangeSet;
}

function ReviewContent() {
  const router = useRouter();
  const importId = useSearchParams().get("importId");
  const [pending] = useState<IngestResult | null>(() => loadPendingImport<IngestResult>(importId));
  const [checkedAdditive, setCheckedAdditive] = useState<Set<number>>(
    () => new Set(pending?.changeSet.additive.map((_, i) => i) ?? []),
  );
  const [checkedConflicting, setCheckedConflicting] = useState<Set<number>>(new Set());
  const [hasDependentAnalyses, setHasDependentAnalyses] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/candidate-profile")
      .then((r) => r.json())
      .then((res) => setHasDependentAnalyses(!!res.hasDependentAnalyses));
  }, []);

  function toggle(set: Set<number>, setSet: (s: Set<number>) => void, i: number) {
    const next = new Set(set);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSet(next);
  }

  async function applyChanges() {
    if (!pending) return;
    setBusy(true);
    const res = await fetch("/api/candidate-profile/apply-changes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        savedPath: pending.savedPath,
        fileType: pending.fileType,
        fileName: pending.fileName,
        extraction: pending.extraction,
        confirmedAdditive: pending.changeSet.additive.filter((_, i) => checkedAdditive.has(i)),
        confirmedConflicting: pending.changeSet.conflicting.filter((_, i) => checkedConflicting.has(i)),
      }),
    });
    setBusy(false);
    if (res.ok) {
      if (importId) clearPendingImport(importId);
      router.push("/candidate-profile");
    }
  }

  function discard() {
    if (importId) clearPendingImport(importId);
    router.push("/candidate-profile");
  }

  if (!pending) {
    return (
      <div className="px-10 pt-11 pb-20 max-w-[1100px] w-full">
        <EmptyState
          title="Nothing to review"
          description="This review link has expired or was opened in a different tab. Go back and re-upload the document."
          action={
            <Link href="/candidate-profile">
              <Button variant="primary">Back to candidate profile</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const nChecked = checkedAdditive.size + checkedConflicting.size;

  return (
    <div className="px-10 pt-11 pb-20 max-w-[1100px] w-full">
      <div className="flex items-center gap-4 border-b-2 border-divider pb-3.5">
        <Link href="/candidate-profile" className="font-mono text-[11px] tracking-[0.1em] no-underline text-text">
          ← BACK TO CANDIDATE PROFILE
        </Link>
        <span className="text-xs text-neutral-700">Leaving without applying changes nothing.</span>
        <Button variant="secondary" className="ml-auto" onClick={discard}>
          Discard import
        </Button>
      </div>

      <div className="my-6">
        <div className="font-mono text-[10px] tracking-[0.16em] text-accent mb-2.5">REVIEW BEFORE WRITING</div>
        <h1 className="text-[36px] m-0 mb-2 leading-tight tracking-tight">
          {pending.changeSet.additive.length + pending.changeSet.conflicting.length} proposed changes from {pending.fileName}
        </h1>
        <p className="text-[15px] text-neutral-800 max-w-[76ch] m-0">
          Additive changes are pre-selected. Conflicts are not: leaving one unchecked keeps what the profile already holds.
        </p>
      </div>

      {hasDependentAnalyses && (
        <div className="my-6">
          <StaleBanner reason="Applying these changes will mark this company's action plans and role-fit reads out of date." />
        </div>
      )}

      {pending.changeSet.additive.length > 0 && (
        <>
          <div className="flex items-baseline gap-3.5 border-b-2 border-divider pb-2 mb-1">
            <span className="font-mono text-[10px] tracking-[0.16em] text-accent">ADDITIVE</span>
            <h3 className="m-0 text-xl">New information, nothing overwritten</h3>
            <span className="ml-auto text-xs text-neutral-700">{pending.changeSet.additive.length} changes</span>
          </div>
          <div className="mb-10">
            {pending.changeSet.additive.map((c, i) => (
              <label key={i} className="grid gap-4 items-start py-4 border-b border-divider cursor-pointer" style={{ gridTemplateColumns: "24px 190px 1fr" }}>
                <input
                  type="checkbox"
                  checked={checkedAdditive.has(i)}
                  onChange={() => toggle(checkedAdditive, setCheckedAdditive, i)}
                  className="mt-1 accent-accent w-4 h-4"
                />
                <span className="font-mono text-[11px] leading-relaxed text-neutral-600">{c.field}</span>
                <span>
                  <span className="text-[15px] leading-relaxed block">{c.value}</span>
                  <span className="text-[13px] text-neutral-700 block mt-0.5">{c.description}</span>
                </span>
              </label>
            ))}
          </div>
        </>
      )}

      {pending.changeSet.conflicting.length > 0 && (
        <>
          <div className="flex items-baseline gap-3.5 border-b-2 border-divider pb-2 mb-1">
            <span className="font-mono text-[10px] tracking-[0.16em] text-accent">CONFLICTING</span>
            <h3 className="m-0 text-xl">Checking one overwrites what you have</h3>
            <span className="ml-auto text-xs text-neutral-700">{pending.changeSet.conflicting.length} changes</span>
          </div>
          <div className="mb-9">
            {pending.changeSet.conflicting.map((c, i) => (
              <label key={i} className="grid gap-4 items-start py-4 border-b border-divider cursor-pointer" style={{ gridTemplateColumns: "24px 190px 1fr 1fr" }}>
                <input
                  type="checkbox"
                  checked={checkedConflicting.has(i)}
                  onChange={() => toggle(checkedConflicting, setCheckedConflicting, i)}
                  className="mt-1 accent-accent w-4 h-4"
                />
                <span className="font-mono text-[11px] leading-relaxed text-neutral-600">{c.field}</span>
                <span className="border-l-2 border-neutral-400 pl-3">
                  <span className="font-mono text-[10px] text-neutral-600 block mb-1">CURRENT</span>
                  <span className="text-sm leading-relaxed text-neutral-700">{c.current}</span>
                </span>
                <span className="border-l-2 border-accent pl-3">
                  <span className="font-mono text-[10px] text-accent-700 block mb-1">PROPOSED</span>
                  <span className="text-sm leading-relaxed block">{c.proposed}</span>
                  <span className="text-xs text-neutral-700 block mt-1">{c.description}</span>
                </span>
              </label>
            ))}
          </div>
        </>
      )}

      {pending.changeSet.additive.length === 0 && pending.changeSet.conflicting.length === 0 && (
        <p className="text-sm text-neutral-700 mb-9">No changes detected.</p>
      )}

      <div className="flex items-center gap-3 border-t-2 border-divider pt-5">
        <Button variant="primary" onClick={applyChanges} disabled={busy || nChecked === 0}>
          Apply {nChecked} changes
        </Button>
        <Button variant="secondary" onClick={discard}>
          Discard import
        </Button>
        <span className="ml-auto text-xs text-neutral-700">Document is kept either way, under source documents.</span>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={null}>
      <ReviewContent />
    </Suspense>
  );
}
