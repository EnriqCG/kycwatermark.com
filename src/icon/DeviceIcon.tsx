import type { IconProps } from "../types/icon";

export default function DeviceIcon({ className }: IconProps) {
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
      <title>Device icon</title>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M10 18h4" />
    </svg>
  );
}
