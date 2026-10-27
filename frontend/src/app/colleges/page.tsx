import Link from "next/link";
import { colleges } from "@/lib/colleges";





export default function Colleges() {
    return (
        <main className ="mx-auto max-w-4xl p-6">
            <h1>Colleges</h1>
            <ul className="grid gap-4 sm:grid-cols-2">
                {colleges.map((college)=> (
                    <li key = {college.slug}>
                        <Link href = {`/colleges/${college.slug}`} className="block rounded-xl bg-primary p-8 text-xl font-bold text-primary-foreground hover:opacity-90
                        ">{college.name}</Link>
                    </li>
                ))}
            </ul>
        </main>
    );
}