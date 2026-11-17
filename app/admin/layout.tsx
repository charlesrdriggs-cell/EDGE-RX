import Link from "next/link";
import { requireOperator } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireOperator();
  return (
    <main className="page container">
      <div className="flex no-print" style={{ marginBottom: 20, gap: 8 }}>
        <Link href="/admin" className="btn light sm">Orders</Link>
        <Link href="/admin/tags" className="btn light sm">Print tags</Link>
        <Link href="/admin/shop" className="btn light sm">Retail</Link>
        <Link href="/admin/customers" className="btn light sm">Customers</Link>
        <Link href="/admin/reminders" className="btn light sm">Reminders &amp; emails</Link>
      </div>
      {children}
    </main>
  );
}
