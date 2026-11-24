// Select icon: two rows of a checkbox and a line, the first box ticked. Drawn
// in the lucide style of the app's other icons. Sized to the current font via em.
export function SelectIcon({ className }: { className?: string }) {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="4" width="7" height="7" rx="1.5" />
      <path d="m5 7.5 1.5 1.5L9 6" />
      <path d="M14 7.5h7" />
      <rect x="3" y="13" width="7" height="7" rx="1.5" />
      <path d="M14 16.5h7" />
    </svg>
  );
}
