import { apiRequest } from "../api";
import { getSupabase } from "../supabase";
import type { ImagePolicy } from "./image-policy";
import type { SelectedImage } from "./image-file";

export interface SavedImage {
  id: string;
  bucket_id: string;
  object_key: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  width: number;
  height: number;
  created_at: string;
  uploaded_at: string | null;
}

export async function getImagePolicy(signal?: AbortSignal): Promise<ImagePolicy> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${base.replace(/\/$/, "")}/images/policy`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load image limits. Check that the backend is running.");
  return response.json();
}

export const listImages = (signal?: AbortSignal) => apiRequest<SavedImage[]>("/images", { signal });
export const completeImage = (id: string) => apiRequest<SavedImage>(`/images/${id}/complete`, { method: "POST" });
export const previewImage = (id: string) => apiRequest<{ url: string }>(`/images/${id}/preview`);

/** Carries the reservation across failures so a completed transfer can be confirmed again. */
export class ImageTransferError extends Error {
  constructor(message: string, public readonly uploadId: string) {
    super(message);
    this.name = "ImageTransferError";
  }
}

/** Reusable pipeline. A future crop step supplies a new inspected File to this same function. */
export async function uploadImage(image: SelectedImage, onStage: (stage: string) => void): Promise<SavedImage> {
  if (image.errors.length || !image.width || !image.height) throw new Error("Choose a valid image first.");
  onStage("Preparing upload…");
  const ticket = await apiRequest<{ upload: SavedImage; token: string }>("/images", {
    method: "POST",
    body: JSON.stringify({
      original_name: image.file.name.trim(), content_type: image.file.type,
      size_bytes: image.file.size, width: image.width, height: image.height,
    }),
  });
  try {
    onStage("Uploading image…");
    const { error } = await getSupabase().storage.from(ticket.upload.bucket_id)
      .uploadToSignedUrl(ticket.upload.object_key, ticket.token, image.file, { contentType: image.file.type });
    if (error) throw new Error("The transfer could not be confirmed. Retry confirmation or select the image again.");
    onStage("Confirming saved image…");
    return await completeImage(ticket.upload.id);
  } catch (cause) {
    throw new ImageTransferError(cause instanceof Error ? cause.message : "The upload could not be completed.", ticket.upload.id);
  }
}
