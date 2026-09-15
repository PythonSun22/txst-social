import PostCard from "@/components/PostCard";

export default async function Home() {
  //const response = await fetch("http://127.0.0.1:8000/health");
  //const data = await response.json();

  interface Post {
    id: number;
    author: string;
    content: string;
    likes: number;
  }
  const posts: Post[] = [
    { id: 1, author: "Seth", content: "Hello, world!", likes: 10 },
    { id: 2, author: "Sachin", content: "This is a great post!", likes: 15 },
    { id: 3, author: "Misan", content: "I love this!", likes: 11 },
    { id: 4, author: "Adam B", content: "Supabase post!", likes: 10 },
    { id: 5, author: "Adam S", content: "Backend post", likes: 12 },
    { id: 6, author: "Daniel", content: "Schema Post", likes: 12 },
  ]

  return (
    <main>
      <h1> Boko Lynx </h1>
        <h2> ForAll: University Feed </h2>
        {/* <p>Backend Status: {data.status}</p> */}
        <div className="feed">
          {posts.map((post) =>
            (
              <PostCard
                key={post.id}
                author={post.author}
                content={post.content}
                likes={post.likes}
              />
            )
          )}
        </div>
    </main>
  );
}