import crypto from "node:crypto";
import { db, get, run } from "./db";

/**
 * Uploaded photos (products, services). Stored in the database so they live on the same
 * persistent volume as everything else and need no extra storage service.
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

let ready = false;
function ensure() {
  if (ready) return;
  db().exec(`CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    mime TEXT NOT NULL,
    data BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  ready = true;
}

/** Saves an uploaded image and returns its id, or an error message for the user. */
export async function saveImage(file: unknown): Promise<{ id: string } | { error: string }> {
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo to upload." };
  if (!TYPES[file.type]) return { error: "Photos must be JPG, PNG, WebP or GIF." };
  if (file.size > MAX_IMAGE_BYTES) return { error: "That photo is over 5 MB. Try a smaller one (phone photos can be shared at a smaller size)." };
  ensure();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const id = `${crypto.randomBytes(9).toString("base64url")}.${TYPES[file.type]}`;
  run("INSERT INTO media (id, mime, data) VALUES (?, ?, ?)", id, file.type, bytes);
  return { id };
}

export function getImage(id: string) {
  ensure();
  return get<{ mime: string; data: Uint8Array }>("SELECT mime, data FROM media WHERE id = ?", id);
}

export function deleteImage(id: string | null | undefined) {
  if (!id) return;
  ensure();
  run("DELETE FROM media WHERE id = ?", id);
}

export const mediaUrl = (id: string | null | undefined) => (id ? `/media/${id}` : null);
