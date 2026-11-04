import type { IconProps } from "../types/icon";

export default function CheckIcon({ className }: IconProps) {
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
      <title>Check icon</title>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
