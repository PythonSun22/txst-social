"use client";

/* eslint-disable @next/next/no-img-element -- Expiring URLs for approved private Storage variants. */
import { useEffect, useState } from "react";
import SpaceIcon from "./SpaceIcon";
import { getSpacePhoto, type Space } from "@/lib/spaces";

/** Shared approved space photo, falling back to the built-in community symbol. */
export default function SpaceAvatar({ space, size = 40, iconSize = 20 }: {
  space: Pick<Space, "slug" | "kind" | "icon_image_upload_id">;
  size?: number;
  iconSize?: number;
}) {
  const id = space.icon_image_upload_id;
  const [photo, setPhoto] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    getSpacePhoto(id, controller.signal).then(({ url }) => {
      if (!controller.signal.aborted) setPhoto({ id, url });
    }).catch(() => undefined);
    return () => controller.abort();
  }, [id]);
  return <span aria-hidden="true" style={{ width: size, height: size }}
    className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full ${space.kind === "college" ? "bg-accent text-primary" : "bg-primary text-accent"}`}>
    {photo && photo.id === id ? <img src={photo.url} alt="" width={size} height={size} className="h-full w-full object-cover" onError={() => setPhoto(null)} />
      : <SpaceIcon slug={space.slug} size={iconSize} />}
  </span>;
}
