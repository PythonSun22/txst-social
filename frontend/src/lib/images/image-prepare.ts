import type { SelectedImage } from "./image-file";
import type { ImagePurpose } from "./image-api";

/** Browser preparation targets; backend presets still define the saved variants. */
export const UPLOAD_PRESETS = {
  post: { edge: 2000, targetBytes: 1_000_000 },
  avatar: { edge: 512, targetBytes: 200_000 },
  banner: { edge: 1600, targetBytes: 600_000 },
};

/** Re-encode every selection, including small files, to normalize orientation/metadata.
 * Never fall back to transferring untouched original bytes.
 */
export async function prepareImage(image: SelectedImage, purpose: ImagePurpose, maxBytes: number): Promise<SelectedImage> {
  if (image.errors.length || !image.width || !image.height) throw new Error("Choose a valid image first.");
  if (image.width * image.height > 25_000_000) throw new Error("Choose an image with at most 25 million pixels.");
  const preset = UPLOAD_PRESETS[purpose];
  const url = URL.createObjectURL(image.file);
  const canvas = document.createElement("canvas");
  try {
    const source = new Image();
    source.src = url;
    await source.decode();
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser cannot prepare this image.");
    const width = source.naturalWidth;
    const height = source.naturalHeight;
    const cropEdge = Math.min(width, height);
    const cropWidth = purpose === "avatar" ? cropEdge : width;
    const cropHeight = purpose === "avatar" ? cropEdge : height;
    let scale = Math.min(1, preset.edge / Math.max(cropWidth, cropHeight));
    let best: SelectedImage | null = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      canvas.width = Math.max(1, Math.round(cropWidth * scale));
      canvas.height = Math.max(1, Math.round(cropHeight * scale));
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(source, (width - cropWidth) / 2, (height - cropHeight) / 2,
        cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.85, 0.75, 0.65, 0.55]) {
        const encode = (type: string) => new Promise<Blob>((resolve, reject) => canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error("Unable to compress this image.")), type, quality));
        let blob = await encode("image/webp");
        if (blob.type !== "image/webp") {
          // JPEG fallback has an explicit white background for transparent inputs.
          context.globalCompositeOperation = "destination-over";
          context.fillStyle = "white";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.globalCompositeOperation = "source-over";
          blob = await encode("image/jpeg");
        }
        if (!["image/webp", "image/jpeg"].includes(blob.type)) throw new Error("Your browser cannot export a supported image format.");
        if (blob.size > 0 && blob.size <= maxBytes && (!best || blob.size < best.file.size)) {
          const stem = [...image.file.name.replace(/\.[^.]+$/, "")].slice(0, 230).join("");
          const file = new File([blob], `${stem}.${blob.type === "image/webp" ? "webp" : "jpg"}`, { type: blob.type });
          best = { file, width: canvas.width, height: canvas.height, previewUrl: null, errors: [] };
          if (blob.size <= preset.targetBytes) return best;
        }
      }
      scale *= 0.8;
    }
    if (best) return best;
    throw new Error("This image could not be compressed below the upload limit. Try a smaller image.");
  } finally {
    URL.revokeObjectURL(url);
    canvas.width = 0;
    canvas.height = 0;
  }
}
