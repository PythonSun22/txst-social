import type { ReactNode } from "react";
import PawIcon from "@/components/ui/PawIcon";

/** Shared background and card for the sequential account-setup steps. */
export default function AccountSetupCard({ title, description, error, children }: {
  title: string; description: string; error?: string; children: ReactNode;
}) {
  return <section className="relative mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-xl items-center justify-center">
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
      <PawIcon variant="background" className="absolute left-0 top-1/2 size-[103.5dvh] -translate-x-[40%] -translate-y-1/2 text-primary/20" />
    </div>
    <div className="relative w-full rounded-[1.75rem] border border-border bg-card px-6 py-8 shadow-[0_24px_70px_-42px_rgba(80,18,20,0.55)] sm:px-10">
      <h1 className="font-serif text-3xl font-bold text-primary">{title}</h1>
      <p className="mt-3 text-sm font-semibold text-foreground">{description}</p>
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {children}
    </div>
  </section>;
}
