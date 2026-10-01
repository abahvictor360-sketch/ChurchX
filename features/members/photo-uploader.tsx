"use client";

import * as React from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { resizeImage } from "@/lib/image";
import { setMemberPhoto } from "@/features/members/actions";
import { initials } from "@/lib/format";

export function MemberPhoto({
  churchId,
  memberId,
  name,
  url,
  editable,
}: {
  churchId: string;
  memberId: string;
  name: string;
  url: string | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const blob = await resizeImage(file, 640);
      const path = `${churchId}/${memberId}/photo-${Date.now()}.webp`;
      const { error } = await createClient().storage.from("member-photos").upload(path, blob, { contentType: "image/webp" });
      if (error) throw new Error("Upload failed. Please try again.");
      const res = await setMemberPhoto(memberId, path);
      if (!res.ok) throw new Error(res.error);
      toast.success("Photo updated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="relative shrink-0">
      <Avatar className="size-20 border-4 border-card shadow sm:size-24">
        {url && <AvatarImage src={url} alt={`Photo of ${name}`} />}
        <AvatarFallback className="text-xl">{initials(name)}</AvatarFallback>
      </Avatar>
      {editable && (
        <>
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="absolute right-0 bottom-0 flex size-8 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow"
            aria-label="Change photo"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          </button>
        </>
      )}
    </div>
  );
}
