import { getScoreInk } from "@/lib/scoreInk";

// Small horizontal fit-score bar used in the companies table and cluster
// cards. Fill is greyscale by magnitude, not accent-when-low — a low score is
// a smaller number, not a warning (v2 colour discipline).
export function FitBar({ score, width = 64 }: { score: number | null; width?: number }) {
  const fill = score == null ? "transparent" : getScoreInk(score);
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 bg-neutral-300" style={{ width }}>
        <div className="h-full" style={{ width: `${score ?? 0}%`, background: fill }} />
      </div>
      <span className="font-mono text-xs" style={{ color: score != null ? getScoreInk(score) : undefined }}>
        {score != null ? `${score}/100` : "—"}
      </span>
    </div>
  );
}

// Large score display for a cluster card or the overall-fit box.
export function ScoreBadge({ score, size = 34 }: { score: number; size?: number }) {
  return (
    <div className="font-heading font-extrabold leading-none" style={{ fontSize: size, color: getScoreInk(score) }}>
      {score}
      <span className="text-neutral-600" style={{ fontSize: size * 0.45 }}>
        /100
      </span>
    </div>
  );
}
