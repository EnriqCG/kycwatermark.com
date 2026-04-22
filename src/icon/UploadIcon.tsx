import type { IconProps } from "../types/icon";

export default function UploadIcon({ className }: IconProps) {
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
      <title>Upload icon</title>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 14.5v3.5A2 2 0 0 0 6 20h12a2 2 0 0 0 2-2v-3.5" />
    </svg>
  );
}
