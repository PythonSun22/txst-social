import { apiRequest } from "../api";
import { getSupabase } from "../supabase";
import type { ImagePolicy } from "./image-policy";
import type { SelectedImage } from "./image-file";
export type ImagePurpose = "post" | "avatar" | "banner";
export type ImageVariant = "preview" | "expanded" | "avatar_small" | "avatar_large" | "banner";

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
  purpose: ImagePurpose;
  processing_status: "pending" | "processing" | "ready" | "blocked" | "failed";
  variants: { name: ImageVariant; width: number; height: number; size_bytes: number; content_type: string }[];
  original_deleted_at: string | null;
}

export interface UploadTicket { upload: SavedImage; token: string }
export interface StorageBudget {
  limit_bytes: number; stored_bytes: number; reserved_bytes: number;
  used_bytes: number; available_bytes: number;
  unfinished_uploads: number; max_unfinished_uploads: number;
}
export const getStorageBudget = (signal?: AbortSignal) => apiRequest<StorageBudget>("/images/budget", { signal });

function uploadPayload(image: SelectedImage, purpose: ImagePurpose) {
  if (image.errors.length || !image.width || !image.height) throw new Error("Choose a valid image first.");
  return { original_name: image.file.name.trim(), content_type: image.file.type,
    size_bytes: image.file.size, width: image.width, height: image.height, purpose };
}

/** Reserve the complete selection atomically before any file bytes are transferred. */
export const reserveImages = (images: SelectedImage[], purpose: ImagePurpose = "post") =>
  apiRequest<UploadTicket[]>("/images/batch", { method: "POST",
    body: JSON.stringify({ images: images.map((image) => uploadPayload(image, purpose)) }) });

export async function getImagePolicy(signal?: AbortSignal): Promise<ImagePolicy> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${base.replace(/\/$/, "")}/images/policy`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load image limits. Check that the backend is running.");
  return response.json();
}

export const listImages = (signal?: AbortSignal) => apiRequest<SavedImage[]>("/images", { signal });
export const completeImage = (id: string) => apiRequest<SavedImage>(`/images/${id}/complete`, { method: "POST" });
export const getImage = (id: string, signal?: AbortSignal) => apiRequest<SavedImage>(`/images/${id}`, { signal });
export const previewImage = (id: string, variant?: ImageVariant) =>
  apiRequest<{ url: string }>(`/images/${id}/preview${variant ? `?variant=${variant}` : ""}`);

/** Carries the reservation across failures so a completed transfer can be confirmed again. */
export class ImageTransferError extends Error {
  constructor(message: string, public readonly uploadId: string) {
    super(message);
    this.name = "ImageTransferError";
  }
}

/** Transfers an inspected original or edited File without coupling the asset to a post. */
export async function uploadImage(image: SelectedImage, onStage: (stage: string) => void, purpose: ImagePurpose = "post"): Promise<SavedImage> {
  onStage("Preparing upload…");
  const ticket = await apiRequest<UploadTicket>("/images", {
    method: "POST",
    body: JSON.stringify(uploadPayload(image, purpose)),
  });
  return uploadReservedImage(image, ticket, onStage);
}

export async function uploadReservedImage(image: SelectedImage, ticket: UploadTicket, onStage: (stage: string) => void): Promise<SavedImage> {
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
