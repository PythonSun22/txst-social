"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import SpacesSidebar from "@/components/spaces/SpacesSidebar";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showSidebar = pathname === "/" || pathname === "/search/posts";
  if (!showSidebar) return <main className="mx-auto w-full max-w-2xl px-4 py-5">{children}</main>;
  // Equal outer columns keep the feed centered in the viewport, independently of the sidebar.
  return <div className="grid w-full items-start gap-y-6 py-5 xl:grid-cols-[minmax(0,1fr)_42rem_minmax(0,1fr)] xl:gap-x-6 xl:px-4">
    <div className="mx-auto w-full max-w-2xl px-4 xl:sticky xl:top-28 xl:mx-0 xl:max-w-xs xl:justify-self-end xl:px-0">
      <SpacesSidebar />
    </div>
    <main className="mx-auto min-w-0 w-full max-w-2xl px-4 xl:col-start-2">{children}</main>
  </div>;
}
