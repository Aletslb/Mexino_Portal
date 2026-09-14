import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { api, saveRecord } from "./api";
import {
  blankOwner,
  money,
  ownerSettlement,
  saleBalance,
} from "./model";
import type { BusinessData, Catalog, Owner, Sale } from "./model";

const emptyBusiness: BusinessData = {
  owners: [],
  customers: [],
  sales: [],
  payments: [],
  deliveries: [],
  receipts: [],
};
const dashboardToday = new Date().toISOString().slice(0, 10);
const dashboardHorizon = new Date(
  new Date(`${dashboardToday}T00:00:00Z`).getTime() + 30 * 86400000,
).toISOString().slice(0, 10);

function ownerTotals(owner: Owner, data: BusinessData) {
  const sales = data.sales.filter(
    (sale) =>
      sale.ownerId === owner.id &&
      sale.ownershipType === "Tercero" &&
      sale.status !== "Cancelada",
  );
  return sales.reduce(
    (total, sale) => {
      const value = ownerSettlement(sale, data.payments, data.deliveries);
      total.available += value.ownerFundsAvailable;
      total.delivered += value.delivered;
      total.pending += value.pendingDelivery;
      return total;
    },
    { sales: sales.length, available: 0, delivered: 0, pending: 0 },
  );
}

export function PendingPanel({ catalog }: { catalog: Catalog }) {
  const [data, setData] = useState<BusinessData>(emptyBusiness),
    [error, setError] = useState("");
  useEffect(() => {
    api<BusinessData>("/api/admin/business").then(setData).catch((e) => setError((e as Error).message));
  }, []);
  const today = dashboardToday,
    inThirtyDays = dashboardHorizon,
    active = data.sales.filter((sale) => !["Cancelada", "Liquidada"].includes(sale.status)),
    overdue = active.reduce((sum, sale) => sum + saleBalance(sale, data.payments, today).overdue, 0),
    upcoming = active.filter((sale) => {
      const date = saleBalance(sale, data.payments, today).nextDueDate;
      return date > today && date <= inThirtyDays;
    }),
    reservations = active.filter((sale) => sale.status === "Apartado"),
    reviews = data.sales.filter((sale) => sale.status === "Cancelacion en revision"),
    ownerPending = data.owners.reduce((sum, owner) => sum + ownerTotals(owner, data).pending, 0);
  const assetName = (sale: Sale) => {
    const property = catalog.properties.find((item) => item.id === sale.assetId);
    if (property) return property.title;
    const lot = catalog.lots.find((item) => item.id === sale.assetId),
      development = lot && catalog.developments.find((item) => item.id === lot.developmentId);
    return lot ? `${development?.title || "Fraccionamiento"} · M${lot.block} L${lot.number}` : "Inmueble";
  };
  return (
    <section className="pending-panel">
      <div className="card-heading">
        <div>
          <p className="eyebrow">ATENCIÓN OPERATIVA</p>
          <h2>Pendientes</h2>
        </div>
        <span className="muted">Actualizado al día de hoy</span>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="pending-metrics">
        <article><span>Cobranza vencida</span><strong>{money(overdue)}</strong></article>
        <article><span>Pagos próximos</span><strong>{upcoming.length}</strong><small>En los siguientes 30 días</small></article>
        <article><span>Apartados activos</span><strong>{reservations.length}</strong></article>
        <article><span>Cancelaciones en revisión</span><strong>{reviews.length}</strong></article>
        <article className="owner-funds"><span>Fondos por entregar</span><strong>{money(ownerPending)}</strong><small>Dinero de propietarios</small></article>
      </div>
      {(upcoming.length > 0 || reservations.length > 0) && (
        <div className="pending-list">
          {[...reservations, ...upcoming].slice(0, 5).map((sale) => {
            const customer = data.customers.find((item) => item.id === sale.customerId),
              balance = saleBalance(sale, data.payments, today);
            return <div key={`${sale.id}-${sale.status}`}>
              <span className="pill">{sale.status}</span>
              <strong>{assetName(sale)}</strong>
              <span>{customer?.name || "Cliente"}</span>
              <span>{balance.nextDueDate || sale.nextPaymentDate || "Sin fecha"}</span>
            </div>;
          })}
        </div>
      )}
    </section>
  );
}

export default function OwnersAdmin() {
  const [data, setData] = useState<BusinessData>(emptyBusiness),
    [selected, setSelected] = useState<Owner | null>(null),
    [query, setQuery] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function reload() {
    setLoading(true);
    try {
      setData(await api<BusinessData>("/api/admin/business"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void reload(); }, []);
  const visible = useMemo(
    () => data.owners.filter((owner) => `${owner.name} ${owner.phone}`.toLowerCase().includes(query.toLowerCase())),
    [data.owners, query],
  );
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      await saveRecord("owners", selected);
      setSelected(null);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const totals = data.owners.reduce(
    (sum, owner) => {
      const value = ownerTotals(owner, data);
      sum.available += value.available;
      sum.delivered += value.delivered;
      sum.pending += value.pending;
      return sum;
    },
    { available: 0, delivered: 0, pending: 0 },
  );
  if (selected)
    return <form className="editor owner-editor" onSubmit={submit}>
      <div className="editor-top"><div><p className="eyebrow">CONTROL INTERNO</p><h1>{selected.revision ? "Editar propietario" : "Nuevo propietario"}</h1></div><button type="button" className="secondary" onClick={() => setSelected(null)}>Volver</button></div>
      <fieldset disabled={busy}>
        <legend>Datos del propietario</legend>
        <div className="form-grid">
          <label className="field"><span>Nombre</span><input required maxLength={160} value={selected.name} onChange={(e) => setSelected({...selected, name:e.target.value})}/></label>
          <label className="field"><span>Teléfono</span><input type="tel" maxLength={35} value={selected.phone} onChange={(e) => setSelected({...selected, phone:e.target.value})}/></label>
        </div>
        <label className="field"><span>Domicilio (opcional)</span><input maxLength={500} value={selected.address} onChange={(e) => setSelected({...selected, address:e.target.value})}/></label>
        <label className="field"><span>Notas internas (opcional)</span><textarea rows={4} maxLength={3000} value={selected.notes} onChange={(e) => setSelected({...selected, notes:e.target.value})}/></label>
        <label className="check"><input type="checkbox" checked={selected.active} onChange={(e) => setSelected({...selected, active:e.target.checked})}/> Propietario activo</label>
      </fieldset>
      {error && <p className="error">{error}</p>}
      <div className="save-bar"><span>Esta información nunca se muestra en el portal público.</span><button className="button" disabled={busy}>{busy ? "Guardando…" : "Guardar propietario"}</button></div>
    </form>;
  return <div className="owners-admin">
    <div className="section-top"><div><p className="eyebrow">DINERO DE TERCEROS</p><h1>Propietarios y fondos</h1><p className="muted">Saldos separados de la caja operativa de Casa Mexino.</p></div><button className="button" onClick={() => setSelected(blankOwner())}>+ Nuevo propietario</button></div>
    <div className="settlement-metrics owner-global-metrics">
      <div><span>Fondos generados</span><strong>{money(totals.available)}</strong></div>
      <div><span>Entregado</span><strong>{money(totals.delivered)}</strong></div>
      <div><span>Pendiente de entregar</span><strong>{money(totals.pending)}</strong></div>
    </div>
    <label className="field"><span>Buscar propietario</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nombre o teléfono"/></label>
    {error && <p className="error">{error}</p>}
    {loading ? <p>Cargando propietarios…</p> : <div className="owner-grid">
      {visible.map((owner) => {
        const value = ownerTotals(owner, data);
        return <article key={owner.id} className={!owner.active ? "inactive" : ""}>
          <div><span className={`ownership-badge ${owner.active ? "third-party" : ""}`}>{owner.active ? "Activo" : "Inactivo"}</span><h2>{owner.name}</h2><p>{owner.phone || "Sin teléfono"}</p></div>
          <dl><div><dt>Operaciones</dt><dd>{value.sales}</dd></div><div><dt>Entregado</dt><dd>{money(value.delivered)}</dd></div><div><dt>Pendiente</dt><dd>{money(value.pending)}</dd></div></dl>
          <button className="text-button" onClick={() => setSelected(owner)}>Editar expediente</button>
        </article>;
      })}
      {!visible.length && <div className="empty">Todavía no hay propietarios registrados.</div>}
    </div>}
  </div>;
}
