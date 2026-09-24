/** Source-pixel crop coordinates shared by the editor and canvas exporter. */
export interface CropRect { x: number; y: number; width: number; height: number }
export const MAX_EXPORT_EDGE = 4096;

export function clampCrop(crop: CropRect, width: number, height: number): CropRect {
  const x = Math.max(0, Math.min(width - 1, Math.round(crop.x)));
  const y = Math.max(0, Math.min(height - 1, Math.round(crop.y)));
  return { x, y, width: Math.max(1, Math.min(width - x, Math.round(crop.width))),
    height: Math.max(1, Math.min(height - y, Math.round(crop.height))) };
}

export function centeredCrop(width: number, height: number, ratio: number): CropRect {
  const w = Math.min(width, height * ratio);
  const h = w / ratio;
  return clampCrop({ x: (width - w) / 2, y: (height - h) / 2, width: w, height: h }, width, height);
}

/** Downscale proportionally, with a bounded canvas allocation and no upscaling. */
export function outputSize(crop: CropRect, requestedWidth: number) {
  const scale = Math.min(1, Math.max(1, requestedWidth) / crop.width,
    MAX_EXPORT_EDGE / crop.width, MAX_EXPORT_EDGE / crop.height);
  return { width: Math.max(1, Math.round(crop.width * scale)), height: Math.max(1, Math.round(crop.height * scale)) };
}

/** Export edited pixels as a new file. Storage never receives the untouched source by accident. */
export async function exportImage(source: HTMLImageElement, file: File, crop: CropRect, width: number): Promise<File> {
  const safe = clampCrop(crop, source.naturalWidth, source.naturalHeight);
  const size = outputSize(safe, width);
  const canvas = document.createElement("canvas");
  canvas.width = size.width; canvas.height = size.height;
  try {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not open the image editor.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, safe.x, safe.y, safe.width, safe.height, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error("Unable to export this image. Try a smaller output size.")), file.type, 0.9,
    ));
    const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[blob.type];
    if (!extension) throw new Error("Your browser cannot export this image format.");
    const stem = [...file.name.replace(/\.[^.]+$/, "")].slice(0, 230).join("");
    return new File([blob], `${stem}-edited.${extension}`, { type: blob.type });
  } finally {
    canvas.width = 0; canvas.height = 0;
  }
}
