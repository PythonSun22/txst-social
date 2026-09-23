/**
 * Bobcat paw mark used in the logo and beside space names.
 *
 * @param size - Width and height in pixels.
 */
export default function PawIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">
      <ellipse cx="32" cy="42" rx="14" ry="12" />
      <ellipse cx="14" cy="28" rx="7" ry="9" />
      <ellipse cx="50" cy="28" rx="7" ry="9" />
      <ellipse cx="22" cy="18" rx="6" ry="7" />
      <ellipse cx="42" cy="18" rx="6" ry="7" />
    </svg>
  );
}
