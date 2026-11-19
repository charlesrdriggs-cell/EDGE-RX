import Link from "next/link";
import { requireOperator } from "@/lib/auth";
import { isOwner, staff, ROLE_LABEL } from "@/lib/staff";
import { fmtDate } from "@/lib/services";
import ActionForm from "@/app/components/ActionForm";
import { addStaff, setStaffRole } from "@/app/staff-actions";

export default async function Team() {
  const me = await requireOperator();
  const owner = isOwner(me);
  const people = staff();

  return (
    <div className="stack">
      <div className="flex between">
        <h1 style={{ margin: 0 }}>Team &amp; drivers</h1>
        <Link href="/admin/dispatch" className="btn">Assign drivers</Link>
      </div>

      <div className="card">
        <h2>Who has access</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          <strong>Admins</strong> see the whole dashboard. <strong>Drivers</strong> only see the pickups and deliveries
          you assign them, at <Link href="/driver">/driver</Link>.
          {owner ? " As the owner, you can add and remove admins." : " Only the owner can add or remove admins; you can manage drivers."}
        </p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Contact</th><th>Role</th><th>Since</th><th></th></tr></thead>
            <tbody>
              {people.map((p) => {
                const locked = p.id === me.id || isOwner(p) || (p.role === "operator" && !owner);
                return (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong>{isOwner(p) && <div className="badge">Owner</div>}{p.id === me.id && !isOwner(p) && <div className="muted">You</div>}</td>
                    <td><a href={`mailto:${p.email}`}>{p.email}</a>{p.phone && <div><a href={`tel:${p.phone}`}>{p.phone}</a></div>}</td>
                    <td>{ROLE_LABEL[p.role]}</td>
                    <td>{fmtDate(p.created_at.slice(0, 10))}</td>
                    <td>
                      {!locked && (
                        <form key={`${p.id}-${p.role}`} action={setStaffRole} className="inline-form">
                          <input type="hidden" name="id" value={p.id} />
                          <select name="role" defaultValue={p.role} aria-label={`Role for ${p.name}`}>
                            {owner && <option value="operator">Admin</option>}
                            <option value="driver">Driver</option>
                            <option value="customer">Remove access</option>
                          </select>
                          <button className="btn sm">Save</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card narrow" style={{ maxWidth: 520, margin: 0 }}>
        <h2>Add someone</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          If they already have a customer account, use that email and they keep their login. Otherwise add their name and
          we&apos;ll email them a link to set a password.
        </p>
        <ActionForm action={addStaff} submit="Add to team">
          <div className="field"><label>Email</label><input name="email" type="email" required /></div>
          <div className="field"><label>Name <span className="muted">(new accounts only)</span></label><input name="name" /></div>
          <div className="field"><label>Phone <span className="muted">(optional)</span></label><input name="phone" type="tel" /></div>
          <div className="field">
            <label>Role</label>
            <select name="role" defaultValue="driver">
              <option value="driver">Driver</option>
              {owner && <option value="operator">Admin</option>}
            </select>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
