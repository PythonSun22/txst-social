"use client";

import { useEffect, useState } from "react";
import { getImage, retryImage, type SavedImage } from "@/lib/images/image-api";

/** Owner-only state for a pending avatar/banner; never replaces the active asset. */
export default function ImageProcessingNotice({ id, label }: { id: string; label: string }) {
  const [image, setImage] = useState<SavedImage | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const updated = await getImage(id, controller.signal);
        if (controller.signal.aborted) return;
        setImage(updated);
        if (!["pending", "processing"].includes(updated.processing_status)) return;
      } catch {
        if (controller.signal.aborted) return;
      }
      timer = setTimeout(() => void refresh(), 5000);
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [id, reload]);
  const current = image?.id === id ? image : null;
  return <div>
    <p>{label}: {current?.processing_message ?? "Waiting for image processing and moderation."}</p>
    {current?.can_retry && <button type="button" disabled={busy} className="underline" onClick={async () => {
      setBusy(true); setError("");
      try { setImage(await retryImage(id)); setReload(n => n + 1); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to retry processing."); }
      finally { setBusy(false); }
    }}>Retry processing</button>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
