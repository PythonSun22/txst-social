"use client";

/* eslint-disable @next/next/no-img-element -- Local blob previews preserve the selected bytes and dimensions. */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { inspectImage, type SelectedImage } from "@/lib/images/image-file";
import { aspectRatio, formatBytes, type ImagePolicy } from "@/lib/images/image-policy";
import { completeImage, ImageTransferError, uploadImage, type SavedImage } from "@/lib/images/image-api";

interface ImageUploaderProps {
  policy: ImagePolicy;
  canUpload: boolean;
  onUploaded: (image: SavedImage) => void;
}

/** Reusable selector/validator/transfer UI; it has no knowledge of posts or feed state. */
export default function ImageUploader({ policy, canUpload, onUploaded }: ImageUploaderProps) {
  const [selected, setSelected] = useState<SelectedImage | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(false);
  const [retryId, setRetryId] = useState<string | null>(null);
  const generation = useRef({ request: 0 });
  const previewUrl = useRef<string | null>(null);
  const alive = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    const lifecycle = generation.current;
    alive.current = true;
    return () => {
      alive.current = false;
      lifecycle.request++;
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);

  async function choose(files: FileList | null) {
    if (inFlight.current || !files?.length) return;
    const request = ++generation.current.request;
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    setSelected(null); setError(""); setNotice(""); setSaved(false); setRetryId(null);
    if (files.length !== 1) {
      setInspecting(false);
      setError("Choose one image at a time.");
      return;
    }
    setInspecting(true);
    try {
      const next = await inspectImage(files[0], policy);
      if (request !== generation.current.request || !alive.current) {
        if (next.previewUrl) URL.revokeObjectURL(next.previewUrl);
        return;
      }
      previewUrl.current = next.previewUrl;
      setSelected(next);
    } catch {
      if (request === generation.current.request && alive.current) setError("Unable to read this file. Choose it again.");
    } finally {
      if (request === generation.current.request && alive.current) setInspecting(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected || !valid || !canUpload || inFlight.current || saved) return;
    inFlight.current = true;
    setBusy(true); setError("");
    try {
      const result = retryId ? await completeImage(retryId) : await uploadImage(selected, (stage) => {
        if (alive.current) setNotice(stage);
      });
      if (alive.current) {
        setSaved(true); setRetryId(null);
        setNotice("Image saved privately. It is not published to a post.");
        onUploaded(result);
      }
    } catch (cause) {
      if (alive.current) {
        if (cause instanceof ImageTransferError) setRetryId(cause.uploadId);
        setError(cause instanceof Error ? cause.message : "Upload failed. Try again.");
        setNotice("");
      }
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }

  const valid = !!selected && selected.errors.length === 0 && !!selected.width && !!selected.height;
  const ready = valid && canUpload && !busy && !inspecting && !saved;

  return (
    <form onSubmit={submit} className="space-y-4 rounded-card border border-border bg-card p-5">
      <label
        className={`relative flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed p-6 text-center transition-colors focus-within:outline-2 focus-within:outline-ring ${dragging ? "border-primary bg-primary/10" : "border-border bg-secondary"} ${busy ? "pointer-events-none opacity-60" : "hover:border-primary"}`}
        onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); void choose(event.dataTransfer.files); }}
      >
        <input type="file" accept={policy.allowed_types.join(",")} disabled={busy}
          className="sr-only" aria-label="Choose an image" aria-describedby="image-upload-limits"
          onChange={(event) => { void choose(event.target.files); event.target.value = ""; }} />
        <span className="text-3xl text-primary" aria-hidden="true">↑</span>
        <span className="font-semibold text-primary">Drop an image here, or click to browse</span>
        <span id="image-upload-limits" className="text-sm text-muted-foreground">
          JPEG, PNG, WebP · Up to {formatBytes(policy.max_bytes)} · Original aspect ratio
        </span>
      </label>

      {inspecting && <p role="status" className="text-sm">Reading image…</p>}
      {selected && <div className="space-y-3">
        {selected.previewUrl && <img src={selected.previewUrl} alt="Selected image preview"
          width={selected.width!} height={selected.height!}
          className="mx-auto max-h-80 w-auto max-w-full rounded-card object-contain" />}
        <p className="break-all text-sm font-semibold">{selected.file.name}</p>
        <dl className="grid grid-cols-1 gap-3 rounded-card bg-secondary p-3 text-sm sm:grid-cols-3">
          <div><dt className="text-muted-foreground">File size</dt><dd className="font-semibold">{formatBytes(selected.file.size)}</dd><dd className="text-xs text-muted-foreground">{selected.file.size.toLocaleString()} bytes</dd></div>
          <div><dt className="text-muted-foreground">Dimensions</dt><dd className="font-semibold">{selected.width ? `${selected.width} × ${selected.height} px` : "Not inspected"}</dd></div>
          <div><dt className="text-muted-foreground">Aspect ratio</dt><dd className="font-semibold">{selected.width && selected.height ? aspectRatio(selected.width, selected.height) : "Not inspected"}</dd></div>
        </dl>
        {selected.errors.length > 0 && <ul role="alert" className="list-inside list-disc text-sm text-red-700">
          {selected.errors.map((message) => <li key={message}>{message}</li>)}
        </ul>}
        {valid && !saved && <p className="text-sm font-semibold text-green-800">Within limits. The whole image will be preserved.</p>}
      </div>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="text-sm font-semibold text-primary">{notice}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={!ready}
          className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground transition-shadow enabled:ring-2 enabled:ring-accent enabled:ring-offset-2 enabled:hover:bg-[#3a0c0e] disabled:cursor-not-allowed disabled:opacity-40">
          {busy ? "Saving…" : saved ? "Saved" : retryId ? "Retry confirmation" : "Submit image"}
        </button>
      </div>
    </form>
  );
}
