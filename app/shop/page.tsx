import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { tagCode } from "@/lib/db";
import { money } from "@/lib/services";
import { activeProducts, attachableTuneOrders, minDeliverDate } from "@/lib/shop";
import ShopForm from "./ShopForm";

export const dynamic = "force-dynamic";

export default async function Shop({ searchParams }: { searchParams: Promise<{ tune?: string }> }) {
  const { tune } = await searchParams;
  const user = await currentUser();
  const products = activeProducts().map(({ id, name, description, price_cents, stock }) => ({ id, name, description, price_cents, stock }));
  return (
    <main className="page container">
      <div style={{ maxWidth: 720, margin: "0 auto" }} className="stack">
        <div>
          <h1>Shop</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            Warmers and extras for the hill. Add them to a tune and they come back with your gear, or get them delivered on their own.
          </p>
        </div>
        {user?.role === "customer" ? (
          <ShopForm
            products={products}
            tunes={attachableTuneOrders(user.id).map((t) => ({ ...t, tag: tagCode(t.id) }))}
            minDate={minDeliverDate()}
            initialTune={Number(tune) || undefined}
          />
        ) : (
          <div className="card stack">
            <div className="products">
              {products.map((p) => (
                <div key={p.id} className="product">
                  <div style={{ flex: 1 }}>
                    <strong>{p.name}</strong>
                    <div className="muted" style={{ fontSize: "0.88rem" }}>{p.description}</div>
                  </div>
                  <strong>{money(p.price_cents)}</strong>
                </div>
              ))}
              {products.length === 0 && <p className="muted">Nothing in the shop right now.</p>}
            </div>
            {user?.role === "operator" ? (
              <Link href="/admin/shop/products" className="btn">Manage products</Link>
            ) : (
              <Link href="/signup?next=/shop" className="btn accent">Create an account to order</Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
