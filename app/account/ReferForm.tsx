"use client";

import { useActionState, useState } from "react";
import { inviteFriends, type InviteState } from "@/app/referral-actions";

export default function ReferForm({ link, code, shareText }: { link: string; code: string; shareText: string }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteFriends, undefined);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked; the link is selectable */ }
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>Your referral link <span className="hint">(code {code})</span></label>
        <div className="flex" style={{ gap: 8, flexWrap: "nowrap" }}>
          <input value={link} readOnly onFocus={(e) => e.currentTarget.select()} aria-label="Referral link" />
          <button type="button" className="btn light sm" onClick={copy} style={{ whiteSpace: "nowrap" }}>
            {copied ? "Copied" : "Copy"}
          </button>
          <a className="btn light sm" href={`sms:?&body=${encodeURIComponent(shareText)}`} style={{ whiteSpace: "nowrap" }}>Text it</a>
        </div>
      </div>

      <form action={action}>
        {state?.error && <div className="error">{state.error}</div>}
        {state?.sent && state.sent.length > 0 && (
          <div className="notice">Invited {state.sent.join(", ")}.</div>
        )}
        {state?.skipped && state.skipped.length > 0 && (
          <div className="muted" style={{ marginBottom: 16 }}>
            Skipped {state.skipped.map((s) => `${s.contact} (${s.why})`).join(", ")}.
          </div>
        )}
        {state?.textYourself && state.textYourself.length > 0 && (
          <div className="notice">
            We couldn&apos;t text these automatically. Tap to send the invite from your phone:{" "}
            {state.textYourself.map((t, i) => (
              <span key={t.href}>{i > 0 && ", "}<a href={t.href}>{t.display}</a></span>
            ))}
          </div>
        )}
        <div className="field">
          <label>Invite friends by email or phone</label>
          <textarea
            name="contacts"
            rows={3}
            placeholder={"friend@example.com\n(303) 555-0142"}
            required
          />
          <span className="hint">One per line or separated by commas. Up to 10 at a time.</span>
        </div>
        <button className="btn accent" disabled={pending} style={{ width: "100%" }}>
          {pending ? "Sending…" : "Send invites"}
        </button>
      </form>
    </div>
  );
}
