"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import PawIcon from "@/components/ui/PawIcon";
import { getSupabase } from "@/lib/supabase";
import { getCurrentProfile, type CurrentProfile } from "@/lib/profiles";

const links = [
  { href: "/", label: "ForAll" },
  { href: "/colleges", label: "Colleges" },
  { href: "/profile", label: "Profile" },
  { href: "/upload-test", label: "Upload test" },
];

/**
 * Site-wide navigation using the Colleges cream, maroon and gold palette.
 * Account pages use their own branding and do not need this header.
 */
export default function Navbar() {
  const pathname = usePathname();
  const isAccountPage = ["/login", "/choose-username"].includes(pathname);
  const [profile, setProfile] = useState<CurrentProfile | null>(null);

  useEffect(() => {
    if (isAccountPage) return;
    let active = true;
    let request: AbortController | undefined;
    async function refresh() {
      request?.abort();
      const controller = new AbortController();
      request = controller;
      try {
        const current = await getCurrentProfile(controller.signal);
        if (active && !controller.signal.aborted) setProfile(current);
      } catch {
        if (active && !controller.signal.aborted) setProfile(null);
      }
    }
    const { data } = getSupabase().auth.onAuthStateChange(() => {
      // Leave the Auth callback before asking the SDK for the current session.
      queueMicrotask(() => { if (active) void refresh(); });
    });
    void refresh();
    return () => { active = false; request?.abort(); data.subscription.unsubscribe(); };
  }, [isAccountPage]);

  if (isAccountPage) return null;

  return (
    <header className="sticky top-0 z-50">
      <nav className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-border bg-background px-4 py-4 shadow-[0_4px_20px_-12px_#3a2a2440] sm:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary bg-primary text-white shadow-[3px_3px_0_#e4bd68]">
            <PawIcon size={18} />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-serif text-xl font-bold tracking-tight text-primary">TXST Lynx</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Texas State University
            </span>
          </span>
        </Link>

        <ul className="order-last flex w-full items-center gap-1 overflow-x-auto py-1 sm:order-none sm:w-auto">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={(link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)) ? "page" : undefined}
                className="site-nav-link"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <Link href="/search" aria-label="Search students" title="Search students" className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-primary transition-colors hover:bg-muted">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="10.8" cy="10.8" r="6.8" />
            <path d="m16 16 5 5" />
          </svg>
        </Link>

        <Link
          href={profile ? "/profile" : "/login"}
          className="ml-auto max-w-48 truncate rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90"
        >
          {profile ? profile.display_name || profile.username : "Log In"}
        </Link>
      </nav>

    </header>
  );
}
