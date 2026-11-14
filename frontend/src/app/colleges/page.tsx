import Link from "next/link";
import { colleges } from "@/lib/colleges";
import SpaceIcon from "@/components/spaces/SpaceIcon";

export default function Colleges() {
  return <section>
    <h1 className="mb-5 font-serif text-3xl font-bold text-primary">Colleges</h1>
    <ul className="grid gap-4 sm:grid-cols-2">
      {colleges.map((college) => <li key={college.slug}>
        <Link href={`/colleges/${college.slug}`} className="flex h-full items-center gap-4 rounded-xl bg-primary p-6 font-serif text-xl font-bold text-primary-foreground hover:opacity-90">
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-accent"><SpaceIcon slug={college.slug} size={28} /></span>
          <span>{college.name}</span>
        </Link>
      </li>)}
    </ul>
  </section>;
}
