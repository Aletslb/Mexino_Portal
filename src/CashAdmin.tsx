import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { api, postAction } from "./api";
import { money, ownerSettlement } from "./model";
import type {
  BusinessData,
  CashClosing,
  CashData,
  CashMovement,
  Sale,
} from "./model";

const today = () => new Date().toISOString().slice(0, 10);
const methods = ["Efectivo", "Transferencia", "Tarjeta", "Otro"] as const;
type CashForm = {
  movementType: "Ingreso" | "Gasto";
  category: string;
  amount: number;
  movementDate: string;
  paymentMethod: Sale["paymentMethod"];
  beneficiary: string;
  reference: string;
  notes: string;
};
const blankMovement = (): CashForm => ({
  movementType: "Gasto",
  category: "Gasto operativo",
  amount: 0,
  movementDate: today(),
  paymentMethod: "Efectivo" as Sale["paymentMethod"],
  beneficiary: "",
  reference: "",
  notes: "",
});

export default function CashAdmin() {
  const [data, setData] = useState<CashData>({ movements: [], closings: [] }),
    [business, setBusiness] = useState<BusinessData>({
      owners: [],
      customers: [],
      sales: [],
      payments: [],
      deliveries: [],
      receipts: [],
    }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [form, setForm] = useState(blankMovement()),
    [showForm, setShowForm] = useState(false),
    [busy, setBusy] = useState(false),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [method, setMethod] = useState("Todas"),
    [query, setQuery] = useState(""),
    [closing, setClosing] = useState({
      closingDate: today(),
      paymentMethod: "Efectivo" as Sale["paymentMethod"],
      countedAmount: 0,
      notes: "",
    }),
    [cancel, setCancel] = useState("");
  async function load() {
    setLoading(true);
    try {
      const [cash, operations] = await Promise.all([
        api<CashData>("/api/admin/cash"),
        api<BusinessData>("/api/admin/business"),
      ]);
      setData(cash);
      setBusiness(operations);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const applied = data.movements.filter((x) => x.status === "Aplicado"),
    balance = (items: CashMovement[]) =>
      items.reduce(
        (sum, x) => sum + (x.movementType === "Ingreso" ? x.amount : -x.amount),
        0,
      ),
    total = balance(applied),
    cash = balance(applied.filter((x) => x.paymentMethod === "Efectivo")),
    transfers = balance(
      applied.filter((x) => x.paymentMethod === "Transferencia"),
    ),
    retained = business.sales
      .filter((x) => x.status !== "Cancelada")
      .reduce(
        (sum, sale) =>
          sum +
          ownerSettlement(sale, business.payments, business.deliveries)
            .commissionRetained,
        0,
      );
  const visible = useMemo(
    () =>
      data.movements.filter(
        (x) =>
          (!from || x.movementDate >= from) &&
          (!to || x.movementDate <= to) &&
          (method === "Todas" || x.paymentMethod === method) &&
          `${x.category} ${x.beneficiary} ${x.reference} ${x.notes}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [data.movements, from, to, method, query],
  );
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await postAction("/api/admin/cash/movements", form);
      setForm(blankMovement());
      setShowForm(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function cancelMovement(item: CashMovement) {
    const reason = prompt("Motivo de cancelación:");
    if (!reason) return;
    setCancel(item.id);
    setError("");
    try {
      await postAction(`/api/admin/cash/movements/${item.id}/cancel`, {
        revision: item.revision,
        reason,
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCancel("");
    }
  }
  async function closeDay(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await postAction<CashClosing>("/api/admin/cash/closings", closing);
      setClosing({ ...closing, countedAmount: 0, notes: "" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function exportCsv() {
    const rows = [
        [
          "Fecha",
          "Tipo",
          "Categoría",
          "Forma de pago",
          "Beneficiario",
          "Referencia",
          "Cantidad",
          "Estado",
        ],
        ...visible.map((x) => [
          x.movementDate,
          x.movementType,
          x.category,
          x.paymentMethod,
          x.beneficiary,
          x.reference,
          String(x.amount),
          x.status,
        ]),
      ],
      csv = rows
        .map((row) =>
          row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","),
        )
        .join("\n"),
      link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob(["\ufeff" + csv], { type: "text/csv" }),
    );
    link.download = `caja-${from || "inicio"}-${to || today()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  if (loading) return <div className="empty">Cargando caja…</div>;
  return (
    <div className="cash-admin">
      <div className="section-top">
        <div>
          <p className="eyebrow">CONTROL INTERNO</p>
          <h1>Caja</h1>
          <p className="muted">
            Ingresos y gastos operativos, separados de la cobranza de clientes.
          </p>
        </div>
        <button className="button" onClick={() => setShowForm(!showForm)}>
          + Nuevo movimiento
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="cash-metrics">
        <div>
          <span>Saldo operativo</span>
          <strong>{money(total)}</strong>
        </div>
        <div>
          <span>Efectivo</span>
          <strong>{money(cash)}</strong>
        </div>
        <div>
          <span>Transferencias</span>
          <strong>{money(transfers)}</strong>
        </div>
        <div>
          <span>Comisión retenida*</span>
          <strong>{money(retained)}</strong>
          <small>*Referencia calculada desde ventas</small>
        </div>
      </div>
      {showForm && (
        <form className="cash-form" onSubmit={save}>
          <h2>Registrar movimiento</h2>
          <div className="form-grid">
            <label className="field">
              <span>Tipo</span>
              <select
                value={form.movementType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    movementType: e.target.value as "Ingreso" | "Gasto",
                    category:
                      e.target.value === "Ingreso"
                        ? "Comisión"
                        : "Gasto operativo",
                  })
                }
              >
                <option>Ingreso</option>
                <option>Gasto</option>
              </select>
            </label>
            <label className="field">
              <span>Categoría</span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {(form.movementType === "Ingreso"
                  ? ["Comisión", "Otro"]
                  : ["Nómina", "Honorarios", "Gasto operativo", "Otro"]
                ).map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Cantidad (MXN)</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={form.amount}
                onChange={(e) =>
                  setForm({ ...form, amount: Number(e.target.value) })
                }
              />
            </label>
            <label className="field">
              <span>Fecha</span>
              <input
                type="date"
                required
                value={form.movementDate}
                onChange={(e) =>
                  setForm({ ...form, movementDate: e.target.value })
                }
              />
            </label>
            <label className="field">
              <span>Forma de pago</span>
              <select
                value={form.paymentMethod}
                onChange={(e) =>
                  setForm({
                    ...form,
                    paymentMethod: e.target.value as Sale["paymentMethod"],
                  })
                }
              >
                {methods.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Empleado, proveedor o beneficiario</span>
              <input
                value={form.beneficiary}
                onChange={(e) =>
                  setForm({ ...form, beneficiary: e.target.value })
                }
              />
            </label>
            <label className="field">
              <span>Referencia</span>
              <input
                value={form.reference}
                onChange={(e) =>
                  setForm({ ...form, reference: e.target.value })
                }
              />
            </label>
            <label className="field">
              <span>Notas</span>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
          </div>
          <div className="inline">
            <button className="button" disabled={busy}>
              {busy ? "Guardando…" : "Guardar movimiento"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      <section className="cash-panel">
        <div className="cash-panel-title">
          <div>
            <h2>Movimientos</h2>
            <p className="muted">
              Los registros cancelados permanecen visibles para auditoría.
            </p>
          </div>
          <button
            className="secondary"
            onClick={exportCsv}
            disabled={!visible.length}
          >
            Exportar CSV
          </button>
        </div>
        <div className="cash-filters">
          <input
            type="date"
            aria-label="Desde"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            type="date"
            aria-label="Hasta"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <select
            aria-label="Forma de pago"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            <option>Todas</option>
            {methods.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <input
            placeholder="Buscar beneficiario o referencia"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Movimiento</th>
                <th>Categoría</th>
                <th>Forma</th>
                <th>Beneficiario</th>
                <th>Cantidad</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id}>
                  <td>{item.movementDate}</td>
                  <td>{item.movementType}</td>
                  <td>{item.category}</td>
                  <td>{item.paymentMethod}</td>
                  <td>
                    {item.beneficiary || "—"}
                    <small>{item.reference}</small>
                  </td>
                  <td
                    className={
                      item.movementType === "Ingreso" ? "cash-in" : "cash-out"
                    }
                  >
                    {item.movementType === "Ingreso" ? "+" : "−"}
                    {money(item.amount)}
                  </td>
                  <td>
                    <span
                      className={`payment-status ${item.status.toLowerCase()}`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td>
                    {item.status === "Aplicado" && (
                      <button
                        className="text-button danger-text"
                        disabled={cancel === item.id}
                        onClick={() => void cancelMovement(item)}
                      >
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length && (
            <div className="empty">No hay movimientos con estos filtros.</div>
          )}
        </div>
      </section>
      <div className="cash-bottom">
        <form className="cash-panel" onSubmit={closeDay}>
          <h2>Cierre por forma de pago</h2>
          <p className="muted">
            Compara el saldo registrado hasta la fecha contra el importe
            contado.
          </p>
          <div className="form-grid">
            <label className="field">
              <span>Fecha</span>
              <input
                type="date"
                required
                value={closing.closingDate}
                onChange={(e) =>
                  setClosing({ ...closing, closingDate: e.target.value })
                }
              />
            </label>
            <label className="field">
              <span>Forma</span>
              <select
                value={closing.paymentMethod}
                onChange={(e) =>
                  setClosing({
                    ...closing,
                    paymentMethod: e.target.value as Sale["paymentMethod"],
                  })
                }
              >
                {methods.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Importe contado</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={closing.countedAmount}
                onChange={(e) =>
                  setClosing({
                    ...closing,
                    countedAmount: Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="field">
              <span>Notas</span>
              <input
                value={closing.notes}
                onChange={(e) =>
                  setClosing({ ...closing, notes: e.target.value })
                }
              />
            </label>
          </div>
          <button className="button" disabled={busy}>
            Registrar cierre
          </button>
        </form>
        <section className="cash-panel">
          <h2>Últimos cierres</h2>
          {data.closings.slice(0, 8).map((x) => (
            <article className="closing-row" key={x.id}>
              <div>
                <strong>
                  {x.closingDate} · {x.paymentMethod}
                </strong>
                <small>
                  Esperado {money(x.expectedAmount)} · Contado{" "}
                  {money(x.countedAmount)}
                </small>
              </div>
              <span
                className={
                  Math.abs(x.difference) < 0.01 ? "balanced" : "unbalanced"
                }
              >
                {x.difference === 0
                  ? "Sin diferencia"
                  : `${x.difference > 0 ? "+" : ""}${money(x.difference)}`}
              </span>
            </article>
          ))}
          {!data.closings.length && (
            <div className="empty compact-empty">
              Aún no hay cierres registrados.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
