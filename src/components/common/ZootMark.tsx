interface Props {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/**
 * ZOOT mark: a hexagon (Arknights UI language) holding a bold "Z".
 * Zeroth Order Oil Tank — Closure's PRTS replacement.
 */
export function ZootMark({ size = 24, strokeWidth = 2.6, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M24 4.5 41 14v20L24 43.5 7 34V14Z" />
      <path d="M16.5 15.5h15L17.5 32.5h15" strokeWidth={3.6} />
    </svg>
  );
}
