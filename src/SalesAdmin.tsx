import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { api, postAction, saveRecord } from "./api";
import {
  blankCustomer,
  blankSale,
  money,
  ownerSettlement,
  saleBalance,
} from "./model";
import type {
  BusinessData,
  Catalog,
  Customer,
  OwnerDelivery,
  Payment,
  Receipt,
  Sale,
} from "./model";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Amount({
  label,
  value,
  onChange,
  required = true,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  required?: boolean;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min="0"
        step="any"
        required={required}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  );
}
const displayStatus = (status: Sale["status"]) =>
  status === "Cancelacion en revision" ? "Cancelación en revisión" : status;
const displayDate = (value: string) =>
  value
    ? new Intl.DateTimeFormat("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${value}T00:00:00Z`))
    : "No definido";

function CustomerForm({
  initial,
  onDone,
}: {
  initial: Customer;
  onDone: (saved?: Customer) => void;
}) {
  const [value, setValue] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const change = (v: Partial<Customer>) => setValue((x) => ({ ...x, ...v }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onDone(await saveRecord<Customer>("customers", value));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="editor compact-editor" onSubmit={submit}>
      <div className="editor-top">
        <div>
          <p className="eyebrow">EXPEDIENTE</p>
          <h2>{value.revision ? "Editar cliente" : "Nuevo cliente"}</h2>
        </div>
        <button type="button" className="secondary" onClick={() => onDone()}>
          Volver
        </button>
      </div>
      <fieldset disabled={busy}>
        <div className="form-grid">
          <Field label="Nombre completo">
            <input
              required
              maxLength={160}
              value={value.name}
              onChange={(e) => change({ name: e.target.value })}
            />
          </Field>
          <Field label="Teléfono">
            <input
              required
              type="tel"
              maxLength={35}
              value={value.phone}
              onChange={(e) => change({ phone: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Domicilio (opcional)">
          <input
            maxLength={500}
            value={value.address}
            onChange={(e) => change({ address: e.target.value })}
          />
        </Field>
        <Field label="Notas internas (opcional)">
          <textarea
            rows={3}
            maxLength={3000}
            value={value.notes}
            onChange={(e) => change({ notes: e.target.value })}
          />
        </Field>
      </fieldset>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="save-bar">
        <span>Nombre y teléfono son obligatorios.</span>
        <button className="button" disabled={busy}>
          {busy ? "Guardando…" : "Guardar cliente"}
        </button>
      </div>
    </form>
  );
}

function SaleForm({
  initial,
  business,
  catalog,
  onDone,
}: {
  initial: Sale;
  business: BusinessData;
  catalog: Catalog;
  onDone: (saved?: Sale) => void;
}) {
  const [value, setValue] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [planBasis, setPlanBasis] = useState<"monthly" | "term">(
      initial.monthlyPayment > 0 ? "monthly" : "term",
    );
  const assets = useMemo(
    () =>
      value.assetType === "Propiedad"
        ? catalog.properties.filter(
            (p) =>
              p.operation === "Venta" &&
              (p.status !== "Vendido" || p.id === value.assetId),
          )
        : catalog.lots.filter(
            (l) => l.status !== "Vendido" || l.id === value.assetId,
          ),
    [catalog, value.assetType, value.assetId],
  );
  const change = (v: Partial<Sale>) => setValue((x) => ({ ...x, ...v }));
  const financed = (next: Sale) =>
    Math.max(0, next.agreedPrice - next.reservationAmount - next.downPayment);
  const recalculate = (patch: Partial<Sale>, basis = planBasis) =>
    setValue((current) => {
      const next = { ...current, ...patch },
        balance = financed(next);
      if (basis === "monthly")
        next.termMonths =
          next.monthlyPayment > 0
            ? Math.ceil(balance / next.monthlyPayment)
            : 0;
      else
        next.monthlyPayment =
          next.termMonths > 0
            ? Math.ceil((balance / next.termMonths) * 100) / 100
            : 0;
      return next;
    });
  const setMonthlyPayment = (monthlyPayment: number) => {
    setPlanBasis("monthly");
    recalculate({ monthlyPayment }, "monthly");
  };
  const setTermMonths = (termMonths: number) => {
    setPlanBasis("term");
    recalculate({ termMonths: Math.max(0, Math.trunc(termMonths)) }, "term");
  };
  function selectAsset(id: string) {
    const asset = assets.find((x) => x.id === id);
    if (!asset) {
      change({ assetId: id });
      return;
    }
    const source =
      "commissionType" in asset
        ? asset
        : catalog.developments.find(
            (d) => "developmentId" in asset && d.id === asset.developmentId,
          );
    recalculate({
      assetId: id,
      agreedPrice: asset.price,
      commissionType: source?.commissionType ?? value.commissionType,
      commissionValue: source?.commissionValue ?? value.commissionValue,
    });
  }
  function assetName(id: string) {
    const p = catalog.properties.find((x) => x.id === id);
    if (p) return p.title;
    const l = catalog.lots.find((x) => x.id === id),
      d = l && catalog.developments.find((x) => x.id === l.developmentId);
    return l
      ? `${d?.title || "Fraccionamiento"} · M${l.block} L${l.number}`
      : "Inmueble no encontrado";
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const balance = financed(value);
    if (
      balance > 0 &&
      (value.monthlyPayment <= 0 ||
        value.termMonths <= 0 ||
        value.monthlyPayment * value.termMonths + 0.01 < balance)
    ) {
      setError(
        "La mensualidad y el plazo deben cubrir completamente el saldo financiado.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      onDone(await saveRecord<Sale>("sales", value));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const locked = value.revision > 0;
  return (
    <form className="editor sale-editor" onSubmit={submit}>
      <div className="editor-top">
        <div>
          <p className="eyebrow">OPERACIÓN COMERCIAL</p>
          <h2>
            {value.revision ? "Editar operación" : "Nuevo apartado o venta"}
          </h2>
        </div>
        <button type="button" className="secondary" onClick={() => onDone()}>
          Volver
        </button>
      </div>
      <div className="sale-form-grid">
        <fieldset disabled={busy}>
          <legend>Cliente e inmueble</legend>
          <Field label="Cliente">
            <select
              required
              value={value.customerId}
              onChange={(e) => change({ customerId: e.target.value })}
            >
              <option value="">Seleccionar cliente</option>
              {business.customers.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name} · {c.phone}
                </option>
              ))}
            </select>
          </Field>
          <div className="form-grid">
            <Field label="Tipo">
              <select
                disabled={locked}
                value={value.assetType}
                onChange={(e) =>
                  change({
                    assetType: e.target.value as Sale["assetType"],
                    assetId: "",
                  })
                }
              >
                <option>Propiedad</option>
                <option>Lote</option>
              </select>
            </Field>
            <Field label="Inmueble">
              <select
                required
                disabled={locked}
                value={value.assetId}
                onChange={(e) => selectAsset(e.target.value)}
              >
                <option value="">Seleccionar</option>
                {assets.map((a) => (
                  <option value={a.id} key={a.id}>
                    {"title" in a ? a.title : assetName(a.id)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {locked && (
            <p className="muted">
              El inmueble relacionado no puede cambiarse después del registro.
            </p>
          )}
        </fieldset>
        <fieldset disabled={busy}>
          <legend>Condiciones</legend>
          <div className="form-grid">
            <Field label="Operación">
              <select
                disabled={locked && value.status === "Activa"}
                value={value.status}
                onChange={(e) =>
                  change({ status: e.target.value as Sale["status"] })
                }
              >
                <option>Apartado</option>
                <option>Activa</option>
              </select>
            </Field>
            <Field label="Fecha">
              <input
                type="date"
                required
                value={value.saleDate}
                onChange={(e) => change({ saleDate: e.target.value })}
              />
            </Field>
            <Amount
              label="Precio pactado (MXN)"
              value={value.agreedPrice}
              onChange={(agreedPrice) => recalculate({ agreedPrice })}
            />
            <Field label="Forma de pago">
              <select
                value={value.paymentMethod}
                onChange={(e) =>
                  change({
                    paymentMethod: e.target.value as Sale["paymentMethod"],
                  })
                }
              >
                <option>Efectivo</option>
                <option>Transferencia</option>
                <option>Tarjeta</option>
                <option>Otro</option>
              </select>
            </Field>
            {value.status === "Apartado" && (
              <Amount
                label="Cantidad del apartado"
                value={value.reservationAmount}
                onChange={(reservationAmount) =>
                  recalculate({ reservationAmount })
                }
              />
            )}
            <Amount
              label="Enganche"
              value={value.downPayment}
              onChange={(downPayment) => recalculate({ downPayment })}
            />
            <Amount
              label="Mensualidad acordada"
              value={value.monthlyPayment}
              onChange={setMonthlyPayment}
            />
            <Amount
              label="Plazo en meses"
              value={value.termMonths}
              onChange={setTermMonths}
            />
            <Field label="Fecha del siguiente pago">
              <input
                type="date"
                required={
                  value.status === "Apartado" || value.monthlyPayment > 0
                }
                value={value.nextPaymentDate}
                onChange={(e) => change({ nextPaymentDate: e.target.value })}
              />
            </Field>
          </div>
          <p className="plan-summary">
            Saldo financiado: <strong>{money(financed(value))}</strong> ·{" "}
            {planBasis === "monthly"
              ? "El plazo se calcula desde la mensualidad."
              : "La mensualidad se calcula desde el plazo."}
          </p>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>Comisión y propietario</legend>
          <div className="form-grid">
            <Field label="Tipo de comisión">
              <select
                value={value.commissionType}
                onChange={(e) =>
                  change({
                    commissionType: e.target.value as Sale["commissionType"],
                  })
                }
              >
                <option>Porcentaje</option>
                <option>Monto</option>
              </select>
            </Field>
            <Amount
              label={
                value.commissionType === "Porcentaje"
                  ? "Porcentaje (%)"
                  : "Monto (MXN)"
              }
              value={value.commissionValue}
              onChange={(commissionValue) => change({ commissionValue })}
            />
            <Field label="Nombre del propietario (opcional)">
              <input
                maxLength={160}
                value={value.ownerName}
                onChange={(e) => change({ ownerName: e.target.value })}
              />
            </Field>
            <Field label="Teléfono del propietario (opcional)">
              <input
                type="tel"
                maxLength={35}
                value={value.ownerPhone}
                onChange={(e) => change({ ownerPhone: e.target.value })}
              />
            </Field>
          </div>
        </fieldset>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="save-bar">
        <span>
          {value.status === "Apartado"
            ? "El apartado conservará el inmueble como apartado."
            : "La venta marcará el inmueble como vendido."}
        </span>
        <button
          className="button"
          disabled={busy || !business.customers.length}
        >
          {busy ? "Guardando…" : "Guardar operación"}
        </button>
      </div>
    </form>
  );
}

function Cancellation({
  sale,
  role,
  onDone,
}: {
  sale: Sale;
  role: string;
  onDone: () => void;
}) {
  const final = sale.status === "Cancelacion en revision";
  const [notes, setNotes] = useState(final ? sale.cancellationResolution : ""),
    [open, setOpen] = useState(final),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (
    role !== "Administrador" ||
    sale.status === "Cancelada" ||
    sale.status === "Liquidada"
  )
    return null;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (
      !confirm(
        final
          ? "La venta se cancelará y el inmueble volverá a estar disponible. ¿Continuar?"
          : "¿Iniciar la revisión de esta cancelación?",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await postAction(
        `/api/admin/sales/${sale.id}/${final ? "cancel" : "review-cancellation"}`,
        { revision: sale.revision, notes },
      );
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!open)
    return (
      <div className="cancellation-collapsed">
        <button
          className="text-button danger-text"
          onClick={() => setOpen(true)}
        >
          Revisar cancelación
        </button>
      </div>
    );
  return (
    <form className="cancellation-box" onSubmit={submit}>
      <div className="card-heading">
        <strong>{final ? "Resolver cancelación" : "Cancelación"}</strong>
        {!final && (
          <button
            type="button"
            className="text-button"
            onClick={() => setOpen(false)}
          >
            Cerrar
          </button>
        )}
      </div>
      <p>
        {final
          ? "Describe el acuerdo aceptado por el cliente y el propietario. El inmueble solo se liberará al confirmar."
          : "Registra el motivo y deja la operación en revisión sin liberar el inmueble."}
      </p>
      <Field label={final ? "Resolución acordada" : "Motivo de revisión"}>
        <textarea
          required
          rows={3}
          maxLength={3000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      {error && <p className="error">{error}</p>}
      <button className={final ? "danger-button" : "secondary"} disabled={busy}>
        {busy
          ? "Procesando…"
          : final
            ? "Confirmar cancelación"
            : "Iniciar revisión"}
      </button>
    </form>
  );
}

type ReceiptRecord = {
  folio: string;
  date: string;
  concept: string;
  amount: number;
  method: Sale["paymentMethod"];
  reference: string;
  status: "Aplicado" | "Cancelado";
  currentBalance: number;
  applications: string[];
  issuedBy?: string;
};
const receiptFolio = (id: string, date: string, prefix = "") =>
  `CM-${date.slice(0, 4)}-${prefix}${id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;

function paymentApplication(
  sale: Sale,
  payments: Payment[],
  target: Payment,
): { applications: string[]; currentBalance: number } {
  if (target.status === "Cancelado")
    return {
      applications: ["Movimiento cancelado; sin aplicación vigente"],
      currentBalance: saleBalance(sale, payments).balance,
    };
  const ordered = payments
    .filter(
      (payment) => payment.saleId === sale.id && payment.status === "Aplicado",
    )
    .sort(
      (a, b) =>
        a.paymentDate.localeCompare(b.paymentDate) ||
        a.createdAt.localeCompare(b.createdAt),
    );
  const index = ordered.findIndex((payment) => payment.id === target.id);
  if (index < 0)
    return {
      applications: [target.kind],
      currentBalance: saleBalance(sale, payments).balance,
    };
  const before = saleBalance(sale, ordered.slice(0, index), target.paymentDate),
    after = saleBalance(sale, ordered.slice(0, index + 1), target.paymentDate),
    beforePaid = new Map(
      before.installments.map((item) => [item.dueDate, item.paid]),
    );
  const applications = after.installments
    .map((item) => ({
      number: item.number,
      amount: Math.max(0, item.paid - (beforePaid.get(item.dueDate) || 0)),
    }))
    .filter((item) => item.amount > 0.001)
    .map((item) => `Mensualidad ${item.number}: ${money(item.amount)}`);
  const allocated = after.installments.reduce(
    (total, item) =>
      total + Math.max(0, item.paid - (beforePaid.get(item.dueDate) || 0)),
    0,
  );
  const capital = Math.max(0, target.amount - allocated);
  if (capital > 0.001) applications.push(`Abono a capital: ${money(capital)}`);
  return {
    applications: applications.length ? applications : [target.kind],
    currentBalance: after.balance,
  };
}

function PrintableReceipt({
  sale,
  customer,
  assetName,
  record,
  title,
  onBack,
}: {
  sale: Sale;
  customer?: Customer;
  assetName: string;
  record: ReceiptRecord;
  title: string;
  onBack: () => void;
}) {
  return (
    <div className="receipt-view">
      <div className="receipt-actions no-print">
        <button className="secondary" onClick={onBack}>
          Volver al expediente
        </button>
        <button className="button" onClick={() => window.print()}>
          Imprimir / Guardar PDF
        </button>
      </div>
      <article className="receipt-sheet">
        <header className="receipt-header">
          <img src="/logo-casa-mexino.png?v=2" alt="Casa Mexino" />
          <div>
            <p>CASA MEXINO</p>
            <small>GESTIÓN INMOBILIARIA</small>
          </div>
          <div className="receipt-number">
            <span>{title}</span>
            <strong>{record.folio}</strong>
          </div>
        </header>
        <div className="receipt-title">
          <div>
            <span>Fecha de operación</span>
            <strong>{displayDate(record.date)}</strong>
          </div>
          <span className={`receipt-status ${record.status.toLowerCase()}`}>
            {record.status}
          </span>
        </div>
        <section className="receipt-grid">
          <div>
            <span>Recibimos de</span>
            <strong>{customer?.name || "Cliente no identificado"}</strong>
            <small>{customer?.phone}</small>
          </div>
          <div>
            <span>Por concepto de</span>
            <strong>{record.concept}</strong>
            <small>{assetName}</small>
          </div>
          <div>
            <span>Forma de pago</span>
            <strong>{record.method}</strong>
            <small>
              {record.reference
                ? `Referencia: ${record.reference}`
                : "Sin referencia"}
            </small>
          </div>
          <div>
            <span>Precio pactado</span>
            <strong>{money(sale.agreedPrice)}</strong>
            <small>Saldo actual: {money(record.currentBalance)}</small>
          </div>
        </section>
        <section className="receipt-application">
          <span>Aplicación del pago</span>
          {record.applications.map((application) => (
            <strong key={application}>{application}</strong>
          ))}
        </section>
        <div className="receipt-total">
          <span>Cantidad recibida</span>
          <strong>{money(record.amount)}</strong>
        </div>
        {record.issuedBy && (
          <p className="receipt-audit">Registrado por {record.issuedBy}</p>
        )}
        <footer>
          <span>
            Este comprobante corresponde al registro interno de Casa Mexino.
          </span>
          <span>Matehuala, San Luis Potosí</span>
        </footer>
      </article>
    </div>
  );
}

function ReceiptsAndDeliveries({
  sale,
  payments,
  deliveries,
  receipts,
  customer,
  assetName,
  role,
  onChanged,
}: {
  sale: Sale;
  payments: Payment[];
  deliveries: OwnerDelivery[];
  receipts: Receipt[];
  customer?: Customer;
  assetName: string;
  role: string;
  onChanged: () => Promise<void>;
}) {
  const salePayments = payments.filter((p) => p.saleId === sale.id),
    saleDeliveries = deliveries.filter((d) => d.saleId === sale.id),
    summary = saleBalance(sale, payments),
    settlement = ownerSettlement(sale, payments, deliveries);
  const [receipt, setReceipt] = useState<ReceiptRecord | null>(null),
    [amount, setAmount] = useState(""),
    [deliveryDate, setDeliveryDate] = useState(
      new Date().toISOString().slice(0, 10),
    ),
    [method, setMethod] = useState<Sale["paymentMethod"]>("Efectivo"),
    [recipient, setRecipient] = useState(sale.ownerName),
    [reference, setReference] = useState(""),
    [notes, setNotes] = useState(""),
    [cancelId, setCancelId] = useState(""),
    [cancelReason, setCancelReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const initialReceipt: ReceiptRecord = {
    folio:
      receipts.find(
        (item) => item.sourceType === "Inicial" && item.sourceId === sale.id,
      )?.folio || receiptFolio(sale.id, sale.saleDate, "INI-"),
    date: sale.saleDate,
    concept: "Apartado y enganche inicial",
    amount: summary.initialPaid,
    method: sale.paymentMethod,
    reference: "",
    status: sale.status === "Cancelada" ? "Cancelado" : "Aplicado",
    currentBalance: summary.balance,
    applications: [
      ...(sale.reservationAmount > 0
        ? [`Apartado: ${money(sale.reservationAmount)}`]
        : []),
      ...(sale.downPayment > 0 ? [`Enganche: ${money(sale.downPayment)}`] : []),
    ],
  };
  async function registerDelivery(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await postAction(`/api/admin/sales/${sale.id}/deliveries`, {
        amount: Number(amount),
        deliveryDate,
        paymentMethod: method,
        recipient,
        reference,
        notes,
      });
      setAmount("");
      setReference("");
      setNotes("");
      setSuccess("Entrega al propietario registrada.");
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function cancelDelivery(e: FormEvent, delivery: OwnerDelivery) {
    e.preventDefault();
    if (
      !confirm(
        "La entrega permanecerá en el historial como cancelada. ¿Continuar?",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await postAction(`/api/admin/deliveries/${delivery.id}/cancel`, {
        revision: delivery.revision,
        reason: cancelReason,
      });
      setCancelId("");
      setCancelReason("");
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (receipt)
    return (
      <PrintableReceipt
        sale={sale}
        customer={customer}
        assetName={assetName}
        record={receipt}
        title="RECIBO DE PAGO"
        onBack={() => setReceipt(null)}
      />
    );
  return (
    <>
      <section className="collection-card payment-history receipt-history">
        <div className="card-heading">
          <div>
            <h2>Recibos</h2>
            <p>Comprobantes listos para imprimir o guardar como PDF.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Cantidad</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {summary.initialPaid > 0 && (
                <tr>
                  <td>
                    <strong>{initialReceipt.folio}</strong>
                  </td>
                  <td>{displayDate(initialReceipt.date)}</td>
                  <td>{initialReceipt.concept}</td>
                  <td>{money(initialReceipt.amount)}</td>
                  <td>
                    <span
                      className={`payment-status ${initialReceipt.status.toLowerCase()}`}
                    >
                      {initialReceipt.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => setReceipt(initialReceipt)}
                    >
                      Ver recibo
                    </button>
                  </td>
                </tr>
              )}
              {salePayments.map((payment) => {
                const application = paymentApplication(sale, payments, payment);
                const record: ReceiptRecord = {
                  folio:
                    receipts.find(
                      (item) =>
                        item.sourceType === "Pago" &&
                        item.sourceId === payment.id,
                    )?.folio || receiptFolio(payment.id, payment.paymentDate),
                  date: payment.paymentDate,
                  concept: payment.kind,
                  amount: payment.amount,
                  method: payment.paymentMethod,
                  reference: payment.reference,
                  status: payment.status,
                  currentBalance: application.currentBalance,
                  applications: application.applications,
                  issuedBy: payment.createdBy,
                };
                return (
                  <tr key={payment.id}>
                    <td>
                      <strong>{record.folio}</strong>
                    </td>
                    <td>{displayDate(record.date)}</td>
                    <td>{record.concept}</td>
                    <td>{money(record.amount)}</td>
                    <td>
                      <span
                        className={`payment-status ${record.status.toLowerCase()}`}
                      >
                        {record.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setReceipt(record)}
                      >
                        Ver recibo
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {summary.initialPaid <= 0 && !salePayments.length && (
          <div className="empty compact-empty">
            Todavía no hay movimientos con recibo.
          </div>
        )}
      </section>
      {role === "Administrador" && (
        <section className="owner-settlement">
          <div className="section-top">
            <div>
              <p className="eyebrow">CONTROL INTERNO</p>
              <h2>Entregas al propietario</h2>
              <p className="muted">
                La comisión se retiene únicamente sobre el dinero efectivamente
                cobrado.
              </p>
            </div>
          </div>
          <div className="settlement-metrics">
            <div>
              <span>Comisión pactada</span>
              <strong>{money(settlement.contractedCommission)}</strong>
            </div>
            <div>
              <span>Comisión retenida</span>
              <strong>{money(settlement.commissionRetained)}</strong>
            </div>
            <div>
              <span>Entregado</span>
              <strong>{money(settlement.delivered)}</strong>
            </div>
            <div>
              <span>Pendiente de entregar</span>
              <strong>{money(settlement.pendingDelivery)}</strong>
            </div>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="success" role="status">
              {success}
            </p>
          )}
          <div className="delivery-layout">
            <section className="collection-card">
              <h3>Registrar entrega</h3>
              <p className="owner-caption">
                Disponible para el propietario:{" "}
                <strong>{money(settlement.ownerFundsAvailable)}</strong>
              </p>
              {settlement.pendingDelivery > 0 ? (
                <form onSubmit={registerDelivery}>
                  <div className="form-grid">
                    <Field label="Cantidad (MXN)">
                      <input
                        required
                        type="number"
                        min="0.01"
                        max={settlement.pendingDelivery}
                        step="any"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </Field>
                    <Field label="Fecha">
                      <input
                        required
                        type="date"
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                      />
                    </Field>
                    <Field label="Entregado a">
                      <input
                        required
                        maxLength={160}
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                      />
                    </Field>
                    <Field label="Forma de entrega">
                      <select
                        value={method}
                        onChange={(e) =>
                          setMethod(e.target.value as Sale["paymentMethod"])
                        }
                      >
                        <option>Efectivo</option>
                        <option>Transferencia</option>
                        <option>Tarjeta</option>
                        <option>Otro</option>
                      </select>
                    </Field>
                    <Field label="Referencia (opcional)">
                      <input
                        maxLength={120}
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="Notas (opcional)">
                    <textarea
                      rows={3}
                      maxLength={1000}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </Field>
                  <button
                    className="button"
                    disabled={
                      busy ||
                      Number(amount) <= 0 ||
                      Number(amount) > settlement.pendingDelivery
                    }
                  >
                    {busy ? "Registrando…" : "Registrar entrega"}
                  </button>
                </form>
              ) : (
                <div className="empty compact-empty">
                  No hay saldo disponible pendiente de entregar.
                </div>
              )}
            </section>
            <section className="collection-card">
              <h3>Historial de entregas</h3>
              {saleDeliveries.length ? (
                <div className="delivery-list">
                  {saleDeliveries.map((delivery) => (
                    <article key={delivery.id}>
                      <div>
                        <span
                          className={`payment-status ${delivery.status.toLowerCase()}`}
                        >
                          {delivery.status}
                        </span>
                        <strong>{money(delivery.amount)}</strong>
                        <small>
                          {displayDate(delivery.deliveryDate)} ·{" "}
                          {delivery.recipient}
                        </small>
                        {delivery.reference && (
                          <small>Ref. {delivery.reference}</small>
                        )}
                        {delivery.cancellationReason && (
                          <small>{delivery.cancellationReason}</small>
                        )}
                      </div>
                      {delivery.status === "Aplicada" &&
                        (cancelId === delivery.id ? (
                          <form
                            className="cancel-payment"
                            onSubmit={(e) => void cancelDelivery(e, delivery)}
                          >
                            <input
                              required
                              maxLength={1000}
                              placeholder="Motivo de cancelación"
                              value={cancelReason}
                              onChange={(e) => setCancelReason(e.target.value)}
                            />
                            <button className="danger-button" disabled={busy}>
                              Confirmar
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => {
                                setCancelId("");
                                setCancelReason("");
                              }}
                            >
                              Volver
                            </button>
                          </form>
                        ) : (
                          <button
                            className="text-button danger-text"
                            onClick={() => setCancelId(delivery.id)}
                          >
                            Cancelar
                          </button>
                        ))}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty compact-empty">
                  Todavía no hay entregas al propietario.
                </div>
              )}
            </section>
          </div>
        </section>
      )}
    </>
  );
}

function PaymentPanel({
  sale,
  payments,
  deliveries,
  receipts,
  customer,
  assetName,
  role,
  onBack,
  onChanged,
}: {
  sale: Sale;
  payments: Payment[];
  deliveries: OwnerDelivery[];
  receipts: Receipt[];
  customer?: Customer;
  assetName: string;
  role: string;
  onBack: () => void;
  onChanged: () => Promise<void>;
}) {
  const summary = saleBalance(sale, payments),
    [amount, setAmount] = useState(""),
    [paymentDate, setPaymentDate] = useState(
      new Date().toISOString().slice(0, 10),
    ),
    [method, setMethod] = useState<Sale["paymentMethod"]>("Efectivo"),
    [kind, setKind] = useState<Payment["kind"]>("Mensualidad"),
    [reference, setReference] = useState(""),
    [notes, setNotes] = useState(""),
    [cancelId, setCancelId] = useState(""),
    [cancelReason, setCancelReason] = useState(""),
    [showAll, setShowAll] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const salePayments = payments.filter((p) => p.saleId === sale.id),
    canPay =
      ["Apartado", "Activa"].includes(sale.status) && summary.balance > 0;
  const paymentAmount = Number(amount),
    attention = summary.installments.filter(
      (item) => item.status === "Vencida" || item.status === "Parcial",
    ),
    upcoming = summary.installments
      .filter((item) => item.status === "Pendiente")
      .slice(0, 6),
    visibleInstallments = showAll
      ? summary.installments
      : [...attention, ...upcoming];
  async function register(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await postAction(`/api/admin/sales/${sale.id}/payments`, {
        amount: paymentAmount,
        paymentDate,
        paymentMethod: method,
        kind,
        reference,
        notes,
      });
      setSuccess("Pago registrado correctamente.");
      setAmount("");
      setReference("");
      setNotes("");
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel(e: FormEvent, payment: Payment) {
    e.preventDefault();
    if (
      !confirm(
        "El pago se conservará en el historial como cancelado. ¿Continuar?",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await postAction(`/api/admin/payments/${payment.id}/cancel`, {
        revision: payment.revision,
        reason: cancelReason,
      });
      setCancelId("");
      setCancelReason("");
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="collection-detail">
      <div className="editor-top">
        <div>
          <p className="eyebrow">EXPEDIENTE DE COBRANZA</p>
          <h1>{assetName}</h1>
          <p className="muted">
            {customer?.name} · {customer?.phone}
          </p>
        </div>
        <button className="secondary" onClick={onBack}>
          Volver a ventas
        </button>
      </div>
      <div className="collection-metrics">
        <div>
          <span>Saldo pendiente</span>
          <strong>{money(summary.balance)}</strong>
        </div>
        <div>
          <span>Total recibido</span>
          <strong>{money(summary.totalPaid)}</strong>
          <small>Incluye {money(summary.initialPaid)} iniciales</small>
        </div>
        <div>
          <span>Vencido</span>
          <strong className={summary.overdue > 0 ? "overdue" : ""}>
            {money(summary.overdue)}
          </strong>
        </div>
        <div>
          <span>Próximo vencimiento</span>
          <strong className="date-value">
            {summary.balance <= 0
              ? "Liquidado"
              : displayDate(summary.nextDueDate || sale.nextPaymentDate)}
          </strong>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="success" role="status">
          {success}
        </p>
      )}
      <div className="collection-layout">
        <section className="collection-card">
          <h2>Registrar pago</h2>
          {canPay ? (
            <form onSubmit={register}>
              <div className="form-grid">
                <Field label="Cantidad (MXN)">
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </Field>
                <Field label="Fecha de pago">
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </Field>
                <Field label="Tipo de movimiento">
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as Payment["kind"])}
                  >
                    <option>Mensualidad</option>
                    <option>Abono extraordinario</option>
                  </select>
                </Field>
                <Field label="Forma de pago">
                  <select
                    value={method}
                    onChange={(e) =>
                      setMethod(e.target.value as Sale["paymentMethod"])
                    }
                  >
                    <option>Efectivo</option>
                    <option>Transferencia</option>
                    <option>Tarjeta</option>
                    <option>Otro</option>
                  </select>
                </Field>
                <Field label="Referencia (opcional)">
                  <input
                    maxLength={120}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Notas (opcional)">
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
              <p className="muted">
                El pago se aplicará primero a la mensualidad pendiente más
                antigua. Un excedente reduce el plazo restante.
              </p>
              <button
                className="button"
                disabled={
                  busy || paymentAmount <= 0 || paymentAmount > summary.balance
                }
              >
                {busy ? "Registrando…" : "Registrar pago"}
              </button>
            </form>
          ) : (
            <div className="empty compact-empty">
              {summary.balance <= 0
                ? "Esta operación está liquidada."
                : "No es posible registrar pagos en el estado actual."}
            </div>
          )}
        </section>
        <section className="collection-card">
          <div className="card-heading">
            <div>
              <h2>Calendario</h2>
              <p>
                {showAll
                  ? `${summary.installments.length} mensualidades`
                  : `${attention.length} con atención · próximas ${upcoming.length}`}
              </p>
            </div>
            {summary.installments.length > visibleInstallments.length && (
              <button className="text-button" onClick={() => setShowAll(true)}>
                Ver calendario completo
              </button>
            )}
            {showAll && summary.installments.length > 6 && (
              <button className="text-button" onClick={() => setShowAll(false)}>
                Ver resumen
              </button>
            )}
          </div>
          {summary.installments.length ? (
            <div className="installment-list">
              {visibleInstallments.map((item) => (
                <div className="installment-row" key={item.number}>
                  <span
                    className={`installment-status ${item.status.toLowerCase()}`}
                  >
                    {item.status}
                  </span>
                  <strong>Mensualidad {item.number}</strong>
                  <span>{displayDate(item.dueDate)}</span>
                  <span>
                    {money(item.paid)} de {money(item.amount)}
                  </span>
                  {item.pending > 0 && <b>Pendiente {money(item.pending)}</b>}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty compact-empty">
              Define una mensualidad y fecha inicial para generar el calendario.
            </div>
          )}
        </section>
      </div>
      <section className="collection-card payment-history">
        <h2>Historial de pagos</h2>
        {salePayments.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Movimiento</th>
                  <th>Forma de pago</th>
                  <th>Cantidad</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {salePayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{displayDate(payment.paymentDate)}</td>
                    <td>
                      <strong>{payment.kind}</strong>
                      {payment.reference && (
                        <small>Ref. {payment.reference}</small>
                      )}
                    </td>
                    <td>{payment.paymentMethod}</td>
                    <td>{money(payment.amount)}</td>
                    <td>
                      <span
                        className={`payment-status ${payment.status.toLowerCase()}`}
                      >
                        {payment.status}
                      </span>
                      {payment.cancellationReason && (
                        <small>{payment.cancellationReason}</small>
                      )}
                    </td>
                    <td>
                      {role === "Administrador" &&
                        payment.status === "Aplicado" &&
                        (cancelId === payment.id ? (
                          <form
                            className="cancel-payment"
                            onSubmit={(e) => void cancel(e, payment)}
                          >
                            <input
                              required
                              maxLength={1000}
                              placeholder="Motivo de cancelación"
                              value={cancelReason}
                              onChange={(e) => setCancelReason(e.target.value)}
                            />
                            <button className="danger-button" disabled={busy}>
                              Confirmar
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => {
                                setCancelId("");
                                setCancelReason("");
                              }}
                            >
                              Volver
                            </button>
                          </form>
                        ) : (
                          <button
                            className="text-button danger-text"
                            onClick={() => setCancelId(payment.id)}
                          >
                            Cancelar pago
                          </button>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty compact-empty">
            Aún no hay pagos posteriores al apartado o enganche.
          </div>
        )}
      </section>
      <ReceiptsAndDeliveries
        sale={sale}
        payments={payments}
        deliveries={deliveries}
        receipts={receipts}
        customer={customer}
        assetName={assetName}
        role={role}
        onChanged={onChanged}
      />
    </div>
  );
}

function ReceiptAdmin({
  data,
  catalog,
}: {
  data: BusinessData;
  catalog: Catalog;
}) {
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState<{
      record: ReceiptRecord;
      sale: Sale;
      customer?: Customer;
      assetName: string;
    } | null>(null);
  function assetName(sale: Sale) {
    const property = catalog.properties.find(
      (item) => item.id === sale.assetId,
    );
    if (property) return property.title;
    const lot = catalog.lots.find((item) => item.id === sale.assetId),
      development =
        lot &&
        catalog.developments.find((item) => item.id === lot.developmentId);
    return lot
      ? `${development?.title || "Fraccionamiento"} · M${lot.block} L${lot.number}`
      : "Inmueble no encontrado";
  }
  const entries = data.receipts
    .flatMap((receipt) => {
      const sale = data.sales.find((item) => item.id === receipt.saleId);
      if (!sale) return [];
      const customer = data.customers.find(
          (item) => item.id === sale.customerId,
        ),
        name = assetName(sale);
      if (receipt.sourceType === "Inicial") {
        const summary = saleBalance(sale, data.payments),
          amount = summary.initialPaid;
        return [
          {
            receipt,
            sale,
            customer,
            assetName: name,
            record: {
              folio: receipt.folio,
              date: receipt.issuedDate,
              concept: "Apartado y enganche inicial",
              amount,
              method: sale.paymentMethod,
              reference: "",
              status:
                sale.status === "Cancelada"
                  ? ("Cancelado" as const)
                  : ("Aplicado" as const),
              currentBalance: summary.balance,
              applications: [
                ...(sale.reservationAmount > 0
                  ? [`Apartado: ${money(sale.reservationAmount)}`]
                  : []),
                ...(sale.downPayment > 0
                  ? [`Enganche: ${money(sale.downPayment)}`]
                  : []),
              ],
            },
          },
        ];
      }
      const payment = data.payments.find(
        (item) => item.id === receipt.sourceId,
      );
      if (!payment) return [];
      const application = paymentApplication(sale, data.payments, payment);
      return [
        {
          receipt,
          sale,
          customer,
          assetName: name,
          record: {
            folio: receipt.folio,
            date: payment.paymentDate,
            concept: payment.kind,
            amount: payment.amount,
            method: payment.paymentMethod,
            reference: payment.reference,
            status: payment.status,
            currentBalance: application.currentBalance,
            applications: application.applications,
            issuedBy: payment.createdBy,
          },
        },
      ];
    })
    .filter((entry) =>
      `${entry.receipt.folio} ${entry.customer?.name || ""} ${entry.assetName}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  if (selected)
    return (
      <PrintableReceipt
        {...selected}
        title="RECIBO DE PAGO"
        onBack={() => setSelected(null)}
      />
    );
  return (
    <div className="business-admin">
      <div className="section-top">
        <div>
          <p className="eyebrow">CONTROL DOCUMENTAL</p>
          <h1>Recibos</h1>
          <p className="muted">
            Consulta y reimprime todos los comprobantes foliados.
          </p>
        </div>
        <div className="receipt-counter">
          <span>Total emitidos</span>
          <strong>{data.receipts.length}</strong>
        </div>
      </div>
      <Field label="Buscar por folio, cliente o inmueble">
        <input
          className="admin-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="CM-2026-000001"
        />
      </Field>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Folio</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Inmueble</th>
              <th>Concepto</th>
              <th>Cantidad</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.receipt.id}>
                <td>
                  <strong>{entry.receipt.folio}</strong>
                </td>
                <td>{displayDate(entry.record.date)}</td>
                <td>{entry.customer?.name || "Cliente no encontrado"}</td>
                <td>{entry.assetName}</td>
                <td>{entry.record.concept}</td>
                <td>{money(entry.record.amount)}</td>
                <td>
                  <span
                    className={`payment-status ${entry.record.status.toLowerCase()}`}
                  >
                    {entry.record.status}
                  </span>
                </td>
                <td>
                  <button
                    className="text-button"
                    onClick={() => setSelected(entry)}
                  >
                    Ver recibo
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!entries.length && (
          <div className="empty">
            No hay recibos que coincidan con la búsqueda.
          </div>
        )}
      </div>
    </div>
  );
}

export default function SalesAdmin({
  section,
  role,
  catalog,
}: {
  section: "Clientes" | "Ventas" | "Recibos";
  role: string;
  catalog: Catalog;
}) {
  const [data, setData] = useState<BusinessData>({
      customers: [],
      sales: [],
      payments: [],
      deliveries: [],
      receipts: [],
    }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [customer, setCustomer] = useState<Customer | null>(null),
    [sale, setSale] = useState<Sale | null>(null),
    [collectionId, setCollectionId] = useState("");
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
  useEffect(() => {
    void reload();
  }, []);
  const customerName = (id: string) =>
    data.customers.find((c) => c.id === id)?.name || "Cliente no encontrado";
  const assetName = (s: Sale) => {
    const p = catalog.properties.find((x) => x.id === s.assetId);
    if (p) return p.title;
    const l = catalog.lots.find((x) => x.id === s.assetId),
      d = l && catalog.developments.find((x) => x.id === l.developmentId);
    return l
      ? `${d?.title || "Fraccionamiento"} · M${l.block} L${l.number}`
      : "Inmueble no encontrado";
  };
  const complete = () => {
    setCustomer(null);
    setSale(null);
    void reload();
  };
  if (customer)
    return (
      <CustomerForm
        initial={customer}
        onDone={(saved) => {
          if (saved)
            setData((x) => ({
              ...x,
              customers: [
                saved,
                ...x.customers.filter((c) => c.id !== saved.id),
              ],
            }));
          setCustomer(null);
        }}
      />
    );
  if (sale)
    return (
      <SaleForm
        initial={sale}
        business={data}
        catalog={catalog}
        onDone={(saved) => {
          setSale(null);
          if (saved) void reload();
        }}
      />
    );
  const collectionSale = data.sales.find((s) => s.id === collectionId);
  if (collectionSale)
    return (
      <PaymentPanel
        sale={collectionSale}
        payments={data.payments}
        deliveries={data.deliveries}
        receipts={data.receipts}
        customer={data.customers.find(
          (c) => c.id === collectionSale.customerId,
        )}
        assetName={assetName(collectionSale)}
        role={role}
        onBack={() => setCollectionId("")}
        onChanged={reload}
      />
    );
  if (loading)
    return (
      <div className="empty" role="status">
        Cargando {section.toLowerCase()}…
      </div>
    );
  if (section === "Recibos")
    return <ReceiptAdmin data={data} catalog={catalog} />;
  return (
    <div className="business-admin">
      {error && (
        <div className="error">
          {error} <button onClick={() => void reload()}>Reintentar</button>
        </div>
      )}
      <div className="section-top">
        <div>
          <p className="eyebrow">GESTIÓN COMERCIAL</p>
          <h1>{section}</h1>
        </div>
        <button
          className="button"
          onClick={() =>
            section === "Clientes"
              ? setCustomer(blankCustomer())
              : setSale(blankSale())
          }
          disabled={section === "Ventas" && !data.customers.length}
        >
          + {section === "Clientes" ? "Nuevo cliente" : "Nueva operación"}
        </button>
      </div>
      {section === "Ventas" && !data.customers.length && (
        <div className="notice">
          Primero registra un cliente para crear una venta o apartado.
        </div>
      )}
      {section === "Ventas" && (
        <div className="sales-metrics">
          <div>
            <span>Apartados</span>
            <strong>
              {data.sales.filter((s) => s.status === "Apartado").length}
            </strong>
          </div>
          <div>
            <span>Ventas activas</span>
            <strong>
              {data.sales.filter((s) => s.status === "Activa").length}
            </strong>
          </div>
          <div>
            <span>En revisión</span>
            <strong>
              {
                data.sales.filter((s) => s.status === "Cancelacion en revision")
                  .length
              }
            </strong>
          </div>
          <div>
            <span>Saldo por cobrar</span>
            <strong>
              {money(
                data.sales
                  .filter(
                    (s) =>
                      !["Cancelada", "Cancelacion en revision"].includes(
                        s.status,
                      ),
                  )
                  .reduce(
                    (n, s) => n + saleBalance(s, data.payments).balance,
                    0,
                  ),
              )}
            </strong>
          </div>
        </div>
      )}
      <Field label={`Buscar ${section.toLowerCase()}`}>
        <input
          className="admin-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            section === "Clientes" ? "Nombre o teléfono" : "Cliente o inmueble"
          }
        />
      </Field>
      {section === "Clientes" ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Contacto</th>
                <th>Operaciones</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.customers
                .filter((c) =>
                  `${c.name} ${c.phone}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                      <small>{c.address || "Sin domicilio registrado"}</small>
                    </td>
                    <td>{c.phone}</td>
                    <td>
                      {
                        data.sales.filter(
                          (s) =>
                            s.customerId === c.id && s.status !== "Cancelada",
                        ).length
                      }
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setCustomer(c)}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!data.customers.length && (
            <div className="empty">Aún no hay clientes registrados.</div>
          )}
        </div>
      ) : (
        <div className="sales-list">
          {data.sales
            .filter((s) =>
              `${customerName(s.customerId)} ${assetName(s)}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((s) => {
              const balance = saleBalance(s, data.payments);
              return (
                <article className="sale-card" key={s.id}>
                  <div>
                    <span
                      className={`sale-status ${s.status.toLowerCase().replaceAll(" ", "-")}`}
                    >
                      {displayStatus(s.status)}
                    </span>
                    <h2>{assetName(s)}</h2>
                    <p>
                      {customerName(s.customerId)} ·{" "}
                      {data.customers.find((c) => c.id === s.customerId)?.phone}
                    </p>
                  </div>
                  <div className="sale-numbers">
                    <span>
                      Precio pactado<strong>{money(s.agreedPrice)}</strong>
                    </span>
                    <span>
                      Recibido<strong>{money(balance.totalPaid)}</strong>
                    </span>
                    <span>
                      Saldo<strong>{money(balance.balance)}</strong>
                    </span>
                    <span>
                      Próximo pago
                      <strong>
                        {balance.balance <= 0
                          ? "Liquidado"
                          : displayDate(
                              balance.nextDueDate || s.nextPaymentDate,
                            )}
                      </strong>
                    </span>
                  </div>
                  <div className="sale-actions">
                    {!["Cancelada", "Cancelacion en revision"].includes(
                      s.status,
                    ) && (
                      <button
                        className="text-button"
                        onClick={() => setCollectionId(s.id)}
                      >
                        Cobranza
                      </button>
                    )}
                    {["Apartado", "Activa"].includes(s.status) && (
                      <button
                        className="text-button"
                        onClick={() => setSale(s)}
                      >
                        Editar
                      </button>
                    )}
                  </div>
                  <Cancellation sale={s} role={role} onDone={complete} />
                </article>
              );
            })}
          {!data.sales.length && (
            <div className="empty">Todavía no hay apartados ni ventas.</div>
          )}
        </div>
      )}
    </div>
  );
}
