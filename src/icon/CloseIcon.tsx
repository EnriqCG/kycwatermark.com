import type { IconProps } from "../types/icon";

export default function CloseIcon({ className }: IconProps) {
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
      <title>Close icon</title>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}
