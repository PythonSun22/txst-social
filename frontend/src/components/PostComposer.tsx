"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";

// posts_title_length CHECK in the core migration (FR-31).
const TITLE_MAX = 300;

/**
 * Form for writing a text post to General.
 *
 * Kept separate from the /submit page so it can later be shown in a pop-up
 * without changes. Not yet connected: there is no POST endpoint for posts
 * (PLAN.md step 2), so submitting validates and then says nothing was saved.
 */
export default function PostComposer() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // TODO: send { title, body } to the create-post endpoint once it exists.
    setNotice("Posting isn't connected to the backend yet, so this post was not saved.");
  }

  const canSubmit = title.trim().length > 0;

  return (
    <form onSubmit={submit} className="space-y-4 rounded-card border border-border bg-card p-4">
      <p className="text-xs font-semibold text-muted-foreground">
        Posting to <span className="font-bold text-primary">General</span>
      </p>

      <label className="block text-sm font-semibold">
        Title
        <input
          className="mt-1 block w-full rounded-card border border-border bg-secondary p-2 font-normal focus:outline-2 focus:outline-ring"
          type="text"
          required
          maxLength={TITLE_MAX}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <span className="mt-1 block text-right text-xs font-normal text-muted-foreground">
          {title.length}/{TITLE_MAX}
        </span>
      </label>

      <label className="block text-sm font-semibold">
        Body
        <textarea
          className="mt-1 block min-h-40 w-full rounded-card border border-border bg-secondary p-2 font-normal focus:outline-2 focus:outline-ring"
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>

      <p className="text-xs text-muted-foreground">
        New posts are checked by moderation before anyone else can see them.
      </p>

      {notice && <p role="status" className="text-sm font-semibold text-primary">{notice}</p>}

      <div className="flex justify-end gap-2">
        <Link href="/" className="rounded-full px-4 py-1.5 text-sm font-bold text-muted-foreground hover:bg-muted">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground hover:bg-[#3a0c0e] disabled:opacity-50"
        >
          Post
        </button>
      </div>
    </form>
  );
}
