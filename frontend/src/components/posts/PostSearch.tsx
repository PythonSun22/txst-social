import Form from "next/form";

/**
 * Post title search box shown beside a feed (FR-80). Kept out of the navbar,
 * which is reserved for a future site-wide search (spaces, people, posts).
 *
 * @param defaultValue - Current query, so the results page can be refined in place.
 */
export default function PostSearch({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    // next/form turns this GET form into a client-side navigation to /search?q=….
    <Form action="/search" role="search" className="mb-3 flex gap-2">
      <input
        type="search"
        name="q"
        required
        maxLength={100}
        defaultValue={defaultValue}
        placeholder="Search posts by title"
        aria-label="Search posts by title"
        className="min-w-0 flex-1 rounded-full border border-border bg-card px-4 py-2 text-sm focus:border-primary focus:outline-none"
      />
      <button type="submit" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">
        Search
      </button>
    </Form>
  );
}
