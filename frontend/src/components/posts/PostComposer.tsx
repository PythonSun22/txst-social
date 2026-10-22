"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ImageUploader from "@/components/images/ImageUploader";
import type { SelectedImage } from "@/lib/images/image-file";
import type { ImagePolicy } from "@/lib/images/image-policy";
import { getImagePolicy, getStorageBudget, ImageTransferError, reserveImages, uploadReservedImage,
  type UploadTicket, type StorageBudget } from "@/lib/images/image-api";
import { formatBytes } from "@/lib/images/image-policy";
import { createPost } from "@/lib/posts";

interface Attachment { key: string; image: SelectedImage | null }

/** Owns post orchestration only. Selection/editing and transfers remain reusable image modules. */
export default function PostComposer() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [policy, setPolicy] = useState<ImagePolicy | null>(null);
  const [policyError, setPolicyError] = useState("");
  const [budget, setBudget] = useState<StorageBudget | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const submissionId = useRef<string | null>(null);
  // Unchanged images are not transferred again after a failed post request.
  const transfers = useRef(new Map<File, { id: string; complete: boolean }>());
  const tickets = useRef(new Map<File, UploadTicket>());

  useEffect(() => {
    const controller = new AbortController();
    getImagePolicy(controller.signal).then(setPolicy).catch(() => {
      if (!controller.signal.aborted) setPolicyError("Image uploads are unavailable. Reload to try again; text posts still work.");
    });
    getStorageBudget(controller.signal).then(setBudget).catch(() => {});
    return () => controller.abort();
  }, []);

  const valid = !!title.trim() && (body.trim().length > 0 || attachments.length > 0)
    && (!attachments.length || (!!policy && attachments.length <= policy.max_images_per_post))
    && attachments.every((item) => item.image && !item.image.errors.length);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || sending.current) return;
    sending.current = true; setBusy(true); setError("");
    submissionId.current ??= crypto.randomUUID();
    try {
      const ids: string[] = [];
      const unreserved = attachments.map((attachment) => attachment.image!)
        .filter((image) => !transfers.current.has(image.file) && !tickets.current.has(image.file));
      if (unreserved.length) {
        setNotice("Compressing images and reserving space…");
        const reserved = await reserveImages(unreserved);
        unreserved.forEach((image, index) => tickets.current.set(image.file, reserved[index]));
      }
      for (const [index, attachment] of attachments.entries()) {
        const image = attachment.image!;
        const cached = transfers.current.get(image.file);
        if (cached?.complete) { ids.push(cached.id); continue; }
        setNotice(`Saving image ${index + 1} of ${attachments.length}…`);
        try {
          const saved = await uploadReservedImage(tickets.current.get(image.file)!, setNotice);
          transfers.current.set(image.file, { id: saved.id, complete: true });
          ids.push(saved.id);
        } catch (cause) {
          if (cause instanceof ImageTransferError) transfers.current.set(image.file, { id: cause.uploadId, complete: false });
          throw cause;
        }
      }
      setNotice("Saving post…");
      await createPost({ submission_id: submissionId.current, title: title.trim(), body: body.trim() || null, image_ids: ids });
      router.push("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save your post.");
      setNotice(""); setBusy(false); sending.current = false;
      getStorageBudget().then(setBudget).catch(() => {});
    }
  }

  function reorder(index: number, change: number) {
    setAttachments((current) => {
      const result = [...current];
      [result[index], result[index + change]] = [result[index + change], result[index]];
      return result;
    });
  }

  return <form onSubmit={submit} className="space-y-4 rounded-card border border-border bg-card p-4">
    <p className="text-xs font-semibold text-muted-foreground">Posting to <span className="text-primary">General</span></p>
    <fieldset disabled={busy} className="space-y-4">
      <label className="block text-sm font-semibold">Title
        <input required maxLength={300} value={title} onChange={(event) => setTitle(event.target.value)}
          className="mt-1 block w-full rounded-card border border-border bg-secondary p-2 font-normal" />
        <span className="block text-right text-xs font-normal text-muted-foreground">{title.length}/300</span>
      </label>
      <label className="block text-sm font-semibold">Body
        <textarea maxLength={20000} value={body} onChange={(event) => setBody(event.target.value)}
          className="mt-1 block min-h-40 w-full rounded-card border border-border bg-secondary p-2 font-normal" />
      </label>
      <p className="text-xs text-muted-foreground">Add text, images, or both.{policy && ` Up to ${policy.max_images_per_post} images, shown in the order below.`}</p>
      {policy && <p className="text-xs text-muted-foreground">Image uploads share an account limit of {policy.uploads_per_minute} per minute and {policy.uploads_per_hour} per hour, including profile photos and banners.</p>}
      {policy && <p className="text-xs text-muted-foreground">Your {formatBytes(policy.account_storage_bytes)} storage budget includes temporary originals and processing space.
        {budget && ` ${formatBytes(budget.available_bytes)} is currently available; ${budget.unfinished_uploads}/${budget.max_unfinished_uploads} uploads are unfinished.`}
        {` Each new post image initially reserves ${formatBytes(policy.original_reservation_bytes + policy.processing_headroom.post)}; four need ${formatBytes(4 * (policy.original_reservation_bytes + policy.processing_headroom.post))}. Space for the whole selection is checked before transfer.`}</p>}
      {policyError && <p role="alert" className="text-sm">{policyError}</p>}
      {attachments.map((attachment, index) => <section key={attachment.key} aria-label={`Attachment ${index + 1}`} className="space-y-2">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <strong>Image {index + 1}</strong>
          <button type="button" disabled={index === 0} onClick={() => reorder(index, -1)} className="underline disabled:opacity-40">Move up</button>
          <button type="button" disabled={index === attachments.length - 1} onClick={() => reorder(index, 1)} className="underline disabled:opacity-40">Move down</button>
          <button type="button" onClick={() => setAttachments((items) => items.filter((item) => item.key !== attachment.key))} className="ml-auto text-primary underline">Remove</button>
        </div>
        {policy && <ImageUploader policy={policy} canUpload={false} selectOnly disabled={busy}
          onSelected={(image) => setAttachments((items) => items.map((item) => item.key === attachment.key ? { ...item, image } : item))} />}
      </section>)}
      <button type="button" disabled={!policy || attachments.length >= policy.max_images_per_post}
        onClick={() => setAttachments((items) => policy && items.length < policy.max_images_per_post
          ? [...items, { key: crypto.randomUUID(), image: null }] : items)}
        className="rounded-full border border-primary px-4 py-2 text-sm font-bold text-primary disabled:opacity-40">Add image</button>
    </fieldset>
    <p className="text-xs text-muted-foreground">Your post will be screened automatically and visible only to you until approved.</p>
    {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex justify-end gap-3">
      {!busy && <Link href="/" className="px-4 py-2 text-sm">Cancel</Link>}
      <button type="submit" disabled={!valid || busy} className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-40">{busy ? "Saving…" : "Post"}</button>
    </div>
  </form>;
}
