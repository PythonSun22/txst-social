import AuthForm from "@/components/auth/AuthForm";
import PawIcon from "@/components/ui/PawIcon";

/** Account entry point for Texas State students (FR-01, FR-02). */
export default function LoginPage() {
  return (
    <section className="relative mx-auto w-full max-w-xl pb-12 pt-7 sm:pt-12 zoom: 0.9">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <PawIcon
          variant="background"
          className="absolute left-0 top-1/2 size-[103.5dvh] -translate-x-[40%] -translate-y-1/2 text-primary/20"
        />
      </div>
      <div className="relative mb-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary/70">
          Texas State University
        </p>
        <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-primary sm:text-4xl">
          Your campus community
        </h1>
      </div>

      <div className="relative overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[0_24px_70px_-42px_rgba(80,18,20,0.55)]">
        <div className="relative isolate overflow-hidden bg-primary px-6 py-6 text-white sm:px-8">
          <div aria-hidden="true" className="absolute -right-10 -top-20 h-48 w-48 rounded-full border border-white/10" />
          <div aria-hidden="true" className="absolute -right-3 -top-12 h-40 w-40 rounded-full border border-white/10" />
          <div className="relative flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-black/10">
              <PawIcon size={24} />
            </span>
            <div>
              
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#f0c060]">TXST Lynx</p>
              <p className="mt-1 text-sm text-white/85">A space for Bobcats to connect.</p>
            </div>
          </div>
        </div>
        <AuthForm />
      </div>

      <p className="relative mt-6 text-center text-xs leading-5 text-muted-foreground">
        Made for the Texas State community. A @txstate.edu email is required to join.
      </p>
    </section>
  );
}
