"use client";

import { useState, useTransition } from "react";
import { setStatus } from "@/app/actions";

const CONFIRM: Record<string, string> = {
  ready: "Mark as Ready? This emails the customer that their gear is tuned and on its way.",
  cancelled: "Cancel this order? Any credit the customer used is refunded.",
};

/** Order status dropdown that saves as soon as a new status is picked. */
export default function StatusSelect({
  id,
  status,
  options,
}: {
  id: number;
  status: string;
  options: { value: string; label: string }[];
}) {
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();

  function change(next: string) {
    if (next === value) return;
    if (CONFIRM[next] && !window.confirm(CONFIRM[next])) return;
    setValue(next);
    const fd = new FormData();
    fd.set("id", String(id));
    fd.set("status", next);
    start(() => setStatus(fd));
  }

  return (
    <div className="inline-form">
      <select
        name="status"
        value={value}
        onChange={(e) => change(e.target.value)}
        disabled={pending}
        aria-label="Status"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {pending && <span className="muted" style={{ fontSize: "0.8rem" }}>Saving…</span>}
    </div>
  );
}
