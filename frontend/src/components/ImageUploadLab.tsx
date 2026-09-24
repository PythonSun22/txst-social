"use client";

/* eslint-disable @next/next/no-img-element -- Private, expiring Storage URLs are fetched directly by the owner. */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ImageUploader from "./ImageUploader";
import { getCurrentProfile, type CurrentProfile } from "@/lib/api";
import { getImagePolicy, listImages, previewImage, type SavedImage } from "@/lib/images/image-api";
import { aspectRatio, formatBytes, type ImagePolicy } from "@/lib/images/image-policy";

/** Test harness around the same uploader that can be embedded in PostComposer. */
export default function ImageUploadLab() {
  const [policy, setPolicy] = useState<ImagePolicy | null>(null);
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [images, setImages] = useState<SavedImage[]>([]);
  const [preview, setPreview] = useState<{ url: string; image: SavedImage } | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const previewGeneration = useRef({ request: 0 });

  useEffect(() => {
    const lifecycle = previewGeneration.current;
    const controller = new AbortController();
    async function load() {
      const results = await Promise.allSettled([getImagePolicy(controller.signal), getCurrentProfile(controller.signal)]);
      if (controller.signal.aborted) return;
      const [limits, account] = results;
      if (limits.status === "fulfilled") setPolicy(limits.value);
      if (account.status === "fulfilled") setProfile(account.value);
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") setError(failed.reason instanceof Error ? failed.reason.message : "Unable to load upload settings.");
      if (account.status === "fulfilled" && account.value) {
        try {
          const saved = await listImages(controller.signal);
          if (!controller.signal.aborted) setImages(saved);
        } catch (cause) {
          if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load saved images.");
        }
      }
      if (!controller.signal.aborted) setLoading(false);
    }
    void load();
    return () => { controller.abort(); lifecycle.request++; };
  }, [reload]);

  async function showPreview(image: SavedImage) {
    const request = ++previewGeneration.current.request;
    setPreviewError(""); setPreview(null); setPreviewBusy(true);
    try {
      const result = await previewImage(image.id);
      if (request === previewGeneration.current.request) setPreview({ url: result.url, image });
    } catch (cause) {
      if (request === previewGeneration.current.request) setPreviewError(cause instanceof Error ? cause.message : "Unable to load preview.");
    } finally {
      if (request === previewGeneration.current.request) setPreviewBusy(false);
    }
  }

  return <section className="space-y-5">
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Upload playground</p>
      <h1 className="mt-1 font-serif text-2xl font-bold text-primary">Test an image upload</h1>
      <p className="mt-2 text-sm text-muted-foreground">Check the size and shape of an image before saving it. Test uploads stay private to your account.</p>
    </div>
    {loading && <p role="status" className="text-sm">Loading upload settings and account…</p>}
    {error && <div role="alert" className="rounded-card border border-border bg-card p-3 text-sm">
      <p>{error}</p>
      <button type="button" className="mt-2 font-bold text-primary underline" onClick={() => {
        setLoading(true); setError(""); setProfile(null); setImages([]); setPreview(null); setReload((value) => value + 1);
      }}>Retry loading</button>
    </div>}
    {!loading && !profile && <p className="text-sm"><Link href="/login" className="font-bold text-primary underline">Sign in</Link> with a verified Texas State account to save an image. You can inspect a file before signing in.</p>}
    {profile && !profile.email_verified && <p className="text-sm">Verify your Texas State email before saving an image.</p>}
    {policy && <ImageUploader policy={policy} canUpload={!loading && !!profile?.email_verified} onUploaded={(image) => {
      setImages((current) => [image, ...current.filter((item) => item.id !== image.id)].slice(0, 20));
      void showPreview(image);
    }} />}
    <section className="space-y-3" aria-labelledby="saved-images-heading">
      <h2 id="saved-images-heading" className="font-serif text-lg font-bold text-primary">Your recent uploads</h2>
      <p className="text-sm text-muted-foreground">The last 20 saved images appear here, including after you refresh the page.</p>
      {!loading && images.length === 0 && <p className="text-sm text-muted-foreground">No saved images to show.</p>}
      {images.length > 0 && <ul className="divide-y divide-border rounded-card border border-border bg-card">
        {images.map((image) => <li key={image.id} className="flex items-center justify-between gap-3 p-3 text-sm">
          <div className="min-w-0"><p className="break-all font-semibold">{image.original_name}</p><p className="text-xs text-muted-foreground">{formatBytes(image.size_bytes)} · {image.width} × {image.height} px · {aspectRatio(image.width, image.height)}</p></div>
          <button type="button" className="shrink-0 rounded-full border border-primary px-3 py-1 font-bold text-primary hover:bg-secondary" onClick={() => void showPreview(image)}>View saved</button>
        </li>)}
      </ul>}
      {previewBusy && <p role="status" className="text-sm">Loading saved image…</p>}
      {previewError && <p role="alert" className="text-sm text-red-700">{previewError}</p>}
      {preview && <figure className="rounded-card border border-border bg-card p-3">
        <img src={preview.url} alt={`Saved upload: ${preview.image.original_name}`} width={preview.image.width} height={preview.image.height}
          className="mx-auto max-h-96 w-auto max-w-full object-contain" onError={() => setPreviewError("This preview could not load or has expired. Click View saved to refresh it.")} />
        <figcaption className="mt-2 text-center text-xs text-muted-foreground">Saved image · Full aspect ratio preserved</figcaption>
      </figure>}
    </section>
  </section>;
}
