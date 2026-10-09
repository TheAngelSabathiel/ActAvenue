export function Spinner({ label = "Loading", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-24 ${className}`} role="status" aria-live="polite">
      <div className="aa-spinner" />
      <span className="aa-label text-muted">{label}</span>
    </div>
  );
}
