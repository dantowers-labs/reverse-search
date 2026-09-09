function initials(name: string | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

export function Avatar({ name, size = 34 }: { name?: string | null; size?: number }) {
  return (
    <div
      className="flex-none bg-neutral-300 flex items-center justify-center font-heading font-extrabold text-neutral-700"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials(name ?? null)}
    </div>
  );
}
