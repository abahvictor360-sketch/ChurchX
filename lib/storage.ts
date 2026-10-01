/** Public URL for objects in the public "church-assets" bucket. */
export function publicAssetUrl(path: string | null | undefined) {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/church-assets/${path.split("/").map(encodeURIComponent).join("/")}`;
}
