import Link from "next/link";
import ActionForm from "@/app/components/ActionForm";
import { resetPassword } from "@/app/actions";

export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <main className="page container">
      <div className="narrow card">
        <h1 style={{ fontSize: "1.8rem" }}>Set a new password</h1>
        {!token ? (
          <p className="muted">This link is missing its code. <Link href="/forgot-password">Request a new reset link</Link>.</p>
        ) : (
          <ActionForm action={resetPassword} submit="Save new password">
            <input type="hidden" name="token" value={token} />
            <div className="field"><label>New password</label><input name="password" type="password" minLength={8} required autoComplete="new-password" /></div>
            <div className="field"><label>Confirm new password</label><input name="confirm" type="password" minLength={8} required autoComplete="new-password" /></div>
          </ActionForm>
        )}
      </div>
    </main>
  );
}
