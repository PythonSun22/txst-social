/**
 * Bobcat paw mark used in the logo and beside space names.
 *
 * @param size - Width and height in pixels.
 * @param className - Optional CSS classes for layout and color.
 * @param variant - Use spaced, taller pads for the large login background.
 */
export default function PawIcon({
  size = 20,
  className,
  variant = "default",
}: {
  size?: number;
  className?: string;
  variant?: "default" | "background";
}) {
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">
      {variant === "background" ? (
        <>
          <ellipse cx="32" cy="45" rx="17" ry="18" />
          <ellipse cx="9" cy="25" rx="6" ry="9" />
          <ellipse cx="55" cy="25" rx="6" ry="9" />
          <ellipse cx="23" cy="11" rx="6" ry="9" />
          <ellipse cx="41" cy="11" rx="6" ry="9" />
        </>
      ) : (
        <>
          <ellipse cx="32" cy="42" rx="14" ry="12" />
          <ellipse cx="14" cy="28" rx="7" ry="9" />
          <ellipse cx="50" cy="28" rx="7" ry="9" />
          <ellipse cx="25" cy="18" rx="7" ry="9" />
          <ellipse cx="39" cy="18" rx="7" ry="9" />
        </>
      )}
    </svg>
  );
}
