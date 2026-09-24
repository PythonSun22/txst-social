import { imageTypeFromHeader, validateImageFile, type ImagePolicy } from "./image-policy";

export interface SelectedImage {
  file: File;
  width: number | null;
  height: number | null;
  previewUrl: string | null;
  errors: string[];
}

/** Inspect locally without uploading. The caller owns/revokes the returned object URL. */
export async function inspectImage(file: File, policy: ImagePolicy): Promise<SelectedImage> {
  const result: SelectedImage = { file, width: null, height: null, previewUrl: null, errors: validateImageFile(file, policy) };
  if (result.errors.length) return result;
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (imageTypeFromHeader(header) !== file.type) {
    result.errors.push("The file contents do not match its image type.");
    return result;
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("Empty image");
    result.width = image.naturalWidth;
    result.height = image.naturalHeight;
    result.previewUrl = url;
  } catch {
    URL.revokeObjectURL(url);
    result.errors.push("This image could not be opened. It may be damaged or unsupported by your browser.");
  }
  return result;
}
