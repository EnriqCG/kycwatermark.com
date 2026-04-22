import type { IconProps } from "../types/icon";

export default function DownloadIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <title>Download icon</title>
      <path d="M12 4v12" />
      <path d="m17 11-5 5-5-5" />
      <path d="M4 19h16" />
    </svg>
  );
}
