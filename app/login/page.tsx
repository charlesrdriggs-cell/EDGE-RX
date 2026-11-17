import Link from "next/link";
import ActionForm from "@/app/components/ActionForm";
import { login } from "@/app/actions";

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="page container">
      <div className="narrow card">
        <h1 style={{ fontSize: "1.8rem" }}>Log in</h1>
        <ActionForm action={login} submit="Log in">
          <input type="hidden" name="next" value={next ?? ""} />
          <div className="field"><label>Email</label><input name="email" type="email" required autoComplete="email" /></div>
          <div className="field">
            <label className="flex between"><span>Password</span><Link href="/forgot-password" className="hint">Forgot password?</Link></label>
            <input name="password" type="password" required autoComplete="current-password" />
          </div>
        </ActionForm>
        <p className="muted" style={{ marginTop: 16 }}>New here? <Link href={`/signup${next ? `?next=${next}` : ""}`}>Create an account</Link></p>
      </div>
    </main>
  );
}
