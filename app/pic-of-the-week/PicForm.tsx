"use client";

import { useActionState, useRef, useState } from "react";
import { submitPic } from "@/app/site-actions";

export default function PicForm({ defaultName, max }: { defaultName: string; max: number }) {
  const [state, action, pending] = useActionState(submitPic, undefined);
  const [why, setWhy] = useState("");
  const [tooBig, setTooBig] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={async (fd) => { await action(fd); }}>
      {state?.error && <div className="error">{state.error}</div>}
      {state?.ok && <div className="notice">{state.ok}</div>}
      <div className="field">
        <label>Your photo</label>
        <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required
          onChange={(e) => setTooBig(!!e.target.files?.[0] && e.target.files[0].size > 5 * 1024 * 1024)} />
        {tooBig && <div className="error" style={{ marginTop: 8 }}>That photo is over 5 MB. Try a smaller one.</div>}
      </div>
      <div className="row">
        <div className="field"><label>Name</label><input name="name" defaultValue={defaultName} required maxLength={60} /></div>
        <div className="field"><label>Place</label><input name="place" placeholder="e.g. Tuckerman Ravine" required maxLength={80} /></div>
      </div>
      <div className="field">
        <label>Why should it be pic of the week?</label>
        <textarea name="why" rows={3} maxLength={max} value={why} onChange={(e) => setWhy(e.target.value)} required />
        <div className="hint" style={{ textAlign: "right", color: why.length > max - 20 ? "var(--danger)" : undefined }}>{why.length}/{max}</div>
      </div>
      <button className="btn accent" disabled={pending || tooBig} style={{ width: "100%" }}>{pending ? "Uploading…" : "Submit my pic"}</button>
    </form>
  );
}
