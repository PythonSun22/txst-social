"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import SpacesSidebar from "@/components/spaces/SpacesSidebar";
import CollegesSidebar from "@/components/spaces/CollegesSidebar";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/spaces") return <main className="w-full px-4 py-8 sm:px-6 lg:px-8">{children}</main>;
  const showSidebar = pathname === "/" || pathname === "/search/posts";
  const isSpaceFeed = pathname.startsWith("/colleges/") || (pathname.startsWith("/spaces/") && pathname !== "/spaces/create");
  if (!showSidebar) return <main className={`mx-auto w-full ${isSpaceFeed ? "max-w-3xl" : "max-w-2xl"} px-4 py-5`}>{children}</main>;
  // Equal outer columns keep the feed centered in the viewport, independently of the sidebar.
  return <div className="grid w-full items-start gap-y-6 py-5 xl:grid-cols-[minmax(0,1fr)_48rem_minmax(0,1fr)] xl:gap-x-6 xl:px-4">
    <div className="mx-auto w-full max-w-3xl px-4 xl:sticky xl:top-28 xl:col-start-1 xl:row-start-1 xl:mx-0 xl:max-w-56 xl:justify-self-start xl:px-0">
      <SpacesSidebar />
    </div>
    <main className="row-start-3 mx-auto min-w-0 w-full max-w-3xl px-4 xl:col-start-2 xl:row-start-1">{children}</main>
    <div className="row-start-2 mx-auto w-full max-w-3xl px-4 xl:sticky xl:top-28 xl:col-start-3 xl:row-start-1 xl:mx-0 xl:max-w-64 xl:justify-self-end xl:px-0">
      <CollegesSidebar />
    </div>
  </div>;
}
