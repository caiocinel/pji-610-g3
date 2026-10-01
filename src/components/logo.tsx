export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden className={className}>
      <path d="M24 6c4 5 6 8.5 6 12a6 6 0 0 1-12 0c0-3.5 2-7 6-12Z" fill="currentColor" />
      <rect x="15" y="26" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="2.5" />
      <path d="M24 24v2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
