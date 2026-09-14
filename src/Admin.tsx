import { useEffect, useState, lazy, Suspense } from "react";
import type { FormEvent, ReactNode } from "react";
import { Brand } from "./PublicPortal";
import { api, postAction, saveRecord, uploadImage } from "./api";
import {
  blankProperty,
  blankDevelopment,
  blankLot,
  emptyCatalog,
  money,
} from "./model";
import type {
  Property,
  Development,
  Lot,
  Catalog,
  PortalSettings,
  Owner,
  BusinessData,
} from "./model";
import PlanView from "./PlanView";
import SalesAdmin from "./SalesAdmin";
import CashAdmin from "./CashAdmin";
import OwnersAdmin, { PendingPanel } from "./OwnersAdmin";
const MapView = lazy(() => import("./MapView"));
type User = { email: string; role: string };
type Audit = {
  id: string;
  record_id: string;
  actor: string;
  action: string;
  created_at: string;
};
type ResetStatus = {
  locked: boolean;
  lockedAt: string;
  lockedBy: string;
  counts: {
    customers: number;
    sales: number;
    payments: number;
    receipts: number;
    deliveries: number;
    owners: number;
    cash: number;
    catalog: number;
  };
};
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </Field>
  );
}
function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min="0"
        step="any"
        required
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  );
}
function useDirty(dirty: boolean) {
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty]);
}
function Commission({
  value,
  change,
}: {
  value: { commissionType: "Porcentaje" | "Monto"; commissionValue: number };
  change: (v: Partial<Property>) => void;
}) {
  return (
    <fieldset>
      <legend>Comisión estimada · uso interno</legend>
      <div className="form-grid">
        <Select
          label="Tipo"
          value={value.commissionType}
          options={["Porcentaje", "Monto"]}
          onChange={(v) =>
            change({ commissionType: v as Property["commissionType"] })
          }
        />
        <NumberField
          label={
            value.commissionType === "Porcentaje"
              ? "Porcentaje (%)"
              : "Monto (MXN)"
          }
          value={value.commissionValue}
          onChange={(v) => change({ commissionValue: v })}
        />
      </div>
    </fieldset>
  );
}
function Ownership({
  value,
  owners,
  change,
}: {
  value: { ownershipType: "Casa Mexino" | "Tercero"; ownerId: string };
  owners: Owner[];
  change: (v: { ownershipType?: "Casa Mexino" | "Tercero"; ownerId?: string }) => void;
}) {
  return (
    <fieldset className="ownership-fieldset">
      <legend>Propiedad y liquidación · uso interno</legend>
      <div className="form-grid">
        <Select
          label="Titular del inmueble"
          value={value.ownershipType}
          options={["Casa Mexino", "Tercero"]}
          onChange={(ownershipType) =>
            change({
              ownershipType: ownershipType as "Casa Mexino" | "Tercero",
              ownerId: ownershipType === "Casa Mexino" ? "" : value.ownerId,
            })
          }
        />
        {value.ownershipType === "Tercero" && (
          <Field label="Propietario">
            <select
              required
              value={value.ownerId}
              onChange={(e) => change({ ownerId: e.target.value })}
            >
              <option value="">Seleccionar propietario</option>
              {owners.filter((owner) => owner.active || owner.id === value.ownerId).map((owner) => (
                <option key={owner.id} value={owner.id}>{owner.name}{owner.phone ? ` · ${owner.phone}` : ""}</option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <p className="muted">
        Dato privado. Define automáticamente a quién se acumulan los fondos cobrados.
      </p>
    </fieldset>
  );
}
function Images({
  images,
  onChange,
  setBusy,
  max = 20,
  title = "Fotografías",
  help = "La primera fotografía será la portada. JPG, PNG o WebP, hasta 8 MB.",
}: {
  images: string[];
  onChange: (v: string[]) => void;
  setBusy: (v: boolean) => void;
  max?: number;
  title?: string;
  help?: string;
}) {
  const [error, setError] = useState(""),
    [uploading, setUploading] = useState(false);
  async function add(files: FileList | null) {
    if (!files) return;
    setError("");
    if (images.length + files.length > max) {
      setError(`Máximo ${max} imágenes.`);
      return;
    }
    setBusy(true);
    setUploading(true);
    const next = [...images];
    try {
      for (const f of Array.from(files)) {
        if (f.size > 8 * 1024 * 1024)
          throw new Error("Máximo 8 MB por imagen.");
        next.push(await uploadImage(f));
        onChange([...next]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setUploading(false);
    }
  }
  return (
    <fieldset>
      <legend>{title}</legend>
      <p className="muted">{help}</p>
      <div className="image-editor">
        {images.map((src, i) => (
          <div key={src + i}>
            <img src={src} alt={`Fotografía ${i + 1}`} />
            <div>
              <button
                type="button"
                disabled={uploading || i === 0}
                onClick={() => {
                  const a = [...images];
                  [a[i - 1], a[i]] = [a[i], a[i - 1]];
                  onChange(a);
                }}
                aria-label={`Mover fotografía ${i + 1} antes`}
              >
                ←
              </button>
              <button
                type="button"
                disabled={uploading || i === images.length - 1}
                onClick={() => {
                  const a = [...images];
                  [a[i + 1], a[i]] = [a[i], a[i + 1]];
                  onChange(a);
                }}
                aria-label={`Mover fotografía ${i + 1} después`}
              >
                →
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={() => onChange(images.filter((_, n) => n !== i))}
              >
                Quitar
              </button>
            </div>
          </div>
        ))}
      </div>
      {images.length < max && (
        <Field label={uploading ? "Subiendo…" : "Agregar fotografías"}>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple={max > 1}
            disabled={uploading}
            onChange={(e) => {
              void add(e.target.files);
              e.target.value = "";
            }}
          />
        </Field>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

const cropOptions = [
  ["center center", "Centro"],
  ["center top", "Arriba"],
  ["center bottom", "Abajo"],
  ["left center", "Izquierda"],
  ["right center", "Derecha"],
];
function SettingsEditor({
  initial,
  onSaved,
}: {
  initial: PortalSettings;
  onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState(initial),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  useDirty(dirty);
  const change = (v: Partial<PortalSettings>) => {
    setValue((x) => ({ ...x, ...v }));
    setDirty(true);
    setSuccess("");
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const saved = await saveRecord<PortalSettings>("settings", value);
      setValue(saved);
      setDirty(false);
      setSuccess("El portal quedó actualizado.");
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const preview = value.heroImages[0];
  return (
    <form className="editor settings-editor" onSubmit={submit}>
      <div className="settings-grid">
        <div>
          <fieldset disabled={saving}>
            <legend>Mensaje de portada</legend>
            <div className="form-grid">
              <Field label="Primera línea">
                <input
                  required
                  maxLength={90}
                  value={value.heroTitle}
                  onChange={(e) => change({ heroTitle: e.target.value })}
                />
              </Field>
              <Field label="Línea destacada">
                <input
                  required
                  maxLength={100}
                  value={value.heroAccent}
                  onChange={(e) => change({ heroAccent: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Descripción">
              <textarea
                required
                rows={3}
                maxLength={260}
                value={value.heroDescription}
                onChange={(e) => change({ heroDescription: e.target.value })}
              />
            </Field>
            <div className="form-grid">
              <Field label="Botón principal">
                <input
                  required
                  maxLength={45}
                  value={value.primaryLabel}
                  onChange={(e) => change({ primaryLabel: e.target.value })}
                />
              </Field>
              <Field label="Destino">
                <input
                  required
                  maxLength={500}
                  placeholder="#catalogo"
                  value={value.primaryUrl}
                  onChange={(e) => change({ primaryUrl: e.target.value })}
                />
              </Field>
              <Field label="Botón secundario">
                <input
                  required
                  maxLength={45}
                  value={value.secondaryLabel}
                  onChange={(e) => change({ secondaryLabel: e.target.value })}
                />
              </Field>
              <Field label="Destino">
                <input
                  required
                  maxLength={500}
                  placeholder="/mapa"
                  value={value.secondaryUrl}
                  onChange={(e) => change({ secondaryUrl: e.target.value })}
                />
              </Field>
            </div>
          </fieldset>
          <Images
            images={value.heroImages}
            onChange={(heroImages) => change({ heroImages })}
            setBusy={setBusy}
            max={3}
            title="Imágenes de portada"
            help="Puedes usar una imagen fija o un carrusel de hasta 3 imágenes. Si no agregas ninguna, se conserva la imagen provisional."
          />
          <fieldset disabled={saving}>
            <legend>Presentación de imágenes</legend>
            <div className="form-grid">
              <Select
                label="Formato"
                value={value.heroMode}
                options={["Imagen fija", "Carrusel"]}
                onChange={(heroMode) =>
                  change({ heroMode: heroMode as PortalSettings["heroMode"] })
                }
              />
              <Field label="Encuadre en computadora">
                <select
                  value={value.imagePositionDesktop}
                  onChange={(e) =>
                    change({ imagePositionDesktop: e.target.value })
                  }
                >
                  {cropOptions.map(([v, l]) => (
                    <option value={v} key={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Encuadre en celular">
                <select
                  value={value.imagePositionMobile}
                  onChange={(e) =>
                    change({ imagePositionMobile: e.target.value })
                  }
                >
                  {cropOptions.map(([v, l]) => (
                    <option value={v} key={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </fieldset>
          <fieldset disabled={saving}>
            <legend>Contacto público</legend>
            <div className="form-grid">
              <Field label="Teléfono">
                <input
                  maxLength={35}
                  value={value.phone}
                  onChange={(e) => change({ phone: e.target.value })}
                />
              </Field>
              <Field label="WhatsApp">
                <input
                  maxLength={35}
                  placeholder="Ej. 4881234567"
                  value={value.whatsapp}
                  onChange={(e) => change({ whatsapp: e.target.value })}
                />
              </Field>
              <Field label="Correo">
                <input
                  type="email"
                  maxLength={160}
                  value={value.email}
                  onChange={(e) => change({ email: e.target.value })}
                />
              </Field>
              <Field label="Ubicación de oficina">
                <input
                  maxLength={240}
                  value={value.address}
                  onChange={(e) => change({ address: e.target.value })}
                />
              </Field>
            </div>
          </fieldset>
          <fieldset disabled={saving}>
            <legend>Página Nosotros</legend>
            <Field label="Título principal">
              <input required maxLength={120} value={value.aboutTitle} onChange={(e) => change({ aboutTitle: e.target.value })} />
            </Field>
            <Field label="Nuestra historia">
              <textarea required rows={6} maxLength={1200} value={value.aboutStory} onChange={(e) => change({ aboutStory: e.target.value })} />
            </Field>
            <div className="form-grid">
              <Field label="Experiencia y enfoque">
                <textarea required rows={4} maxLength={500} value={value.aboutExperience} onChange={(e) => change({ aboutExperience: e.target.value })} />
              </Field>
              <Field label="Compromiso">
                <textarea required rows={4} maxLength={500} value={value.aboutMission} onChange={(e) => change({ aboutMission: e.target.value })} />
              </Field>
            </div>
            <Field label="Horario o modalidad de atención">
              <input maxLength={120} placeholder="Ej. Lunes a viernes, 9:00 a 18:00" value={value.officeHours} onChange={(e) => change({ officeHours: e.target.value })} />
            </Field>
          </fieldset>
        </div>
        <aside className="settings-preview">
          <p className="eyebrow">VISTA PREVIA</p>
          <div className="preview-photo">
            {preview ? (
              <img
                src={preview}
                style={{ objectPosition: value.imagePositionDesktop }}
                alt="Vista previa de portada"
              />
            ) : (
              <span>Se mostrará la imagen provisional actual</span>
            )}
          </div>
          <h2>
            {value.heroTitle}
            <br />
            <em>{value.heroAccent}</em>
          </h2>
          <p>{value.heroDescription}</p>
          <span className="preview-button">{value.primaryLabel}</span>
          <small>
            {value.heroMode}
            {value.heroMode === "Carrusel"
              ? ` · ${value.heroImages.length} imágenes`
              : ""}
          </small>
        </aside>
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
      <div className="save-bar">
        <span>{dirty ? "Cambios sin guardar" : "Configuración al día"}</span>
        <button className="button" disabled={busy || saving}>
          {saving ? "Publicando…" : "Guardar y publicar"}
        </button>
      </div>
    </form>
  );
}
function TestDataTools({ onReset }: { onReset: () => Promise<void> }) {
  const [status, setStatus] = useState<ResetStatus | null>(null),
    [confirmation, setConfirmation] = useState(""),
    [lockConfirmation, setLockConfirmation] = useState(""),
    [includeCatalog, setIncludeCatalog] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const load = async () =>
    setStatus(await api<ResetStatus>("/api/admin/test-data"));
  useEffect(() => {
    void load().catch((e) => setError((e as Error).message));
  }, []);
  async function reset() {
    if (
      !confirm(
        "Esta acción eliminará definitivamente los datos seleccionados. ¿Deseas continuar?",
      )
    )
      return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await postAction("/api/admin/test-data/reset", {
        confirmation,
        includeCatalog,
      });
      setConfirmation("");
      setSuccess(
        includeCatalog
          ? "Los datos de prueba y el catálogo fueron eliminados."
          : "Los clientes, operaciones, pagos, recibos y entregas fueron eliminados.",
      );
      await Promise.all([load(), onReset()]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function lock() {
    if (
      !confirm(
        "Este bloqueo es permanente. Después no se podrá usar la limpieza automática.",
      )
    )
      return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await postAction("/api/admin/test-data/lock", {
        confirmation: lockConfirmation,
      });
      setLockConfirmation("");
      setSuccess("La operación real quedó protegida contra reinicios.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="test-data-tools">
      <div>
        <p className="eyebrow">CONTROL DE DATOS</p>
        <h2>Preparar el sistema para operación real</h2>
        <p className="muted">
          Elimina la información capturada durante las pruebas. La configuración
          visual, el logotipo y los usuarios autorizados siempre se conservan.
        </p>
      </div>
      {!status ? (
        <p>Cargando estado…</p>
      ) : status.locked ? (
        <div className="notice">
          <strong>Limpieza bloqueada permanentemente.</strong>
          <br />
          Protegida por {status.lockedBy}
          {status.lockedAt ? ` · ${status.lockedAt} UTC` : ""}.
        </div>
      ) : (
        <>
          <div className="reset-counts">
            <span>
              <strong>{status.counts.customers}</strong> clientes
            </span>
            <span>
              <strong>{status.counts.sales}</strong> operaciones
            </span>
            <span>
              <strong>{status.counts.payments}</strong> pagos
            </span>
            <span>
              <strong>{status.counts.receipts}</strong> recibos
            </span>
            <span>
              <strong>{status.counts.deliveries}</strong> entregas
              <strong>{status.counts.owners}</strong> propietarios
            </span>
            <span>
              <strong>{status.counts.cash}</strong> movimientos de caja
            </span>
            <span>
              <strong>{status.counts.catalog}</strong> registros de catálogo
            </span>
          </div>
          <div className="danger-zone">
            <h3>Eliminar datos de prueba</h3>
            <p>
              Por defecto se conservan propiedades, fraccionamientos, lotes e
              imágenes.
            </p>
            <label className="check">
              <input
                type="checkbox"
                checked={includeCatalog}
                onChange={(e) => setIncludeCatalog(e.target.checked)}
              />{" "}
              También eliminar el catálogo y sus imágenes cargadas
            </label>
            <Field label="Escribe BORRAR DATOS DE PRUEBA para confirmar">
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <button
              type="button"
              className="button danger-button"
              disabled={busy || confirmation !== "BORRAR DATOS DE PRUEBA"}
              onClick={() => void reset()}
            >
              {busy ? "Procesando…" : "Eliminar datos seleccionados"}
            </button>
          </div>
          <div className="lock-zone">
            <h3>Proteger información real</h3>
            <p>
              Cuando terminen las pruebas, desactiva esta herramienta de forma
              permanente.
            </p>
            <Field label="Escribe INICIAR OPERACION REAL">
              <input
                value={lockConfirmation}
                onChange={(e) => setLockConfirmation(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <button
              type="button"
              className="secondary"
              disabled={busy || lockConfirmation !== "INICIAR OPERACION REAL"}
              onClick={() => void lock()}
            >
              Bloquear limpieza permanentemente
            </button>
          </div>
        </>
      )}
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
    </section>
  );
}
function PropertyEditor({
  initial,
  owners,
  onDone,
}: {
  initial: Property;
  owners: Owner[];
  onDone: () => void;
}) {
  const [value, setValue] = useState(initial),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  useDirty(dirty);
  const change = (v: Partial<Property>) => {
    setValue((x) => ({ ...x, ...v }));
    setDirty(true);
  };
  const close = () => {
    if (!dirty || confirm("¿Salir sin guardar los cambios?")) onDone();
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await saveRecord("properties", value);
      setDirty(false);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit} className="editor">
      <div className="editor-top">
        <div>
          <p className="eyebrow">PROPIEDADES</p>
          <h1>{initial.revision ? "Editar propiedad" : "Nueva propiedad"}</h1>
        </div>
        <button type="button" onClick={close} className="secondary">
          Volver
        </button>
      </div>
      <fieldset disabled={saving}>
        <legend>Información comercial</legend>
        <Field label="Título">
          <input
            value={value.title}
            maxLength={160}
            required
            onChange={(e) => change({ title: e.target.value })}
          />
        </Field>
        <div className="form-grid">
          <Select
            label="Tipo"
            value={value.type}
            options={["Casa", "Local", "Terreno"]}
            onChange={(v) => change({ type: v as Property["type"] })}
          />
          <Select
            label="Operación"
            value={value.operation}
            options={["Venta", "Renta"]}
            onChange={(v) => change({ operation: v as Property["operation"] })}
          />
          <NumberField
            label="Precio (MXN)"
            value={value.price}
            onChange={(v) => change({ price: v })}
          />
          <NumberField
            label="Superficie (m²)"
            value={value.area}
            onChange={(v) => change({ area: v })}
          />
          <NumberField
            label="Recámaras"
            value={value.bedrooms}
            onChange={(v) => change({ bedrooms: v })}
          />
          <NumberField
            label="Baños"
            value={value.bathrooms}
            onChange={(v) => change({ bathrooms: v })}
          />
          <Select
            label="Disponibilidad"
            value={value.status}
            options={["Disponible", "Vendido", "Rentado"]}
            onChange={(v) => change({ status: v as Property["status"] })}
          />
          <Select
            label="Publicación"
            value={value.publication}
            options={["Borrador", "Publicado", "Oculto"]}
            onChange={(v) =>
              change({ publication: v as Property["publication"] })
            }
          />
        </div>
        <Field label="Descripción">
          <textarea
            rows={5}
            maxLength={10000}
            value={value.description}
            onChange={(e) => change({ description: e.target.value })}
          />
        </Field>
      </fieldset>
      <Images
        images={value.images}
        onChange={(v) => change({ images: v })}
        setBusy={setBusy}
      />
      <fieldset>
        <legend>Ubicación pública</legend>
        <Field label="Dirección o zona">
          <input
            maxLength={500}
            value={value.address}
            onChange={(e) => change({ address: e.target.value })}
          />
        </Field>
        <p className="muted">
          Selecciona un punto en el mapa o captura ambas coordenadas. La
          ubicación se mostrará al público.
        </p>
        <div className="form-grid">
          <Field label="Latitud">
            <input
              type="number"
              min="-90"
              max="90"
              step="any"
              value={value.lat ?? ""}
              onChange={(e) =>
                change({
                  lat: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </Field>
          <Field label="Longitud">
            <input
              type="number"
              min="-180"
              max="180"
              step="any"
              value={value.lng ?? ""}
              onChange={(e) =>
                change({
                  lng: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </Field>
        </div>
        <Suspense fallback={<p>Cargando mapa…</p>}>
          <MapView
            properties={[]}
            location={
              value.lat !== null && value.lng !== null
                ? [value.lat, value.lng]
                : null
            }
            onPick={(lat, lng) => change({ lat, lng })}
          />
        </Suspense>
        <button
          type="button"
          className="text-button"
          onClick={() => change({ lat: null, lng: null })}
        >
          Quitar ubicación del mapa
        </button>
      </fieldset>
      <Commission value={value} change={change} />
      <Ownership value={value} owners={owners} change={(v) => change(v)} />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="save-bar">
        <span>{dirty ? "Cambios sin guardar" : "Sin cambios pendientes"}</span>
        <button className="button" disabled={busy || saving}>
          {saving ? "Guardando…" : "Guardar propiedad"}
        </button>
      </div>
    </form>
  );
}
function DevelopmentEditor({
  initial,
  owners,
  onDone,
}: {
  initial: Development;
  owners: Owner[];
  onDone: () => void;
}) {
  const [value, setValue] = useState(initial),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pdf, setPdf] = useState<File | null>(null),
    [page, setPage] = useState(1);
  useDirty(dirty);
  const change = (v: Partial<Development>) => {
    setValue((x) => ({ ...x, ...v }));
    setDirty(true);
  };
  async function plan(file: File) {
    setBusy(true);
    setError("");
    try {
      let image = file;
      if (file.type === "application/pdf") {
        if (file.size > 20 * 1024 * 1024)
          throw new Error(
            "El PDF supera 20 MB. Exporta la página como imagen.",
          );
        const pdfjs = await import("pdfjs-dist");
        const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const document = await pdfjs.getDocument({
          data: await file.arrayBuffer(),
        }).promise;
        try {
          if (page < 1 || page > document.numPages)
            throw new Error(`El PDF tiene ${document.numPages} páginas.`);
          const p = await document.getPage(page),
            base = p.getViewport({ scale: 1 }),
            viewport = p.getViewport({
              scale: Math.min(2, 2400 / Math.max(base.width, base.height)),
            });
          const canvas = window.document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await p.render({
            canvas,
            canvasContext: canvas.getContext("2d")!,
            viewport,
          }).promise;
          const blob = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
              (b) =>
                b
                  ? resolve(b)
                  : reject(new Error("No se pudo convertir el plano.")),
              "image/webp",
              0.9,
            ),
          );
          image = new File([blob], "plano.webp", { type: "image/webp" });
        } finally {
          await document.loadingTask.destroy();
        }
      }
      change({ plan: await uploadImage(image) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await saveRecord("developments", value);
      setDirty(false);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="editor" onSubmit={submit}>
      <div className="editor-top">
        <h1>
          {initial.revision
            ? "Editar fraccionamiento"
            : "Nuevo fraccionamiento"}
        </h1>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            if (!dirty || confirm("¿Salir sin guardar?")) onDone();
          }}
        >
          Volver
        </button>
      </div>
      <fieldset disabled={busy}>
        <legend>Desarrollo</legend>
        <Field label="Nombre">
          <input
            required
            maxLength={160}
            value={value.title}
            onChange={(e) => change({ title: e.target.value })}
          />
        </Field>
        <Field label="Ubicación">
          <input
            value={value.address}
            maxLength={500}
            onChange={(e) => change({ address: e.target.value })}
          />
        </Field>
        <Field label="Descripción pública">
          <textarea
            rows={4}
            maxLength={10000}
            value={value.description}
            onChange={(e) => change({ description: e.target.value })}
          />
        </Field>
        <Select
          label="Publicación"
          value={value.publication}
          options={["Borrador", "Publicado", "Oculto"]}
          onChange={(v) =>
            change({ publication: v as Development["publication"] })
          }
        />
        <label className="check">
          <input
            type="checkbox"
            checked={value.collection}
            onChange={(e) => change({ collection: e.target.checked })}
          />{" "}
          Mexino administrará las mensualidades de este desarrollo
        </label>
        <p className="muted">
          Esta configuración se utilizará en la segunda etapa, al registrar
          ventas y pagos.
        </p>
      </fieldset>
      <Commission
        value={value}
        change={(v) => change(v as Partial<Development>)}
      />
      <Ownership value={value} owners={owners} change={(v) => change(v)} />
      <fieldset disabled={busy}>
        <legend>Plano de lotificación</legend>
        <p className="muted">
          Sube una imagen o selecciona una página de un PDF. Si reemplazas el
          plano, revisa la posición de todos los contornos.
        </p>
        <Field label="Seleccionar plano">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                if (f.type === "application/pdf") setPdf(f);
                else {
                  setPdf(null);
                  void plan(f);
                }
              }
              e.target.value = "";
            }}
          />
        </Field>
        {pdf && (
          <div className="inline">
            <NumberField
              label="Página del PDF"
              value={page}
              onChange={setPage}
            />
            <button
              type="button"
              className="secondary"
              onClick={() => void plan(pdf)}
            >
              Convertir y subir página
            </button>
          </div>
        )}
        {value.plan && (
          <img
            className="plan-preview"
            src={value.plan}
            alt="Vista previa del plano"
          />
        )}
      </fieldset>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="save-bar">
        <span>{busy ? "Procesando…" : dirty ? "Cambios sin guardar" : ""}</span>
        <button className="button" disabled={busy}>
          Guardar fraccionamiento
        </button>
      </div>
    </form>
  );
}
function LotsEditor({
  dev,
  lots,
  onDone,
  onReload,
}: {
  dev: Development;
  lots: Lot[];
  onDone: () => void;
  onReload: () => Promise<void>;
}) {
  const [value, setValue] = useState<Lot | null>(null),
    [drawing, setDrawing] = useState(false),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("Todos");
  useDirty(dirty);
  const change = (v: Partial<Lot>) => {
    setValue((x) => (x ? { ...x, ...v } : x));
    setDirty(true);
  };
  const choose = (l: Lot) => {
    if (dirty && !confirm("¿Descartar cambios del lote actual?")) return;
    setValue(l);
    setDirty(false);
    setDrawing(false);
    setError("");
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!value) return;
    setBusy(true);
    setError("");
    try {
      const saved = await saveRecord("lots", value);
      setValue(saved);
      setDirty(false);
      setDrawing(false);
      await onReload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const visible = lots.filter(
    (l) =>
      (status === "Todos" || l.status === status) &&
      `${l.block} ${l.number}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div>
      <div className="editor-top">
        <div>
          <p className="eyebrow">PLANO Y DISPONIBILIDAD</p>
          <h1>{dev.title}</h1>
          <p className="muted">{dev.address}</p>
        </div>
        <button
          className="secondary"
          onClick={() => {
            if (!dirty || confirm("¿Salir sin guardar?")) onDone();
          }}
        >
          Volver
        </button>
      </div>
      <div className="lot-summary">
        <button
          className={status === "Todos" ? "active" : ""}
          onClick={() => setStatus("Todos")}
        >
          <span>Total</span>
          <strong>{lots.length}</strong>
        </button>
        {(["Disponible", "Apartado", "Vendido"] as const).map((s) => (
          <button
            key={s}
            className={(status === s ? "active " : "") + s.toLowerCase()}
            onClick={() => setStatus(s)}
          >
            <span>{s}</span>
            <strong>{lots.filter((l) => l.status === s).length}</strong>
          </button>
        ))}
        <div>
          <span>Sin contorno</span>
          <strong>{lots.filter((l) => l.polygon.length < 3).length}</strong>
        </div>
      </div>
      <div className="lot-toolbar">
        <Field label="Buscar manzana o lote">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ej. manzana A, lote 12"
          />
        </Field>
        <div className="legend">
          <span className="available">Disponible</span>
          <span className="reserved">Apartado</span>
          <span className="sold">Vendido</span>
        </div>
        <button className="button" onClick={() => choose(blankLot(dev.id))}>
          + Agregar lote
        </button>
      </div>
      <div className="lot-workspace">
        <div>
          <PlanView
            plan={dev.plan}
            lots={visible.filter((l) => l.id !== value?.id || !drawing)}
            selected={value?.id}
            onSelect={choose}
            onPoint={
              drawing
                ? (p) => change({ polygon: [...(value?.polygon || []), p] })
                : undefined
            }
            draft={drawing ? value?.polygon : []}
          />
          {drawing && (
            <div className="notice">
              Marca las esquinas del lote en orden. Agrega mínimo tres puntos.{" "}
              <button
                type="button"
                className="text-button"
                onClick={() => change({ polygon: value?.polygon.slice(0, -1) })}
              >
                Deshacer punto
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setDrawing(false)}
              >
                Terminar contorno
              </button>
            </div>
          )}
          <div className="lot-list-heading">
            <strong>{visible.length} lotes mostrados</strong>
            {(query || status !== "Todos") && (
              <button
                className="text-button"
                onClick={() => {
                  setQuery("");
                  setStatus("Todos");
                }}
              >
                Mostrar todos
              </button>
            )}
          </div>
          <div className="lot-buttons">
            {visible.map((l) => (
              <button
                key={l.id}
                className={
                  (l.id === value?.id ? "selected " : "") +
                  l.status.toLowerCase()
                }
                onClick={() => choose(l)}
              >
                <span>
                  M{l.block} · L{l.number}
                </span>
                <small>
                  {l.status} · {l.area} m²
                </small>
                <strong>{money(l.price)}</strong>
              </button>
            ))}
          </div>
          {!visible.length && (
            <div className="empty">No hay lotes con este filtro.</div>
          )}
        </div>
        <aside className="lot-form">
          {value ? (
            <form onSubmit={submit}>
              <p className="eyebrow">FICHA DEL LOTE</p>
              <h2>
                {value.revision
                  ? `Manzana ${value.block} · Lote ${value.number}`
                  : "Nuevo lote"}
              </h2>
              <fieldset disabled={busy}>
                <div className="form-grid">
                  <Field label="Manzana">
                    <input
                      value={value.block}
                      required
                      maxLength={50}
                      onChange={(e) => change({ block: e.target.value })}
                    />
                  </Field>
                  <Field label="Número de lote">
                    <input
                      value={value.number}
                      required
                      maxLength={50}
                      onChange={(e) => change({ number: e.target.value })}
                    />
                  </Field>
                  <NumberField
                    label="Superficie (m²)"
                    value={value.area}
                    onChange={(v) => change({ area: v })}
                  />
                  <NumberField
                    label="Precio (MXN)"
                    value={value.price}
                    onChange={(v) => change({ price: v })}
                  />
                </div>
                <Field label="Disponibilidad">
                  <select
                    value={value.status}
                    disabled={value.revision > 0 && value.status === "Vendido"}
                    onChange={(e) =>
                      change({
                        status: e.target.value as Lot["status"],
                        ...(e.target.value !== "Vendido"
                          ? { soldBy: "", reportedBy: "", reportedDate: "" }
                          : {}),
                      })
                    }
                  >
                    <option>Disponible</option>
                    <option>Apartado</option>
                    <option>Vendido</option>
                  </select>
                </Field>
                {value.revision > 0 && value.status === "Vendido" && (
                  <p className="muted">
                    Una venta confirmada solo podrá liberarse desde el futuro
                    flujo de cancelación.
                  </p>
                )}
                {value.status === "Vendido" && (
                  <>
                    <Field label="Venta realizada por">
                      <select
                        required
                        value={value.soldBy}
                        onChange={(e) =>
                          change({ soldBy: e.target.value as Lot["soldBy"] })
                        }
                      >
                        <option value="">Seleccionar</option>
                        <option>Mexino</option>
                        <option>Tercero</option>
                      </select>
                    </Field>
                    <Field label="Quién reportó la venta">
                      <input
                        maxLength={200}
                        value={value.reportedBy}
                        onChange={(e) => change({ reportedBy: e.target.value })}
                      />
                    </Field>
                    <Field label="Fecha reportada">
                      <input
                        type="date"
                        value={value.reportedDate}
                        onChange={(e) =>
                          change({ reportedDate: e.target.value })
                        }
                      />
                    </Field>
                    {value.soldBy === "Mexino" && (
                      <p className="notice">
                        El expediente del comprador y las condiciones de pago se
                        incorporarán en el siguiente bloque.
                      </p>
                    )}
                  </>
                )}
                <Field label="Nota interna">
                  <textarea
                    rows={3}
                    maxLength={3000}
                    value={value.note}
                    onChange={(e) => change({ note: e.target.value })}
                  />
                </Field>
                <div className="lot-outline-actions">
                  <button
                    type="button"
                    className="secondary"
                    disabled={!dev.plan}
                    onClick={() => {
                      if (
                        value.polygon.length &&
                        !confirm("¿Volver a dibujar el contorno de este lote?")
                      )
                        return;
                      change({ polygon: [] });
                      setDrawing(true);
                    }}
                  >
                    {value.polygon.length >= 3
                      ? "Redibujar contorno"
                      : "Dibujar contorno"}
                  </button>
                  {value.polygon.length >= 3 && (
                    <span>Ubicado en el plano</span>
                  )}
                </div>
                <p className="muted">
                  {value.polygon.length} puntos · Comisión estimada:{" "}
                  {dev.commissionType === "Porcentaje"
                    ? `${dev.commissionValue}%`
                    : money(dev.commissionValue)}
                  .
                </p>
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                <button className="button" disabled={busy || drawing}>
                  {busy ? "Guardando…" : "Guardar lote"}
                </button>
              </fieldset>
            </form>
          ) : (
            <div className="lot-form-empty">
              <p className="eyebrow">CONTROL DE LOTES</p>
              <h2>Selecciona un lote</h2>
              <p>
                Haz clic en el plano o en la lista para consultar y actualizar
                su información.
              </p>
              <button
                className="button"
                onClick={() => choose(blankLot(dev.id))}
              >
                + Agregar lote
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
export default function Admin() {
  const accessReturn = new URLSearchParams(location.search).has("access");
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [authError, setAuthError] = useState(""),
    [data, setData] = useState<Catalog>(emptyCatalog),
    [owners, setOwners] = useState<Owner[]>([]),
    [error, setError] = useState(""),
    [section, setSection] = useState("Resumen"),
    [query, setQuery] = useState(""),
    [editor, setEditor] = useState<Property | Development | null>(null),
    [dev, setDev] = useState<Development | null>(null),
    [audit, setAudit] = useState<Audit[]>([]);
  async function reload() {
    try {
      const [catalog, business] = await Promise.all([
        api<Catalog>("/api/admin/catalog"),
        api<BusinessData>("/api/admin/business"),
      ]);
      setData(catalog);
      setOwners(business.owners);
      setError("");
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }
  useEffect(() => {
    if (!accessReturn) {
      setAuthError("Inicia sesión para continuar.");
      setLoading(false);
      return;
    }
    api<User>("/api/admin/session")
      .then((u) => {
        setUser(u);
        return reload();
      })
      .catch((e) => setAuthError((e as Error).message))
      .finally(() => setLoading(false));
  }, [accessReturn]);
  function go(s: string) {
    setSection(s);
    setQuery("");
    setEditor(null);
    setDev(null);
    if (s === "Historial")
      api<Audit[]>("/api/admin/audit")
        .then(setAudit)
        .catch((e) => setError((e as Error).message));
  }
  const done = () => {
    setEditor(null);
    setDev(null);
    void reload().catch(() => {});
  };
  if (loading)
    return (
      <div className="login-page">
        <Brand />
        <p role="status">Verificando acceso…</p>
      </div>
    );
  if (!user)
    return (
      <div className="login-page">
        <Brand />
        <div className="login-box">
          <p className="eyebrow">ESPACIO DEL EQUIPO</p>
          <h1>
            Administración
            <br />
            Casa Mexino
          </h1>
          <p>
            Accede con tu correo autorizado para administrar propiedades y
            fraccionamientos.
          </p>
          <p className="notice" role="status">
            {authError}
          </p>
          <a className="button" href="/admin/?access=1">
            Iniciar sesión
          </a>
          <a className="back" href="/">
            ← Volver al portal
          </a>
        </div>
      </div>
    );
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <Brand />
        <p className="eyebrow">COMERCIAL</p>
        <nav>
          {[
            "Resumen",
            "Propiedades",
            "Fraccionamientos",
            "Clientes",
            "Ventas",
            ...(user.role === "Administrador"
              ? ["Recibos", "Propietarios", "Caja", "Ajustes", "Historial"]
              : []),
          ].map((s) => (
            <button
              key={s}
              className={s === section ? "active" : ""}
              disabled={!!editor || !!dev}
              onClick={() => go(s)}
            >
              {s}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span>{user.role}</span>
          <small>{user.email}</small>
          <a href="/" target="_blank" rel="noreferrer">
            Ver portal ↗
          </a>
          <a href="/cdn-cgi/access/logout">Cerrar sesión</a>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <span>Espacio de trabajo / {section}</span>
          <span>Casa Mexino</span>
        </header>
        <div className="admin-content">
          {error && (
            <div className="error" role="alert">
              {error}{" "}
              <button onClick={() => void reload().catch(() => {})}>
                Reintentar
              </button>
            </div>
          )}
          {editor ? (
            section === "Propiedades" ? (
              <PropertyEditor initial={editor as Property} owners={owners} onDone={done} />
            ) : (
              <DevelopmentEditor
                initial={editor as Development}
                owners={owners}
                onDone={done}
              />
            )
          ) : dev ? (
            <LotsEditor
              dev={dev}
              lots={data.lots.filter((l) => l.developmentId === dev.id)}
              onDone={done}
              onReload={reload}
            />
          ) : section === "Caja" ? (
            <CashAdmin />
          ) : section === "Propietarios" ? (
            <OwnersAdmin />
          ) : ["Clientes", "Ventas", "Recibos"].includes(section) ? (
            <SalesAdmin
              section={section as "Clientes" | "Ventas" | "Recibos"}
              role={user.role}
              catalog={data}
            />
          ) : (
            <>
              <div className="section-top">
                <div>
                  <p className="eyebrow">ADMINISTRACIÓN</p>
                  <h1>
                    {section === "Resumen" ? "Tu inventario, al día." : section}
                  </h1>
                </div>
                {section === "Propiedades" && (
                  <button
                    className="button"
                    onClick={() => setEditor(blankProperty())}
                  >
                    + Nueva propiedad
                  </button>
                )}
                {section === "Fraccionamientos" && (
                  <button
                    className="button"
                    onClick={() => setEditor(blankDevelopment())}
                  >
                    + Nuevo fraccionamiento
                  </button>
                )}
              </div>
              {section === "Resumen" && (
                <>
                  <div className="metrics">
                    <div>
                      <span>Propiedades publicadas</span>
                      <strong>
                        {
                          data.properties.filter(
                            (p) => p.publication === "Publicado",
                          ).length
                        }
                      </strong>
                    </div>
                    <div>
                      <span>Fraccionamientos</span>
                      <strong>{data.developments.length}</strong>
                    </div>
                    <div>
                      <span>Lotes disponibles</span>
                      <strong>
                        {
                          data.lots.filter((l) => l.status === "Disponible")
                            .length
                        }
                      </strong>
                    </div>
                    <div>
                      <span>Lotes vendidos</span>
                      <strong>
                        {data.lots.filter((l) => l.status === "Vendido").length}
                      </strong>
                    </div>
                  </div>
                  <div className="start-actions">
                    <button
                      onClick={() => {
                        setSection("Propiedades");
                        setEditor(blankProperty());
                      }}
                    >
                      <span>01</span>
                      <h2>Publicar una propiedad</h2>
                      <p>Fotos, precio, características y ubicación.</p>
                    </button>
                    <button
                      onClick={() => {
                        setSection("Fraccionamientos");
                        setEditor(blankDevelopment());
                      }}
                    >
                      <span>02</span>
                      <h2>Agregar un fraccionamiento</h2>
                      <p>Plano, lotes y disponibilidad.</p>
                    </button>
                  </div>
                  <div className="notice">
                    Clientes, ventas, cobranza, recibos y entregas a
                    propietarios y caja operativa ya están disponibles.
                  </div>
                  {user.role === "Administrador" && <PendingPanel catalog={data} />}
                </>
              )}
              {section === "Ajustes" && (
                <>
                  <SettingsEditor
                    key={data.settings.revision}
                    initial={data.settings}
                    onSaved={reload}
                  />
                  <TestDataTools onReset={reload} />
                </>
              )}
              {["Propiedades", "Fraccionamientos"].includes(section) && (
                <>
                  <Field label="Buscar por nombre">
                    <input
                      className="admin-search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar…"
                    />
                  </Field>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>
                            {section === "Propiedades"
                              ? "Propiedad"
                              : "Fraccionamiento"}
                          </th>
                          <th>
                            {section === "Propiedades" ? "Precio" : "Lotes"}
                          </th>
                          <th>Titular</th>
                          <th>Publicación</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(section === "Propiedades"
                          ? data.properties
                          : data.developments
                        )
                          .filter((p) =>
                            p.title.toLowerCase().includes(query.toLowerCase()),
                          )
                          .map((p) => (
                            <tr key={p.id}>
                              <td>
                                <strong>{p.title}</strong>
                                <small>{p.address}</small>
                                {"status" in p && (
                                  <span className="pill">{p.status}</span>
                                )}
                              </td>
                              <td>
                                {"price" in p
                                  ? money(p.price)
                                  : data.lots.filter(
                                      (l) => l.developmentId === p.id,
                                    ).length}
                              </td>
                              <td>
                                <span className={`ownership-badge ${p.ownershipType === "Tercero" ? "third-party" : "own"}`}>
                                  {p.ownershipType === "Tercero"
                                    ? owners.find((owner) => owner.id === p.ownerId)?.name || "Tercero"
                                    : "Casa Mexino"}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={
                                    "pill " +
                                    (p.publication === "Publicado"
                                      ? "published"
                                      : "")
                                  }
                                >
                                  {p.publication}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="text-button"
                                  onClick={() => setEditor(p)}
                                >
                                  Editar
                                </button>
                                {section === "Fraccionamientos" && (
                                  <button
                                    className="text-button"
                                    onClick={() => setDev(p as Development)}
                                  >
                                    Plano y lotes
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {!(
                      section === "Propiedades"
                        ? data.properties
                        : data.developments
                    ).length && (
                      <div className="empty">
                        Todavía no hay registros. Agrega el primero para
                        comenzar.
                      </div>
                    )}
                  </div>
                </>
              )}
              {section === "Historial" && (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Usuario</th>
                        <th>Acción</th>
                        <th>Registro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.map((a) => (
                        <tr key={a.id}>
                          <td>{a.created_at} UTC</td>
                          <td>{a.actor}</td>
                          <td>{a.action}</td>
                          <td>
                            {[
                              ...data.properties,
                              ...data.developments,
                              ...data.lots,
                            ]
                              .find((r) => r.id === a.record_id)
                              ?.id.slice(0, 8) || a.record_id.slice(0, 8)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!audit.length && (
                    <div className="empty">No hay cambios registrados.</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
