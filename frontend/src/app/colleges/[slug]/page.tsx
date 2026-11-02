"use client";
import { colleges } from "@/lib/colleges";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import PostCard from "@/components/posts/PostCard";
import { getCurrentProfile, type CurrentProfile } from "@/lib/profiles";
import { fetchPosts, type FeedPost } from "@/lib/posts";






export default function CollegePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getCurrentProfile(), fetchPosts(undefined, undefined, slug)])
    .then(([account, page]) => {setProfile(account); setPosts(page.items);  })
    .finally(()=> setLoading(false));
  }, [slug]);



  const college = colleges.find((c) => c.slug === slug);

  if (!college) return <main><h1>College not found</h1></main>;

  return ( 
    <main className="mx-auto max-w-4xl p-6">
        <Link href="/colleges" className="text-sm font-semibold text-primary hover:underline">← All colleges
        </Link>
    
        <header className="mt-4 rounded-xl bg-primary p-10 text-primary-foreground">
            <h1 className="text-3xl font-bold">{college.name}</h1>
            <p className="mt-2 text-primary-foreground/80">{college.description}</p>
        </header>

        <section className="mt-6">
            <h2 className="text-xl font-bold">Posts</h2>
             {loading && <p className="mt-3 text-muted-foreground"> Loading posts...</p>}   
             {!loading && posts.length === 0 && (<div className="mt-3 rounded-xl border border-border p-8 text-center text-muted-foreground">No posts yet. Posts for {college.name} will show here</div>)}
            
            <div className="mt-3 space-y-3">
              {posts.map((post)=> (
                <PostCard 
                  key={post.id}
                  post={post}
                  profile={profile}
                  onLike={(id,value) => setPosts((items) => items.map((item) => item.id === id ? { ...item, ...value} : item))}
                  onDelete={(id) => setPosts((items) => items.filter((item) => item.id !== id))}
                  onStatus={(id, status, failed) =>setPosts((items) =>items.map((item) => item.id === id ?  { ...item, status, moderation_failed: failed }: item))}
                />
              ))}
            </div>

        </section>
    </main>

  );
}