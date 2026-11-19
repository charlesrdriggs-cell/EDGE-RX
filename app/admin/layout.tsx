import Link from "next/link";
import { requireOperator } from "@/lib/auth";
import { get } from "@/lib/db";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireOperator();
  const unread = get<{ n: number }>("SELECT COUNT(*) n FROM suggestions WHERE is_read = 0")?.n ?? 0;
  const pics = get<{ n: number }>("SELECT COUNT(*) n FROM pic_submissions WHERE status = 'pending'")?.n ?? 0;
  return (
    <main className="page container">
      <div className="flex no-print" style={{ marginBottom: 20, gap: 8 }}>
        <Link href="/admin" className="btn light sm">Orders</Link>
        <Link href="/admin/tags" className="btn light sm">Print tags</Link>
        <Link href="/admin/schedule" className="btn light sm">Schedule &amp; limits</Link>
        <Link href="/admin/prices" className="btn light sm">Services &amp; prices</Link>
        <Link href="/admin/shop" className="btn light sm">Retail</Link>
        <Link href="/admin/customers" className="btn light sm">Customers</Link>
        <Link href="/admin/reminders" className="btn light sm">Reminders &amp; emails</Link>
        <Link href="/admin/referrals" className="btn light sm">Referrals</Link>
        <Link href="/admin/lessons" className="btn light sm">Learn to Tune</Link>
        <Link href="/admin/site" className="btn light sm">Homepage &amp; promos</Link>
        <Link href="/admin/about" className="btn light sm">About page</Link>
        <Link href="/admin/polls" className="btn light sm">Polls</Link>
        <Link href="/admin/pics" className="btn light sm">Pic of the week{pics ? ` (${pics})` : ""}</Link>
        <Link href="/admin/suggestions" className="btn light sm">Suggestions{unread ? ` (${unread})` : ""}</Link>
        <Link href="/admin/dispatch" className="btn light sm">Assign drivers</Link>
        <Link href="/admin/team" className="btn light sm">Team &amp; drivers</Link>
      </div>
      {children}
    </main>
  );
}
