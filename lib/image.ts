"use client";

/**
 * Downscales an image in the browser before upload (max edge in px) and
 * re-encodes as WebP. Keeps uploads small for mobile data plans.
 */
export async function resizeImage(file: File, maxEdge = 512, quality = 0.85): Promise<Blob> {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error("Please choose a PNG, JPG or WebP image.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Image is too large (max 10 MB).");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (!blob) throw new Error("Could not process image.");
  return blob;
}
