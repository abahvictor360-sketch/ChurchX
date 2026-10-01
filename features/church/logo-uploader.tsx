"use client";

import * as React from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { resizeImage } from "@/lib/image";
import { setChurchLogo } from "@/features/church/actions";
import { publicAssetUrl } from "@/lib/storage";

export function LogoUploader({
  churchId,
  currentPath,
  onUploaded,
}: {
  churchId: string;
  currentPath: string | null;
  onUploaded?: (path: string | null) => void;
}) {
  const [path, setPath] = React.useState(currentPath);
  const [busy, setBusy] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  const url = publicAssetUrl(path);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const blob = await resizeImage(file, 512);
      const objectPath = `${churchId}/logo-${Date.now()}.webp`;
      const supabase = createClient();
      const { error } = await supabase.storage.from("church-assets").upload(objectPath, blob, { contentType: "image/webp", upsert: false });
      if (error) throw new Error("Upload failed. Please try again.");
      const res = await setChurchLogo(objectPath);
      if (!res.ok) throw new Error(res.error);
      setPath(objectPath);
      onUploaded?.(objectPath);
      toast.success("Logo uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    setBusy(true);
    const res = await setChurchLogo(null);
    setBusy(false);
    if (res.ok) {
      setPath(null);
      onUploaded?.(null);
    } else toast.error(res.error);
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded asset from Supabase Storage
          <img src={url} alt="Church logo" className="size-full object-contain" />
        ) : (
          <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          id="logo-file"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />} {path ? "Change logo" : "Upload logo"}
        </Button>
        {path && (
          <Button type="button" variant="ghost" disabled={busy} onClick={remove}>
            <Trash2 /> Remove
          </Button>
        )}
        <p className="w-full text-xs text-muted-foreground">PNG, JPG or WebP. Resized automatically.</p>
      </div>
    </div>
  );
}
