"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Give the login page the full viewport; keep application feeds centered. */
export default function PageContent({ children }: { children: ReactNode }) {
  const isLoginPage = usePathname() === "/login";

  return (
    <main className={isLoginPage ? "min-h-svh w-full" : "mx-auto w-full max-w-2xl px-4 py-5"}>
      {children}
    </main>
  );
}
