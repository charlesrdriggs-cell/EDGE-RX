"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions";

export default function ActionForm({
  action,
  children,
  submit,
  className,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submit: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {state?.error && <div className="error">{state.error}</div>}
      {state?.ok && <div className="notice">{state.ok}</div>}
      {children}
      <button className="btn accent" disabled={pending} style={{ width: "100%" }}>
        {pending ? "Working…" : submit}
      </button>
    </form>
  );
}
