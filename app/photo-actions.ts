"use server";

import { revalidatePath } from "next/cache";
import { requireOperator } from "@/lib/auth";
import { saveImage, deleteImage } from "@/lib/media";
import { setProductImage, getProduct } from "@/lib/shop";
import { setServicePhoto, PHOTO_KEYS, type PhotoKey } from "@/lib/pricing";
import type { FormState } from "@/app/actions";

function refresh() {
  revalidatePath("/", "layout");
}

/** Upload or remove a photo. Target is "product:<id>" or "service:<basic|race|repair>". */
export async function photoAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireOperator();
  const target = String(fd.get("target") ?? "");
  const remove = fd.get("remove") === "1";
  const [kind, key] = target.split(":");

  let imageId: string | null = null;
  if (!remove) {
    const r = await saveImage(fd.get("photo"));
    if ("error" in r) return { error: r.error };
    imageId = r.id;
  }

  let old: string | null = null;
  if (kind === "product" && getProduct(Number(key))) {
    old = setProductImage(Number(key), imageId);
  } else if (kind === "service" && (PHOTO_KEYS as string[]).includes(key)) {
    old = setServicePhoto(key as PhotoKey, imageId);
  } else {
    deleteImage(imageId);
    return { error: "Unknown item." };
  }
  if (old && old !== imageId) deleteImage(old);
  refresh();
  return { ok: remove ? "Photo removed." : "Photo saved." };
}
