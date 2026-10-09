export const MAX_IMAGE_MB = 5;

/** Returns an error message, or null when the file is an acceptable image. */
export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Choose an image file (PNG, JPG or WebP).";
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) return `Image is over ${MAX_IMAGE_MB} MB. Compress it and try again.`;
  return null;
}

/** Storage-safe file name. */
export function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}
