// The KYCWatermark.com seal: a scalloped seal crossed by a blacked-out ribbon.
// public/logo.svg is the detailed version for large sizes; this one keeps
// only the outline, one ring and the ribbon so it reads at header size.

type LogoProps = {
  className?: string;
  /** Thicker lines for sizes around 16px, such as the footer. */
  compact?: boolean;
};

const SEAL =
  "M32 6A6 6 0 0 1 41.9 8A6 6 0 0 1 50.4 13.6A6 6 0 0 1 56 22.1A6 6 0 0 1 58 32A6 6 0 0 1 56 41.9A6 6 0 0 1 50.4 50.4A6 6 0 0 1 41.9 56A6 6 0 0 1 32 58A6 6 0 0 1 22.1 56A6 6 0 0 1 13.6 50.4A6 6 0 0 1 8 41.9A6 6 0 0 1 6 32A6 6 0 0 1 8 22.1A6 6 0 0 1 13.6 13.6A6 6 0 0 1 22.1 8A6 6 0 0 1 32 6Z";

export default function Logo({ className, compact = false }: LogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <title>KYCWatermark.com logo</title>
      <path
        d={SEAL}
        className="fill-paper stroke-accent"
        strokeWidth={compact ? 3.6 : 2.6}
      />
      <circle
        cx="32"
        cy="32"
        r={compact ? 18.5 : 19}
        fill="none"
        className="stroke-accent"
        strokeWidth={compact ? 3 : 2}
      />
      <path
        d={
          compact
            ? "M1 22H63L58.5 32L63 42H1L5.5 32Z"
            : "M1 23H63L59 32L63 41H1L5 32Z"
        }
        className="fill-redact stroke-paper"
        strokeWidth={compact ? 2.4 : 2}
        strokeLinejoin="round"
      />
    </svg>
  );
}
