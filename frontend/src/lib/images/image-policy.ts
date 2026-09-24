/** Upload policy comes from FastAPI so UI limits cannot silently drift from the API. */
export interface ImagePolicy {
  max_bytes: number;
  allowed_types: string[];
}

export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} bytes`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} KB`;
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

export function aspectRatio(width: number, height: number): string {
  let a = width;
  let b = height;
  while (b) [a, b] = [b, a % b];
  return `${width / a}:${height / a} (${(width / height).toFixed(3)}:1)`;
}

/** Cheap checks run before asking the browser to decode an image. */
export function validateImageFile(file: Pick<File, "size" | "type" | "name">, policy: ImagePolicy): string[] {
  const errors: string[] = [];
  if (!policy.allowed_types.includes(file.type)) errors.push("Choose a JPEG, PNG, or WebP image.");
  if (!file.size) errors.push("This file is empty.");
  if (file.size > policy.max_bytes) errors.push(`This file exceeds the ${formatBytes(policy.max_bytes)} limit.`);
  if (!file.name.trim() || [...file.name.trim()].length > 255) errors.push("Use a file name between 1 and 255 characters.");
  return errors;
}

/** Reject obviously renamed files before decoding; server content inspection is a later stage. */
export function imageTypeFromHeader(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)) return "image/png";
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}
