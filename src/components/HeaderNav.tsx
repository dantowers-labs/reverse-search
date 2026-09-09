"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useRunStatus } from "@/lib/runStatus/RunStatusContext";

const NAV_LINKS = [
  { href: "/", label: "Companies", isActive: (path: string) => path === "/" || path.startsWith("/company") },
  { href: "/candidate-profile", label: "Candidate profile", isActive: (path: string) => path.startsWith("/candidate-profile") },
  { href: "/connections", label: "Connections", isActive: (path: string) => path.startsWith("/connections") },
  { href: "/admin", label: "Admin", isActive: (path: string) => path.startsWith("/admin") },
];

export function HeaderNav() {
  const pathname = usePathname();
  const { completedRun } = useRunStatus();
  const [spend, setSpend] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/spend-summary")
      .then((res) => res.json())
      .then((data) => setSpend(data.last30dTotal))
      .catch(() => setSpend(null));
    // A completed run implies new ApiCall rows exist — refetch so the figure stays live.
  }, [completedRun]);

  return (
    <div className="flex items-center gap-7 px-10 py-3.5 border-b-2 border-divider bg-bg sticky top-0 z-20">
      <Link href="/" className="font-heading font-extrabold text-lg tracking-tight no-underline text-text">
        Reverse Search
      </Link>
      {NAV_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`text-sm no-underline ${link.isActive(pathname) ? "text-text font-semibold" : "text-neutral-600 hover:text-text"}`}
        >
          {link.label}
        </Link>
      ))}
      <div className="ml-auto flex items-center gap-3.5">
        <span className="font-mono text-[11px] text-neutral-600">
          {spend != null ? `$${spend.toFixed(2)} spent this month` : ""}
        </span>
        <div className="w-7 h-7 bg-neutral-900 text-bg flex items-center justify-center font-heading font-extrabold text-[11px]">
          DT
        </div>
      </div>
    </div>
  );
}
