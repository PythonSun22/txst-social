"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { searchProfiles, type ProfileListItem } from "@/lib/api";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileListItem[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    setLoading(true);
    setError("");
    setSearched(true);
    try { setResults(await searchProfiles(term)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to search students."); }
    finally { setLoading(false); }
  }

  return <section className="mx-auto max-w-2xl space-y-5">
    <div>
      <h1 className="font-serif text-2xl font-bold text-primary">Search students</h1>
      <p className="mt-1 text-sm text-muted-foreground">Search by username or display name.</p>
    </div>
    <form onSubmit={(event) => void submit(event)} className="flex gap-2">
      <label className="sr-only" htmlFor="student-search">Name or username</label>
      <input id="student-search" type="search" autoComplete="off" maxLength={50} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search students…" className="min-w-0 flex-1 rounded-full border border-border bg-card px-4 py-2 text-sm outline-none focus:border-primary" />
      <button type="submit" disabled={loading || !query.trim()} className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{loading ? "Searching…" : "Search"}</button>
    </form>
    {error && <p role="alert" className="text-sm text-primary">{error}</p>}
    {searched && !loading && !error && results.length === 0 && <p className="rounded-card border border-border bg-card p-4 text-sm text-muted-foreground">No students found.</p>}
    <ul className="divide-y divide-border rounded-card border border-border bg-card px-4">
      {results.map((person) => <li key={person.id} className="py-4">
        <Link href={`/profile/${person.id}`} className="font-semibold text-primary hover:underline">{person.display_name || person.username}</Link>
        <span className="ml-2 text-sm text-muted-foreground">@{person.username}</span>
        {person.major && <p className="mt-1 text-sm text-muted-foreground">{person.major}</p>}
      </li>)}
    </ul>
  </section>;
}
