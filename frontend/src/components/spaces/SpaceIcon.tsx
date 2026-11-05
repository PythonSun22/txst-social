import type { ReactNode } from "react";
import PawIcon from "@/components/ui/PawIcon";

const icons: Record<string, ReactNode> = {
  applied_arts: <>
    <path d="M12 21V11M12 16C6 16 3 13 3 7c6 0 9 3 9 9ZM12 12c0-6 3-9 9-9 0 6-3 9-9 9Z" />
  </>,
  business: <>
    <rect x="3" y="7" width="18" height="14" rx="2" />
    <path d="M8 7V3h8v4M3 12a22 22 0 0 0 18 0M10 12h4v4h-4Z" />
  </>,
  education: <>
    <path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7M2 21h20" />
    <circle cx="12" cy="9" r="1.5" />
  </>,
  fine_arts: <>
    <path d="M3 4c4 2 8 2 12 0v7a6 6 0 0 1-12 0ZM8 17c2 4 7 6 11 1 2-3 2-7 2-10l-3 1M6 8h1M11 8h1M6 12c2-1 4-1 6 0M15 15c1 1 2 1 3 0" />
  </>,
  health_professions: <>
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
    <path d="M4 12h4l2-4 4 8 2-4h4" />
  </>,
  liberal_arts: <>
    <path d="M4 21 17 8M8 17C5 7 13 2 21 3c1 8-4 16-14 13M12 13h6M15 10V5M4 21h8" />
  </>,
  science_engineering: <>
    <ellipse cx="12" cy="12" rx="10" ry="4" />
    <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
    <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
    <circle cx="12" cy="12" r="1" />
  </>,
  university_college: <>
    <path d="m3 8 9-5 9 5ZM5 11v7M10 11v7M14 11v7M19 11v7M3 21h18M4 18h16" />
  </>,
  honors: <>
    <path d="m12 3 1.5 3 3.5.5-2.5 2.4.6 3.5-3.1-1.6-3.1 1.6.6-3.5L7 6.5l3.5-.5ZM6 6c-5 5-3 13 6 15 9-2 11-10 6-15M3 11l3 1M4 16l3-1M21 11l-3 1M20 16l-3-1" />
  </>,
  graduate: <>
    <path d="m2 8 10-5 10 5-10 5ZM6 10v7c4 3 8 3 12 0v-7M22 8v8M20 19l2-3 1 3Z" />
  </>,
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
  music: <>
    <path d="M9 18V5l12-2v13M9 9l12-2" />
    <circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
  </>,
};

/** Shared college and community symbols, with the paw for other spaces. */
export default function SpaceIcon({ slug, size = 20 }: { slug: string; size?: number }) {
  const icon = Object.hasOwn(icons, slug) ? icons[slug] : null;
  if (!icon) return <PawIcon size={size} />;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {icon}
  </svg>;
}
