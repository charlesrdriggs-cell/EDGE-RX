import Link from "next/link";
import ActionForm from "@/app/components/ActionForm";
import { requestPasswordReset } from "@/app/actions";

export default function ForgotPassword() {
  return (
    <main className="page container">
      <div className="narrow card">
        <h1 style={{ fontSize: "1.8rem" }}>Forgot your password?</h1>
        <p className="muted">Enter your email and we&apos;ll send you a link to set a new one.</p>
        <ActionForm action={requestPasswordReset} submit="Send reset link">
          <div className="field"><label>Email</label><input name="email" type="email" required autoComplete="email" /></div>
        </ActionForm>
        <p className="muted" style={{ marginTop: 16 }}><Link href="/login">Back to log in</Link></p>
      </div>
    </main>
  );
}
