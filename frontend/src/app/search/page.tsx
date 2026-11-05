"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { searchProfiles, type ProfileListItem } from "@/lib/api";
import { searchSpaces, spaceHref, type Space } from "@/lib/spaces";
import SpaceIcon from "@/components/spaces/SpaceIcon";

type Scope = "all" | "students" | "colleges" | "spaces";
interface SearchResults {
  students: ProfileListItem[];
  colleges: Space[];
  spaces: Space[];
  errors: string[];
}

function SpaceResults({ title, spaces }: { title: string; spaces: Space[] }) {
  if (!spaces.length) return null;
  return <section className="rounded-card border border-border bg-card p-4">
    <h2 className="mb-3 font-serif text-lg font-bold text-primary">{title} ({spaces.length})</h2>
    <ul className="divide-y divide-border">
      {spaces.map((space) => <li key={space.id} className="py-3">
        <Link href={spaceHref(space.slug)} className="flex items-center gap-3 text-primary hover:underline">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-accent"><SpaceIcon slug={space.slug} /></span>
          <span className="font-semibold">{space.name}</span>
        </Link>
        {space.description && <p className="mt-2 text-sm text-muted-foreground">{space.description}</p>}
      </li>)}
    </ul>
  </section>;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const search = useCallback(async (query: string, scope: Scope) => {
    const term = query.trim();
    if (!term) return;
    request.current?.abort();
    const current = new AbortController();
    request.current = current;
    setLoading(true);
    setResults(null);
    const [students, colleges, spaces] = await Promise.allSettled([
      scope === "all" || scope === "students" ? searchProfiles(term, current.signal) : Promise.resolve([]),
      scope === "all" || scope === "colleges" ? searchSpaces(term, "college", current.signal) : Promise.resolve([]),
      scope === "all" || scope === "spaces" ? searchSpaces(term, "community", current.signal) : Promise.resolve([]),
    ]);
    if (current.signal.aborted) return;
    const labels = ["students", "colleges", "spaces"];
    setResults({
      students: students.status === "fulfilled" ? students.value : [],
      colleges: colleges.status === "fulfilled" ? colleges.value : [],
      spaces: spaces.status === "fulfilled" ? spaces.value : [],
      errors: [students, colleges, spaces].flatMap((result, index) => result.status === "rejected"
        ? [`Unable to search ${labels[index]}. ${result.reason instanceof Error ? result.reason.message : "Please try again."}`] : []),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    if (query.trim()) debounce.current = setTimeout(() => void search(query, scope), 250);
    return () => { clearTimeout(debounce.current); request.current?.abort(); };
  }, [query, scope, search]);

  function resetResults(term: string) {
    request.current?.abort();
    clearTimeout(debounce.current);
    setResults(null);
    setLoading(!!term.trim());
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearTimeout(debounce.current);
    void search(query, scope);
  }

  const empty = results && !results.errors.length && !results.students.length && !results.colleges.length && !results.spaces.length;
  return <section className="mx-auto max-w-2xl space-y-5">
    <div>
      <h1 className="font-serif text-2xl font-bold text-primary">Search</h1>
      <p className="mt-1 text-sm text-muted-foreground">Find students, colleges, and spaces around TXST.</p>
    </div>
    <form role="search" onSubmit={submit} className="flex gap-2">
      <div className="flex min-w-0 flex-1 overflow-hidden rounded-full border border-border bg-card focus-within:border-primary">
        <label className="sr-only" htmlFor="search-scope">Search category</label>
        <select id="search-scope" value={scope} onChange={(event) => { resetResults(query); setScope(event.target.value as Scope); }}
          className="max-w-28 border-r border-border bg-transparent px-3 py-2 text-sm text-primary outline-none">
          <option value="all">All</option>
          <option value="students">Students</option>
          <option value="colleges">Colleges</option>
          <option value="spaces">Spaces</option>
        </select>
        <label className="sr-only" htmlFor="directory-search">Search students, colleges, or spaces</label>
        <input id="directory-search" type="search" autoComplete="off" autoFocus maxLength={50} value={query}
          onChange={(event) => { resetResults(event.target.value); setQuery(event.target.value); }}
          placeholder={scope === "all" ? "Search everyone and every space…" : `Search ${scope}…`}
          className="min-w-0 flex-1 bg-transparent px-4 py-2 text-sm outline-none" />
      </div>
      <button type="submit" disabled={!query.trim()} className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white disabled:opacity-50">Search</button>
    </form>
    {!query.trim() && <p className="text-sm text-muted-foreground">Start typing to search all categories, or choose one from the dropdown.</p>}
    {loading && <p role="status" className="text-sm text-muted-foreground">Searching…</p>}
    {results?.errors.map((error) => <p key={error} role="alert" className="text-sm text-primary">{error}</p>)}
    {empty && <p className="rounded-card border border-border bg-card p-4 text-sm text-muted-foreground">{scope === "all" ? "No results found." : `No ${scope} found.`}</p>}
    {!!results?.students.length && <section className="rounded-card border border-border bg-card p-4">
      <h2 className="mb-3 font-serif text-lg font-bold text-primary">Students ({results.students.length})</h2>
      <ul className="divide-y divide-border">
        {results.students.map((person) => <li key={person.id} className="py-3">
          <Link href={`/profile/${person.id}`} className="font-semibold text-primary hover:underline">{person.display_name || person.username}</Link>
          <span className="ml-2 text-sm text-muted-foreground">@{person.username}</span>
          {person.major && <p className="mt-1 text-sm text-muted-foreground">{person.major}</p>}
        </li>)}
      </ul>
    </section>}
    <SpaceResults title="Colleges" spaces={results?.colleges ?? []} />
    <SpaceResults title="Spaces" spaces={results?.spaces ?? []} />
  </section>;
}
