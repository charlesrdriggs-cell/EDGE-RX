/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { getAbout } from "@/lib/site";
import { mediaUrl } from "@/lib/media";
import ActionForm from "@/app/components/ActionForm";
import { saveAbout, addAboutPhoto, editAboutPhoto } from "@/app/site-actions";

export default function AdminAbout() {
  const about = getAbout();
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <div className="flex between">
        <h1 style={{ margin: 0 }}>About page</h1>
        <Link href="/about" className="btn light sm">View page</Link>
      </div>
      <div className="card">
        <h2>Bio</h2>
        <ActionForm action={saveAbout} submit="Save bio">
          <div className="field"><label>Heading</label><input name="title" defaultValue={about.title} maxLength={80} /></div>
          <div className="field">
            <label>Bio <span className="hint">(leave a blank line between paragraphs)</span></label>
            <textarea name="bio" rows={12} defaultValue={about.bio} maxLength={8000} />
          </div>
        </ActionForm>
      </div>
      <div className="card">
        <h2>Photos</h2>
        <p className="muted" style={{ marginTop: 0 }}>The first photo is the big one next to your bio; the rest show in a gallery below it.</p>
        {about.photos.map((p, i) => (
          <div key={p.id} className="photo-upload">
            <div className="thumb"><img src={mediaUrl(p.image_id)!} alt="" /></div>
            <div className="flex" style={{ flex: 1, gap: 8 }}>
              <form action={editAboutPhoto} className="flex" style={{ flex: "1 1 260px", gap: 8, flexWrap: "nowrap" }}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="op" value="caption" />
                <input name="caption" defaultValue={p.caption} placeholder="Caption (optional)" maxLength={140} />
                <button className="btn sm light">Save</button>
              </form>
              {([["up", "↑", i === 0], ["down", "↓", i === about.photos.length - 1], ["delete", "Remove", false]] as const).map(([op, label, off]) => (
                <form key={op} action={editAboutPhoto}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="op" value={op} />
                  <button className={`btn sm ${op === "delete" ? "ghost" : "light"}`} disabled={off}>{label}</button>
                </form>
              ))}
            </div>
          </div>
        ))}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, marginTop: 6 }}>
          <ActionForm action={addAboutPhoto} submit="Upload photo">
            <div className="field"><label>Add a photo</label><input type="file" name="photo" accept="image/jpeg,image/png,image/webp,image/gif" required /></div>
            <div className="field"><label>Caption <span className="hint">(optional)</span></label><input name="caption" maxLength={140} /></div>
          </ActionForm>
          <div className="hint" style={{ marginTop: 6 }}>JPG, PNG or WebP up to 5 MB.</div>
        </div>
      </div>
    </div>
  );
}
