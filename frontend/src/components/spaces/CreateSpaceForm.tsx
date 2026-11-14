"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "@/components/images/ImageUploader";
import ImageProcessingNotice from "@/components/images/ImageProcessingNotice";
import { getImage, getImagePolicy, type SavedImage } from "@/lib/images/image-api";
import type { ImagePolicy } from "@/lib/images/image-policy";
import { createSpace, spaceHref } from "@/lib/spaces";
import { useSpaces } from "./SpacesProvider";

const field = "mt-2 block w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export default function CreateSpaceForm() {
  const { profile } = useSpaces();
  return <CreateSpaceContent key={profile?.id ?? "guest"} />;
}

function CreateSpaceContent() {
  const router = useRouter();
  const { profile, loading, error: accountError, reload } = useSpaces();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [policy, setPolicy] = useState<ImagePolicy | null>(null);
  const [policyError, setPolicyError] = useState("");
  const [image, setImage] = useState<SavedImage | null>(null);
  const [photoSelected, setPhotoSelected] = useState(false);
  const [photoRevision, setPhotoRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const selectedFile = useRef<File | null>(null);
  const uploadedPhotos = useRef(new Map<File, SavedImage>());

  useEffect(() => {
    const controller = new AbortController();
    getImagePolicy(controller.signal).then((value) => { if (!controller.signal.aborted) setPolicy(value); })
      .catch(() => { if (!controller.signal.aborted) setPolicyError("Photo uploads are unavailable. You can still create a space without a photo."); });
    return () => { controller.abort(); request.current?.abort(); };
  }, []);

  const imageId = image?.id;
  const imageProcessed = useCallback(async (signal: AbortSignal) => {
    if (!imageId) return;
    const updated = await getImage(imageId, signal);
    if (!signal.aborted) setImage(updated);
  }, [imageId]);

  const valid = name.trim().length >= 3 && description.trim().length > 0
    && /^[a-z0-9_]{3,21}$/.test(slug) && slug !== "create"
    && (!photoSelected || image?.processing_status === "ready");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || !profile?.email_verified || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setSaving(true); setError("");
    try {
      const space = await createSpace({ name: name.trim(), slug, description: description.trim(), rules: rules.trim(),
        icon_image_upload_id: photoSelected ? image!.id : null }, controller.signal);
      if (!controller.signal.aborted) { reload(); router.replace(spaceHref(space.slug)); }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "Unable to create your space.");
        setSaving(false);
      }
    } finally { if (request.current === controller) request.current = null; }
  }

  if (loading) return <p role="status">Loading your account…</p>;
  if (accountError) return <p role="alert">{accountError} <button type="button" onClick={reload} className="underline">Retry</button></p>;
  if (!profile) return <p><Link href="/login" className="font-semibold text-primary underline">Sign in</Link> to create a space.</p>;
  if (!profile.email_verified) return <p>Verify your Texas State email before creating a space.</p>;

  return <section>
    <Link href="/spaces" className="text-sm font-semibold text-primary hover:underline">← All spaces</Link>
    <h1 className="mt-4 font-serif text-3xl font-bold text-primary">Create a space</h1>
    <p className="mt-2 text-sm text-muted-foreground">Start a public community for fellow Bobcats. You’ll automatically follow it and become its first moderator.</p>
    <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-5">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <fieldset disabled={saving} className="space-y-5">
        <div>
          <label htmlFor="space-name" className="text-sm font-semibold">Name</label>
          <input id="space-name" required minLength={3} maxLength={80} value={name} className={field} onChange={(event) => {
            setName(event.target.value);
            if (!slugEdited) setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 21));
          }} />
        </div>
        <div>
          <label htmlFor="space-slug" className="text-sm font-semibold">URL handle</label>
          <input id="space-slug" required minLength={3} maxLength={21} pattern="[a-z0-9_]{3,21}" autoCapitalize="none" spellCheck={false}
            value={slug} className={field} onChange={(event) => { setSlugEdited(true); setSlug(event.target.value.toLowerCase()); }} />
          <p className="mt-2 text-xs text-muted-foreground">/spaces/{slug || "your_space"} · 3–21 letters, numbers, or underscores.</p>
          {slug === "create" && <p className="mt-1 text-xs text-red-700">This URL handle is reserved. Choose another.</p>}
        </div>
        <div>
          <label htmlFor="space-description" className="text-sm font-semibold">Description</label>
          <textarea id="space-description" required maxLength={500} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className={field} />
        </div>
        <div>
          <label htmlFor="space-rules" className="text-sm font-semibold">Rules <span className="font-normal text-muted-foreground">(optional)</span></label>
          <textarea id="space-rules" maxLength={2000} rows={3} value={rules} onChange={(event) => setRules(event.target.value)} className={field} />
        </div>
        <section aria-labelledby="space-photo-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="space-photo-heading" className="text-sm font-semibold">Space photo <span className="font-normal text-muted-foreground">(optional)</span></h2>
            {photoSelected && <button type="button" className="text-sm text-primary underline" onClick={() => {
              setImage(null); setPhotoSelected(false); selectedFile.current = null;
              uploadedPhotos.current.clear(); setPhotoRevision((value) => value + 1);
            }}>Remove photo</button>}
          </div>
          <p className="text-xs text-muted-foreground">Upload your photo and wait for screening to finish before creating the space. Without a photo, your space will use the paw icon.</p>
          {policy && <ImageUploader key={photoRevision} purpose="avatar" cropShape="circle" policy={policy} canUpload={profile.email_verified} disabled={saving}
            onSelected={(selected) => {
              setPhotoSelected(true); selectedFile.current = selected?.file ?? null;
              setImage(selected ? uploadedPhotos.current.get(selected.file) ?? null : null);
            }} onUploaded={(saved) => {
              if (selectedFile.current) uploadedPhotos.current.set(selectedFile.current, saved);
              setImage(saved);
            }} />}
          {policyError && <p role="status" className="text-sm text-muted-foreground">{policyError}</p>}
          {image && <ImageProcessingNotice key={image.id} id={image.id} label="Space photo" onProcessed={imageProcessed} />}
        </section>
      </fieldset>
      <div className="flex justify-end gap-3">
        <Link href="/spaces" className="rounded-full border border-primary px-5 py-2 text-sm font-semibold text-primary">Cancel</Link>
        <button type="submit" disabled={saving || !valid} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50">{saving ? "Creating…" : "Create Space"}</button>
      </div>
    </form>
  </section>;
}
