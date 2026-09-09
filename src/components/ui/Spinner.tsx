export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin ${className}`}
    />
  );
}

// The pulsing square used in the global run-status bar and elsewhere to
// signal "something is actively happening" without a fake progress value.
export function PulsingDot({ className = "" }: { className?: string }) {
  return <span className={`inline-block w-2.5 h-2.5 flex-none ${className}`} style={{ animation: "rsPulse 1s ease-in-out infinite" }} />;
}
