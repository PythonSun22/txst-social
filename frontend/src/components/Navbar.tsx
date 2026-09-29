"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PawIcon from "@/components/PawIcon";
import { getSupabase } from "@/lib/supabase";
import { getCurrentProfile, type CurrentProfile } from "@/lib/api";

const links = [
  { href: "/", label: "ForAll" },
  { href: "/colleges", label: "Colleges" },
  { href: "/profile", label: "Profile" },
  { href: "/upload-test", label: "Upload test" },
];

/**
 * Site-wide top bar: logo, main navigation and the account link, with the gold
 * accent stripe underneath. Replaces the old left Sidebar.
 */
export default function Navbar() {
  const [profile, setProfile] = useState<CurrentProfile | null>(null);

  useEffect(() => {
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
  }, []);

  return (
    <header className="sticky top-0 z-50">
      <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[#3a0c0e] bg-primary px-4 py-2 shadow-sm sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#a07520] bg-accent text-white">
            <PawIcon size={18} />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-serif text-base font-bold tracking-tight text-white">TXST Lynx</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#f0c060]">
              Texas State University
            </span>
          </span>
        </Link>

        <ul className="flex items-center gap-1">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="rounded-full px-3 py-1.5 text-sm font-semibold text-white/85 transition-colors hover:bg-white/10 hover:text-white"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="/login"
          className="ml-auto rounded-full border border-white/50 px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-white/10"
        >
          {profile ? profile.display_name || profile.username : "Log In"}
        </Link>
      </nav>
      <div className="h-1 w-full bg-accent" />
    </header>
  );
}
