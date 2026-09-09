"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Tooltip } from "@/components/ui/Tooltip";

interface OnboardingStatus {
  hasProfile: boolean;
  hasConnections: boolean;
  hasTrackerCompanies: boolean;
  hasCompanies: boolean;
}

interface ChecklistItem {
  key: keyof OnboardingStatus;
  label: string;
  optional?: boolean;
  href: string;
  tooltip: string;
}

const ITEMS: ChecklistItem[] = [
  {
    key: "hasProfile",
    label: "Set up your candidate profile",
    href: "/candidate-profile",
    tooltip: "Upload a resume or LinkedIn export. Nothing is written until you review the proposed changes — this feeds every fit score and outreach draft in the app.",
  },
  {
    key: "hasConnections",
    label: "Import your LinkedIn connections",
    optional: true,
    href: "/connections",
    tooltip: "Your own 1st-degree network — feeds warm-path outreach and boosts a company suggestion's confidence when you already know someone there.",
  },
  {
    key: "hasTrackerCompanies",
    label: "Import your target company list",
    optional: true,
    href: "/import-tracker/mapping",
    tooltip: "Your job-search tracker CSV — gives the suggestion engine a pool of companies to rank against your fit pattern once you've analyzed a couple.",
  },
  {
    key: "hasCompanies",
    label: "Create your first project",
    href: "/",
    tooltip: "Add a company manually below, or paste a job posting and one gets created automatically — then start capturing people's profiles to run a fit analysis.",
  },
];

export function GettingStartedChecklist() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);

  useEffect(() => {
    fetch("/api/onboarding/status")
      .then((r) => r.json())
      .then(setStatus);
  }, []);

  // Only the required steps (profile, first project) gate whether this shows
  // at all — the optional ones stay visible as suggestions, not nags.
  if (!status || (status.hasProfile && status.hasCompanies)) return null;

  return (
    <div className="border-2 border-divider mb-10">
      <div className="px-5 pt-4 pb-3 border-b-2 border-divider">
        <div className="font-mono text-[10px] tracking-[0.16em] text-accent mb-1.5">GETTING STARTED</div>
        <h3 className="m-0 text-lg">Set up your workspace</h3>
      </div>
      <div>
        {ITEMS.map((item) => {
          const done = status[item.key];
          return (
            <Link
              key={item.key}
              href={item.href}
              className="flex items-center gap-3 px-5 py-3 border-b border-divider last:border-b-0 no-underline text-text hover:bg-surface"
            >
              <input type="checkbox" checked={done} disabled readOnly className="accent-accent w-4 h-4 flex-none" />
              <span className="text-sm">
                {item.label}
                {item.optional && <span className="text-neutral-600"> (optional)</span>}
              </span>
              <Tooltip text={item.tooltip}>
                <span
                  className="w-4 h-4 flex-none border border-divider text-[10px] flex items-center justify-center text-neutral-600"
                  onClick={(e) => e.preventDefault()}
                >
                  i
                </span>
              </Tooltip>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
