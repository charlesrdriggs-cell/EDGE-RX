import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPaymentInfo, invoiceForOrder } from "@/lib/invoices";
import InvoiceSheet from "@/app/components/InvoiceSheet";
import PrintPageButton from "@/app/components/PrintPageButton";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  const inv = invoiceForOrder(Number(id));
  if (!inv || (u.role !== "operator" && inv.userId !== u.id)) notFound();
  const operator = u.role === "operator";
  return (
    <main className="page container">
      <div className="flex between no-print" style={{ maxWidth: "8.5in", margin: "0 auto 16px" }}>
        <Link href={operator ? "/admin" : `/orders/${id}`}>← Back</Link>
        <PrintPageButton label={operator ? "Print invoice & driver sheet" : "Print invoice"} />
      </div>
      <InvoiceSheet inv={inv} pay={getPaymentInfo()} driver={operator} />
    </main>
  );
}
