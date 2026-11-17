import Link from "next/link";
import { allProducts } from "@/lib/shop";
import ActionForm from "@/app/components/ActionForm";
import { saveProductAction } from "@/app/shop-actions";
import type { Product } from "@/lib/shop";
import PhotoUpload from "@/app/components/PhotoUpload";
import { mediaUrl } from "@/lib/media";

function Fields({ p }: { p?: Product }) {
  return (
    <>
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="field"><label>Name</label><input name="name" defaultValue={p?.name} required /></div>
      <div className="field"><label>Description</label><textarea name="description" rows={3} defaultValue={p?.description} /></div>
      <div className="row">
        <div className="field"><label>Price ($)</label><input name="price" inputMode="decimal" defaultValue={p ? (p.price_cents / 100).toFixed(2) : ""} placeholder="3.50" required /></div>
        <div className="field">
          <label>In stock <span className="hint">(blank = unlimited)</span></label>
          <input name="stock" inputMode="numeric" defaultValue={p?.stock ?? ""} placeholder="Unlimited" />
        </div>
      </div>
      <div className="row">
        <div className="field"><label>Sort order <span className="hint">(lower shows first)</span></label><input name="sort" inputMode="numeric" defaultValue={p?.sort ?? 100} /></div>
        <div className="field">
          <label>&nbsp;</label>
          <label style={{ fontWeight: 400 }}><input type="checkbox" name="active" defaultChecked={p ? !!p.active : true} /> Show in the shop</label>
        </div>
      </div>
    </>
  );
}

export default async function Products() {
  const products = allProducts();
  const unconfirmed = products.filter((p) => !p.price_confirmed);
  return (
    <div className="stack">
      <div className="flex between">
        <h1 style={{ margin: 0 }}>Products</h1>
        <div className="flex">
          <Link href="/admin/shop" className="btn light sm">Retail orders</Link>
          <Link href="/shop" className="btn light sm">View shop</Link>
        </div>
      </div>
      {unconfirmed.length > 0 && (
        <div className="error" style={{ background: "#fff4e5", color: "var(--warn)" }}>
          {unconfirmed.length} product{unconfirmed.length === 1 ? " has a" : "s have"} placeholder prices: {unconfirmed.map((p) => p.name).join(", ")}.
          Set the real price and save each one (or untick &ldquo;Show in the shop&rdquo;) before customers order.
        </div>
      )}
      <div className="grid-2">
        {products.map((p) => (
          <div key={p.id} className="card" style={!p.active ? { opacity: 0.7 } : undefined}>
            <div className="flex between" style={{ marginBottom: 8 }}>
              <span className="badge">{p.active ? (p.stock === 0 ? "Sold out" : "Visible") : "Hidden"}</span>
              {!p.price_confirmed && <span className="badge" style={{ background: "#fff4e5", color: "var(--warn)" }}>Placeholder price</span>}
            </div>
            <ActionForm key={`${p.id}-${p.price_cents}-${p.stock}-${p.active}`} action={saveProductAction} submit="Save">
              <Fields p={p} />
            </ActionForm>
            <PhotoUpload key={p.image_id ?? "none"} target={`product:${p.id}`} current={mediaUrl(p.image_id)} />
          </div>
        ))}
        <div className="card">
          <h2>Add a product</h2>
          <ActionForm action={saveProductAction} submit="Add product">
            <Fields />
          </ActionForm>
          <p className="hint">You can add a photo once the product is saved.</p>
        </div>
      </div>
    </div>
  );
}
