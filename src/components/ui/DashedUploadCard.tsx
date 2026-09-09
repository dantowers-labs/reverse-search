import type { ReactNode } from "react";

// The "Add profiles" / "Add material" dashed-border upload prompt. Callers
// drop their own hidden file input + trigger button/label in `children` —
// this component only supplies the framing, consistent with the rest of the
// app's native-file-input upload pattern (no dropzone library).
export function DashedUploadCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="bg-bg border-2 border-dashed border-divider p-4 flex flex-col justify-center gap-2">
      <div className="font-heading font-extrabold text-sm">{title}</div>
      <div className="text-xs text-neutral-700 leading-snug">{description}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
