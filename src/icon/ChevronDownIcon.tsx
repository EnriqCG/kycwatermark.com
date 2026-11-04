import type { IconProps } from "../types/icon";

export default function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <title>Chevron icon</title>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
