"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getScoreInk } from "@/lib/scoreInk";

interface CompanySummary {
  id: number;
  slug: string;
  name: string;
  sector: string | null;
  personCount: number;
  jobPostingCount: number;
  interviewCount: number;
  connectionCount: number;
  latestAnalysis: { overallScore: number } | null;
}

const TABS = [
  { key: "profiles", label: "Profiles" },
  { key: "jobs", label: "Job descriptions" },
  { key: "interviews", label: "Interviews" },
  { key: "chat", label: "Chat" },
];

export default function CompanyLayout({ children, params }: LayoutProps<"/company/[slug]">) {
  const { slug } = use(params);
  const pathname = usePathname();
  const [company, setCompany] = useState<CompanySummary | null>(null);

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data) => setCompany(data.companies?.find((c: CompanySummary) => c.slug === slug) ?? null));
  }, [slug]);

  const activeTab = TABS.find((t) => pathname.includes(`/${t.key}`))?.key ?? null;
  const tabCount = (key: string) =>
    key === "profiles"
      ? company?.personCount
      : key === "jobs"
        ? company?.jobPostingCount
        : key === "interviews"
          ? company?.interviewCount
          : null;

  return (
    <div className="w-full flex flex-col items-center">
      <div className="px-10 pt-7 max-w-[1320px] w-full">
        <Link href="/" className="font-mono text-[11px] tracking-[0.1em] no-underline text-text">
          ← ALL PROJECTS
        </Link>
        <div className="flex items-end gap-5 mt-4">
          <div>
            <h1 className="text-[40px] m-0 mb-1.5 leading-tight tracking-tight">{company?.name ?? slug}</h1>
            <div className="text-[13px] text-neutral-700">
              {company?.sector ?? "Sector not set"}
              {company != null && ` · project opened`}
            </div>
            {company != null && (
              <Link href={`/connections?company=${company.slug}`} className="font-mono text-[11px] text-cool no-underline hover:underline">
                {company.connectionCount > 0
                  ? `${company.connectionCount} connection${company.connectionCount === 1 ? "" : "s"} here`
                  : "no connections here yet"}
              </Link>
            )}
          </div>
          <div className="ml-auto text-right">
            {company != null && (
              <>
                <Link href={`/company/${slug}/report`} className="font-mono text-[10px] tracking-[0.08em] text-neutral-600 no-underline hover:underline block mb-1">
                  SUMMARY ↗
                </Link>
                <Link href={`/company/${slug}/map`} className="font-mono text-[10px] tracking-[0.08em] text-neutral-600 no-underline hover:underline block mb-2">
                  MAP ↗
                </Link>
              </>
            )}
            {company?.latestAnalysis && (
              <>
                <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 mb-1.5">OVERALL FIT</div>
                <div
                  className="font-heading font-extrabold text-[34px] leading-none"
                  style={{ color: getScoreInk(company.latestAnalysis.overallScore) }}
                >
                  {company.latestAnalysis.overallScore}
                  <span className="text-base text-neutral-600">/100</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex px-10 mt-6 border-b-2 border-divider max-w-[1320px] w-full">
        {TABS.map((t) => {
          const isActive = activeTab === t.key;
          const count = tabCount(t.key);
          return (
            <Link
              key={t.key}
              href={`/company/${slug}/${t.key}`}
              className={`bg-transparent border-0 px-5 pt-3 pb-2.5 -mb-0.5 font-heading font-extrabold text-sm no-underline flex items-center gap-2 border-b-[3px] ${
                isActive ? "border-accent text-accent" : "border-transparent text-neutral-700"
              }`}
            >
              {t.label}
              {count != null && <span className="font-mono text-[11px] opacity-70">{count}</span>}
            </Link>
          );
        })}
      </div>

      <div className="w-full flex flex-col items-center">{children}</div>
    </div>
  );
}
