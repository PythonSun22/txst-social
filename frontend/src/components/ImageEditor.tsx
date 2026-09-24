"use client";

/* eslint-disable @next/next/no-img-element -- The editor needs intrinsic pixels from a local blob URL. */
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { clampCrop, centeredCrop, exportImage, outputSize, type CropRect } from "@/lib/images/image-edit";
import { inspectImage, type SelectedImage } from "@/lib/images/image-file";
import type { ImagePolicy } from "@/lib/images/image-policy";

interface Props {
  image: SelectedImage;
  policy: ImagePolicy;
  onSave: (image: SelectedImage) => void;
  onDiscard: () => void;
}

/** Transactional local editing: only Save replaces the uploader's selected file. */
export default function ImageEditor({ image, policy, onSave, onDiscard }: Props) {
  const width = image.width!;
  const height = image.height!;
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width, height });
  const [requestedWidth, setRequestedWidth] = useState(String(outputSize({ x: 0, y: 0, width, height }, width).width));
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const source = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; pointer: number } | null>(null);
  const saving = useRef(false);
  const mounted = useRef(false);
  const size = outputSize(crop, Number(requestedWidth) || 1);
  const validWidth = /^\d+$/.test(requestedWidth) && Number(requestedWidth) >= 1;

  useEffect(() => {
    mounted.current = true;
    const modal = dialog.current!;
    modal.showModal();
    return () => { mounted.current = false; modal.close(); };
  }, []);

  function point(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(width, (event.clientX - bounds.left) / bounds.width * width)),
      y: Math.max(0, Math.min(height, (event.clientY - bounds.top) / bounds.height * height)) };
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || start.pointer !== event.pointerId) return;
    const end = point(event);
    if (Math.abs(end.x - start.x) < 1 && Math.abs(end.y - start.y) < 1) return;
    setCrop(clampCrop({ x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) }, width, height));
  }

  async function save() {
    if (saving.current || !source.current || !loaded || !validWidth) return;
    saving.current = true; setBusy(true); setError("");
    try {
      const file = await exportImage(source.current, image.file, crop, Number(requestedWidth));
      const edited = await inspectImage(file, policy);
      if (!mounted.current) {
        if (edited.previewUrl) URL.revokeObjectURL(edited.previewUrl);
        return;
      }
      if (edited.errors.length) {
        if (edited.previewUrl) URL.revokeObjectURL(edited.previewUrl);
        throw new Error(`${edited.errors.join(" ")} Reduce the output width and save again.`);
      }
      onSave(edited);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Unable to save edits.");
    } finally {
      saving.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return <dialog ref={dialog} aria-labelledby="image-editor-title"
    onCancel={(event) => { event.preventDefault(); if (!saving.current) onDiscard(); }}
    className="fixed inset-0 m-auto max-h-[90dvh] w-[min(94vw,44rem)] overflow-y-auto rounded-card border border-border bg-card p-5 text-foreground shadow-xl backdrop:bg-black/60">
    <h2 id="image-editor-title" className="font-serif text-xl font-bold text-primary">Crop and resize</h2>
    <p className="my-3 text-sm text-muted-foreground">Drag across the image to select a crop, or enter pixel coordinates below. Resizing keeps the crop’s proportions.</p>
    <fieldset disabled={busy} className="space-y-4">
      <div className="flex flex-wrap gap-2" aria-label="Crop presets">
        {[['Full image', width / height], ['Square', 1], ['Portrait 4:5', 4 / 5], ['Landscape 16:9', 16 / 9]].map(([label, ratio]) =>
          <button key={label} type="button" className="rounded-full border border-border px-3 py-1 text-sm hover:bg-muted disabled:opacity-50"
            onClick={() => setCrop(centeredCrop(width, height, Number(ratio)))}>{label}</button>)}
      </div>
      <div className="flex justify-center rounded-card bg-muted p-2">
        <div className={`relative overflow-hidden ${busy || !loaded ? "pointer-events-none" : "cursor-crosshair touch-none"}`}
          style={{ width: `min(100%, ${40 * width / height}dvh)`, aspectRatio: `${width} / ${height}` }}
          onPointerDown={(event) => {
            if (busy || !loaded || !event.isPrimary || event.button !== 0) return;
            event.preventDefault();
            drag.current = { ...point(event), pointer: event.pointerId };
            event.currentTarget.setPointerCapture(event.pointerId);
          }} onPointerMove={move} onPointerUp={(event) => { move(event); drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}>
          <img ref={source} src={image.previewUrl!} alt="Image to crop" draggable={false}
            width={width} height={height} className="block h-full w-full select-none"
            onLoad={() => setLoaded(true)} onError={() => setError("The source image could not be loaded. Discard and select it again.")} />
          <div className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
            style={{ left: `${crop.x / width * 100}%`, top: `${crop.y / height * 100}%`, width: `${crop.width / width * 100}%`, height: `${crop.height / height * 100}%` }}>
            <div className="absolute inset-x-1/3 inset-y-0 border-x border-white/50" /><div className="absolute inset-x-0 inset-y-1/3 border-y border-white/50" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['x', 'y', 'width', 'height'] as const).map((key) => <label key={key} className="text-sm">
          {{ x: 'Left (px)', y: 'Top (px)', width: 'Crop width', height: 'Crop height' }[key]}
          <input type="number" step="1" min={key === 'x' || key === 'y' ? 0 : 1}
            max={key === 'x' ? width - 1 : key === 'y' ? height - 1 : key === 'width' ? width - crop.x : height - crop.y}
            value={crop[key]} onChange={(event) => {
              if (Number.isFinite(event.target.valueAsNumber)) setCrop(clampCrop({ ...crop, [key]: event.target.valueAsNumber }, width, height));
            }} className="mt-1 w-full rounded border border-border bg-secondary p-2" />
        </label>)}
      </div>
      <label className="block text-sm">Output width (px)
        <input type="number" min="1" step="1" value={requestedWidth}
          onChange={(event) => setRequestedWidth(event.target.value)} className="ml-3 w-28 rounded border border-border bg-secondary p-2" />
      </label>
      <p className="text-sm" aria-live="polite">Output: {size.width} × {size.height} px. No enlargement; maximum edge 4096 px.</p>
      <p className="text-xs text-muted-foreground">Saving creates a still image and re-encodes it. Animation and embedded metadata are not retained. Changes stay in this browser until you submit.</p>
    </fieldset>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    <div className="mt-5 flex flex-wrap justify-end gap-3">
      <button type="button" disabled={busy} onClick={onDiscard} className="rounded-full border border-border px-4 py-2 text-sm font-bold disabled:opacity-40">Discard changes</button>
      <button type="button" disabled={busy || !loaded || !validWidth} onClick={() => void save()}
        className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-40">{busy ? "Saving…" : "Save changes"}</button>
    </div>
  </dialog>;
}
