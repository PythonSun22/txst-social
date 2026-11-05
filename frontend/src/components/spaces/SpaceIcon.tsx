import type { ReactNode } from "react";
import PawIcon from "@/components/ui/PawIcon";

const icons: Record<string, ReactNode> = {
  study_groups: <>
    <path d="M12 5v15M3 4h4a5 5 0 0 1 5 2 5 5 0 0 1 5-2h4v15h-4a6 6 0 0 0-5 2 6 6 0 0 0-5-2H3Z" />
    <path d="M6 8h2M6 12h2M16 8h2M16 12h2" />
  </>,
  campus_events: <>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M7 3v4M17 3v4M3 10h18m-9 3 1 2 2 .3-1.5 1.5.4 2.2-1.9-1-1.9 1 .4-2.2L9 15.3l2-.3Z" />
  </>,
  gaming: <>
    <path d="M7 7h10c2 0 3 2 3.5 4l1 6c.4 3-2 4-4 2l-3-3h-5l-3 3c-2 2-4.4 1-4-2l1-6C4 9 5 7 7 7Z" />
    <path d="M7 10v5M4.5 12.5h5M16 11h.01M18 14h.01" />
  </>,
  art: <>
    <path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.5 1.5 0 0 1 1-2.8h2a4 4 0 0 0 4-4C21 6.3 17 3 12 3Z" />
    <circle cx="7" cy="11" r="1" /><circle cx="10" cy="7" r="1" />
    <circle cx="15" cy="7" r="1" /><circle cx="18" cy="11" r="1" />
  </>,
  san_marcos_life: <>
    <path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 1 1 14 0Z" />
    <circle cx="12" cy="9" r="2.5" />
  </>,
  technology: <>
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <path d="M9 9h6v6H9ZM9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
  </>,
  cooking: <>
    <path d="M7 16a5 5 0 0 1-1-9 6 6 0 0 1 12 0 5 5 0 0 1-1 9v5H7ZM7 17h10" />
    <path d="M10 12v2M14 12v2" />
  </>,
  sports: <>
    <path d="M8 3h8v6a4 4 0 0 1-8 0ZM8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 13v5M8 21v-3h8v3M6 21h12" />
  </>,
};

/** Consistent community symbols, with the existing paw for other spaces. */
export default function SpaceIcon({ slug, size = 20 }: { slug: string; size?: number }) {
  const icon = Object.hasOwn(icons, slug) ? icons[slug] : null;
  if (!icon) return <PawIcon size={size} />;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {icon}
  </svg>;
}
