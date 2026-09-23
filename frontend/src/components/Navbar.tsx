import Link from "next/link";
import PawIcon from "@/components/PawIcon";

const links = [
  { href: "/", label: "ForAll" },
  { href: "/colleges", label: "Colleges" },
  { href: "/profile", label: "Profile" },
];

/**
 * Site-wide top bar: logo, main navigation and the sign-in link, with the gold
 * accent stripe underneath. Replaces the old left Sidebar.
 *
 * There is no Sign Up button: signup UI is out of scope for this stage (README).
 */
export default function Navbar() {
  return (
    <header className="sticky top-0 z-50">
      <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[#3a0c0e] bg-primary px-4 py-2 shadow-sm sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#a07520] bg-accent text-white">
            <PawIcon size={18} />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-serif text-base font-bold tracking-tight text-white">Boko Lynx</span>
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
          Log In
        </Link>
      </nav>
      <div className="h-1 w-full bg-accent" />
    </header>
  );
}
