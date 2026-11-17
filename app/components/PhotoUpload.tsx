"use client";
/* eslint-disable @next/next/no-img-element */

import { useActionState, useRef, useState } from "react";
import { photoAction } from "@/app/photo-actions";

/** Operator control: shows the current photo, lets you pick a new one (with preview) or remove it. */
export default function PhotoUpload({ target, current, label = "Photo" }: { target: string; current: string | null; label?: string }) {
  const [state, action, pending] = useActionState(photoAction, undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const [tooBig, setTooBig] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const shown = preview ?? current;

  return (
    <div className="photo-upload">
      <div className="thumb">
        {shown ? <img src={shown} alt="" /> : <span>No photo yet</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <label>{label}</label>
        {tooBig && <div className="error" style={{ marginBottom: 8 }}>That photo is over 5 MB. Try a smaller one (phones can share photos at a smaller size).</div>}
        {!tooBig && state?.error && <div className="error" style={{ marginBottom: 8 }}>{state.error}</div>}
        {state?.ok && !preview && <div className="notice" style={{ marginBottom: 8 }}>{state.ok}</div>}
        <form
          action={async (fd) => { await action(fd); setPreview(null); if (input.current) input.current.value = ""; }}
          className="flex"
          style={{ gap: 8 }}
        >
          <input type="hidden" name="target" value={target} />
          <input
            ref={input}
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp,image/gif"
            required
            style={{ flex: "1 1 180px", padding: 8 }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              const big = !!f && f.size > 5 * 1024 * 1024;
              setTooBig(big);
              setPreview(f && !big ? URL.createObjectURL(f) : null);
            }}
          />
          <button className="btn sm accent" disabled={pending || !preview}>{pending ? "Saving…" : "Upload"}</button>
        </form>
        {current && !preview && (
          <form action={action} style={{ marginTop: 8 }}>
            <input type="hidden" name="target" value={target} />
            <input type="hidden" name="remove" value="1" />
            <button className="btn sm ghost" disabled={pending}>Remove photo</button>
          </form>
        )}
        <div className="hint" style={{ marginTop: 6 }}>JPG, PNG or WebP up to 5 MB. Landscape photos look best.</div>
      </div>
    </div>
  );
}
