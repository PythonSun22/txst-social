"use client";

import Link from "next/link";
import { use } from "react";
import SpaceFeed from "@/components/posts/SpaceFeed";
import { colleges } from "@/lib/colleges";

export default function CollegePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const college = colleges.find((item) => item.slug === slug);

  if (!college) return <main><h1>College not found</h1></main>;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <Link href="/colleges" className="text-sm font-semibold text-primary hover:underline">← All colleges</Link>

      <header className="mt-4 rounded-xl bg-primary p-10 text-primary-foreground">
        <h1 className="text-3xl font-bold">{college.name}</h1>
        <p className="mt-2 text-primary-foreground/80">{college.description}</p>
      </header>

      <section className="mt-6">
        <h2 className="text-xl font-bold">Posts</h2>
        <Link href={`/submit?space=${slug}`} className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          Create post
        </Link>
        <div className="mt-3">
          <SpaceFeed space={slug} emptyMessage={`No posts yet. Posts for ${college.name} will show here.`} />
        </div>
      </section>
    </main>
  );
}
