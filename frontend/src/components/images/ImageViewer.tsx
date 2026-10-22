"use client";
/* eslint-disable @next/next/no-img-element -- Authorized, expiring Storage URLs. */
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";

/** Only request the expanded file after the viewer opens. Native dialog handles
 * focus trapping, Escape and focus restoration. */
export default function ImageViewer({ resource, title, onClose, onPrevious, onNext }: {
  resource: string; title: string; onClose: () => void;
  onPrevious?: () => void; onNext?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [result, setResult] = useState<{ resource: string; url?: string; error?: string } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ url: string }>(resource, { signal: controller.signal }, true)
      .then(({ url }) => { if (!controller.signal.aborted) setResult({ resource, url }); })
      .catch((cause) => { if (!controller.signal.aborted) setResult({ resource,
        error: cause instanceof Error ? cause.message : "Unable to load image." }); });
    return () => controller.abort();
  }, [resource, retry]);
  const current = result?.resource === resource ? result : null;
  return <dialog ref={dialog} aria-label={title}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClose={(event) => {
      // Strict Mode replays the effect: close() queues an event, then showModal()
      // reopens the dialog. Ignore that stale event rather than unmounting it.
      if (!event.currentTarget.open) onClose();
    }}
    className="fixed inset-0 m-auto max-h-[95dvh] w-[min(96vw,80rem)] rounded-xl bg-black p-4 text-white backdrop:bg-black/80">
    <div className="mb-3 flex items-center justify-between gap-4">
      <p>{title}</p>
      <button type="button" autoFocus onClick={onClose} className="rounded border px-3 py-1">Close</button>
    </div>
    {!current && <p role="status">Loading larger image…</p>}
    {current?.error && <p role="alert">{current.error} <button type="button" className="underline" onClick={() => { setResult(null); setRetry(n => n + 1); }}>Retry</button></p>}
    {current?.url && !current.error && <img src={current.url} alt={title} className="mx-auto max-h-[75dvh] max-w-full object-contain"
      onError={() => setResult({ resource, error: "Image expired or unavailable." })} />}
    {(onPrevious || onNext) && <div className="mt-3 flex justify-between gap-3">
      <button type="button" disabled={!onPrevious} onClick={onPrevious} className="rounded border px-3 py-1 disabled:opacity-40">Previous</button>
      <button type="button" disabled={!onNext} onClick={onNext} className="rounded border px-3 py-1 disabled:opacity-40">Next</button>
    </div>}
  </dialog>;
}
