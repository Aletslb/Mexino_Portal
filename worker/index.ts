import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Env } from "./types";
import { defaultPortalSettings } from "../src/model";
import { ownerSettlement, saleBalance } from "../src/model";
import type {
  Catalog,
  Property,
  Development,
  Lot,
  PortalSettings,
  Customer,
  Sale,
  Payment,
  OwnerDelivery,
  Receipt,
  BusinessData,
  CashMovement,
  CashClosing,
  CashData,
} from "../src/model";

const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
class Failure extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const keys = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function identity(request: Request, env: Env) {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ADMIN_EMAILS)
    throw new Failure(
      503,
      "El acceso administrativo está pendiente de activación.",
    );
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN))
    throw new Failure(503, "Configuración de acceso pendiente.");
  const token =
    request.headers.get("Cf-Access-Jwt-Assertion") ||
    request.headers
      .get("Cookie")
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("CF_Authorization="))
      ?.slice(17);
  if (!token) throw new Failure(401, "Inicia sesión para continuar.");
  const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
  if (!keys.has(issuer))
    keys.set(
      issuer,
      createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)),
    );
  let email: string;
  try {
    const { payload } = await jwtVerify(token, keys.get(issuer)!, {
      issuer,
      audience: env.ACCESS_AUD,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "exp", "email"],
    });
    email = String(payload.email).toLowerCase();
  } catch {
    throw new Failure(401, "La sesión venció. Vuelve a iniciar sesión.");
  }
  const list = (s?: string) =>
    (s || "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
  const role = list(env.ADMIN_EMAILS).includes(email)
    ? "Administrador"
    : list(env.ADVISOR_EMAILS).includes(email)
      ? "Asesor"
      : null;
  if (!role) throw new Failure(403, "Tu cuenta no tiene acceso a Mexino.");
  return { email, role };
}
type RecordKind = "properties" | "developments" | "lots";
type Row = { id: string; kind: RecordKind; data: string; revision: number };
type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  revision: number;
  created_at: string;
  updated_at: string;
};
type SaleRow = {
  id: string;
  customer_id: string;
  asset_type: Sale["assetType"];
  asset_id: string;
  status: Sale["status"];
  agreed_price: number;
  reservation_amount: number;
  down_payment: number;
  monthly_payment: number;
  term_months: number;
  payment_method: Sale["paymentMethod"];
  sale_date: string;
  next_payment_date: string;
  commission_type: Sale["commissionType"];
  commission_value: number;
  owner_name: string;
  owner_phone: string;
  cancellation_notes: string;
  cancellation_resolution: string;
  revision: number;
  created_at: string;
  updated_at: string;
};
type PaymentRow = {
  id: string;
  sale_id: string;
  amount: number;
  payment_date: string;
  payment_method: Payment["paymentMethod"];
  kind: Payment["kind"];
  reference: string;
  notes: string;
  status: Payment["status"];
  cancellation_reason: string;
  revision: number;
  created_by: string;
  cancelled_by: string;
  created_at: string;
  cancelled_at: string;
};
type DeliveryRow = {
  id: string;
  sale_id: string;
  amount: number;
  delivery_date: string;
  payment_method: OwnerDelivery["paymentMethod"];
  recipient: string;
  reference: string;
  notes: string;
  status: OwnerDelivery["status"];
  cancellation_reason: string;
  revision: number;
  created_by: string;
  cancelled_by: string;
  created_at: string;
  cancelled_at: string;
};
type ReceiptRow = {
  id: string;
  sale_id: string;
  source_type: Receipt["sourceType"];
  source_id: string;
  folio: string;
  sequence_year: number;
  sequence_number: number;
  issued_date: string;
  created_at: string;
};
type CashMovementRow = {
  id: string;
  movement_type: CashMovement["movementType"];
  category: CashMovement["category"];
  amount: number;
  movement_date: string;
  payment_method: CashMovement["paymentMethod"];
  beneficiary: string;
  reference: string;
  notes: string;
  source_type: CashMovement["sourceType"];
  source_id: string;
  status: CashMovement["status"];
  cancellation_reason: string;
  revision: number;
  created_by: string;
  cancelled_by: string;
  created_at: string;
  cancelled_at: string;
};
type CashClosingRow = {
  id: string;
  closing_date: string;
  payment_method: CashClosing["paymentMethod"];
  expected_amount: number;
  counted_amount: number;
  difference: number;
  notes: string;
  created_by: string;
  created_at: string;
};
const settingsKey = "portal/settings.json";
async function portalSettings(env: Env): Promise<PortalSettings> {
  if (!env.BUCKET) return { ...defaultPortalSettings };
  const object = await env.BUCKET.get(settingsKey);
  if (!object) return { ...defaultPortalSettings };
  try {
    return {
      ...defaultPortalSettings,
      ...(await object.json<PortalSettings>()),
    };
  } catch {
    return { ...defaultPortalSettings };
  }
}
async function catalog(env: Env): Promise<Catalog> {
  if (!env.DB)
    throw new Failure(503, "El catálogo está pendiente de conexión.");
  const [{ results }, settings] = await Promise.all([
    env.DB.prepare(
      "SELECT id,kind,data,revision FROM records ORDER BY updated_at DESC",
    ).all<Row>(),
    portalSettings(env),
  ]);
  const result: Catalog = {
    properties: [],
    developments: [],
    lots: [],
    settings,
  };
  for (const row of results)
    (result[row.kind] as unknown[]).push({
      ...JSON.parse(row.data),
      id: row.id,
      revision: row.revision,
    });
  return result;
}
const customerDto = (x: CustomerRow): Customer => ({
  id: x.id,
  name: x.name,
  phone: x.phone,
  address: x.address,
  notes: x.notes,
  revision: x.revision,
  createdAt: x.created_at,
  updatedAt: x.updated_at,
});
const saleDto = (x: SaleRow): Sale => ({
  id: x.id,
  customerId: x.customer_id,
  assetType: x.asset_type,
  assetId: x.asset_id,
  status: x.status,
  agreedPrice: x.agreed_price,
  reservationAmount: x.reservation_amount,
  downPayment: x.down_payment,
  monthlyPayment: x.monthly_payment,
  termMonths: x.term_months,
  paymentMethod: x.payment_method,
  saleDate: x.sale_date,
  nextPaymentDate: x.next_payment_date,
  commissionType: x.commission_type,
  commissionValue: x.commission_value,
  ownerName: x.owner_name,
  ownerPhone: x.owner_phone,
  cancellationNotes: x.cancellation_notes,
  cancellationResolution: x.cancellation_resolution,
  revision: x.revision,
  createdAt: x.created_at,
  updatedAt: x.updated_at,
});
const paymentDto = (x: PaymentRow): Payment => ({
  id: x.id,
  saleId: x.sale_id,
  amount: x.amount,
  paymentDate: x.payment_date,
  paymentMethod: x.payment_method,
  kind: x.kind,
  reference: x.reference,
  notes: x.notes,
  status: x.status,
  cancellationReason: x.cancellation_reason,
  revision: x.revision,
  createdBy: x.created_by,
  cancelledBy: x.cancelled_by,
  createdAt: x.created_at,
  cancelledAt: x.cancelled_at,
});
const deliveryDto = (x: DeliveryRow): OwnerDelivery => ({
  id: x.id,
  saleId: x.sale_id,
  amount: x.amount,
  deliveryDate: x.delivery_date,
  paymentMethod: x.payment_method,
  recipient: x.recipient,
  reference: x.reference,
  notes: x.notes,
  status: x.status,
  cancellationReason: x.cancellation_reason,
  revision: x.revision,
  createdBy: x.created_by,
  cancelledBy: x.cancelled_by,
  createdAt: x.created_at,
  cancelledAt: x.cancelled_at,
});
const receiptDto = (x: ReceiptRow): Receipt => ({
  id: x.id,
  saleId: x.sale_id,
  sourceType: x.source_type,
  sourceId: x.source_id,
  folio: x.folio,
  sequenceYear: x.sequence_year,
  sequenceNumber: x.sequence_number,
  issuedDate: x.issued_date,
  createdAt: x.created_at,
});
const cashMovementDto = (x: CashMovementRow): CashMovement => ({
  id: x.id,
  movementType: x.movement_type,
  category: x.category,
  amount: x.amount,
  movementDate: x.movement_date,
  paymentMethod: x.payment_method,
  beneficiary: x.beneficiary,
  reference: x.reference,
  notes: x.notes,
  sourceType: x.source_type,
  sourceId: x.source_id,
  status: x.status,
  cancellationReason: x.cancellation_reason,
  revision: x.revision,
  createdBy: x.created_by,
  cancelledBy: x.cancelled_by,
  createdAt: x.created_at,
  cancelledAt: x.cancelled_at,
});
const cashClosingDto = (x: CashClosingRow): CashClosing => ({
  id: x.id,
  closingDate: x.closing_date,
  paymentMethod: x.payment_method,
  expectedAmount: x.expected_amount,
  countedAmount: x.counted_amount,
  difference: x.difference,
  notes: x.notes,
  createdBy: x.created_by,
  createdAt: x.created_at,
});
async function business(
  env: Env,
  user: { role: string },
): Promise<BusinessData> {
  if (!env.DB)
    throw new Failure(503, "Clientes y ventas están pendientes de conexión.");
  const [customers, sales, payments, deliveries, receipts] = await Promise.all([
    env.DB.prepare(
      "SELECT id,name,phone,address,notes,revision,created_at,updated_at FROM customers ORDER BY updated_at DESC",
    ).all<CustomerRow>(),
    env.DB.prepare(
      "SELECT id,customer_id,asset_type,asset_id,status,agreed_price,reservation_amount,down_payment,monthly_payment,term_months,payment_method,sale_date,next_payment_date,commission_type,commission_value,owner_name,owner_phone,cancellation_notes,cancellation_resolution,revision,created_at,updated_at FROM sales ORDER BY updated_at DESC",
    ).all<SaleRow>(),
    env.DB.prepare(
      "SELECT id,sale_id,amount,payment_date,payment_method,kind,reference,notes,status,cancellation_reason,revision,created_by,cancelled_by,created_at,cancelled_at FROM payments ORDER BY payment_date DESC,created_at DESC",
    ).all<PaymentRow>(),
    user.role === "Administrador"
      ? env.DB.prepare(
          "SELECT id,sale_id,amount,delivery_date,payment_method,recipient,reference,notes,status,cancellation_reason,revision,created_by,cancelled_by,created_at,cancelled_at FROM owner_deliveries ORDER BY delivery_date DESC,created_at DESC",
        ).all<DeliveryRow>()
      : Promise.resolve({ results: [] } as unknown as D1Result<DeliveryRow>),
    env.DB.prepare(
      "SELECT id,sale_id,source_type,source_id,folio,sequence_year,sequence_number,issued_date,created_at FROM receipts ORDER BY sequence_year DESC,sequence_number DESC",
    ).all<ReceiptRow>(),
  ]);
  return {
    customers: customers.results.map(customerDto),
    sales: sales.results.map(saleDto),
    payments: payments.results.map(paymentDto),
    deliveries: deliveries.results.map(deliveryDto),
    receipts: receipts.results.map(receiptDto),
  };
}
export function publicCatalog(data: Catalog) {
  const developments = data.developments
    .filter((x) => x.publication === "Publicado")
    .map(({ id, title, description, address, plan }) => ({
      id,
      title,
      description,
      address,
      plan,
    }));
  return {
    properties: data.properties
      .filter((x) => x.publication === "Publicado")
      .map(
        ({
          id,
          title,
          type,
          operation,
          price,
          area,
          bedrooms,
          bathrooms,
          description,
          address,
          lat,
          lng,
          images,
          status,
        }) => ({
          id,
          title,
          type,
          operation,
          price,
          area,
          bedrooms,
          bathrooms,
          description,
          address,
          lat,
          lng,
          images,
          status,
        }),
      ),
    developments,
    lots: data.lots
      .filter((x) => developments.some((d) => d.id === x.developmentId))
      .map(
        ({
          id,
          developmentId,
          block,
          number,
          area,
          price,
          status,
          polygon,
        }) => ({
          id,
          developmentId,
          block,
          number,
          area,
          price,
          status,
          polygon,
        }),
      ),
    settings: data.settings,
  };
}
function text(v: unknown, max = 200, required = false) {
  if (typeof v !== "string" || v.length > max || (required && !v.trim()))
    throw new Failure(400, "Revisa los textos obligatorios y su longitud.");
  return v.trim();
}
function number(v: unknown, max = 1e10) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > max)
    throw new Failure(400, "Revisa los importes y superficies.");
  return v;
}
function choice<T extends string>(v: unknown, choices: T[]): T {
  if (!choices.includes(v as T)) throw new Failure(400, "Opción no válida.");
  return v as T;
}
const fileId = (s: string) => s.match(/^\/media\/([a-f0-9-]{36})$/)?.[1];
function media(v: unknown) {
  const s = text(v);
  if (s && !fileId(s))
    throw new Failure(400, "Sube el archivo desde el panel.");
  return s;
}
function localLink(v: unknown) {
  const s = text(v, 500, true);
  if (!/^(\/|#)/.test(s) || s.startsWith("//"))
    throw new Failure(
      400,
      "Los botones deben dirigir a una sección del portal.",
    );
  return s;
}
export function validateSettings(v: Record<string, unknown>): PortalSettings {
  if (!Array.isArray(v.heroImages) || v.heroImages.length > 3)
    throw new Failure(400, "La portada admite hasta 3 imágenes.");
  const revision = number(v.revision, 1e9);
  if (!Number.isInteger(revision)) throw new Failure(400, "Versión no válida.");
  return {
    revision,
    heroMode: choice(v.heroMode, ["Imagen fija", "Carrusel"]),
    heroImages: v.heroImages.map(media),
    heroTitle: text(v.heroTitle, 90, true),
    heroAccent: text(v.heroAccent, 100, true),
    heroDescription: text(v.heroDescription, 260, true),
    primaryLabel: text(v.primaryLabel, 45, true),
    primaryUrl: localLink(v.primaryUrl),
    secondaryLabel: text(v.secondaryLabel, 45, true),
    secondaryUrl: localLink(v.secondaryUrl),
    imagePositionDesktop: choice(v.imagePositionDesktop, [
      "center center",
      "center top",
      "center bottom",
      "left center",
      "right center",
    ]),
    imagePositionMobile: choice(v.imagePositionMobile, [
      "center center",
      "center top",
      "center bottom",
      "left center",
      "right center",
    ]),
    phone: text(v.phone, 35),
    whatsapp: text(v.whatsapp, 35),
    email: text(v.email, 160),
    address: text(v.address, 240),
    aboutTitle: text(v.aboutTitle, 120, true),
    aboutStory: text(v.aboutStory, 1200, true),
    aboutExperience: text(v.aboutExperience, 500, true),
    aboutMission: text(v.aboutMission, 500, true),
    officeHours: text(v.officeHours, 120),
  };
}
function commission(v: Record<string, unknown>) {
  const commissionType = choice(v.commissionType, ["Porcentaje", "Monto"]);
  return {
    commissionType,
    commissionValue: number(
      v.commissionValue,
      commissionType === "Porcentaje" ? 100 : 1e10,
    ),
  };
}
function date(v: unknown, required = false) {
  const value = text(v, 10, required);
  if (
    value &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(`${value}T00:00:00Z`)))
  )
    throw new Failure(400, "Revisa las fechas capturadas.");
  return value;
}
function identifier(v: unknown) {
  const value = text(v, 36, true);
  if (!/^[a-f0-9-]{36}$/.test(value))
    throw new Failure(400, "Identificador no válido.");
  return value;
}
async function nextReceipt(
  env: Env,
  saleId: string,
  sourceType: Receipt["sourceType"],
  sourceId: string,
  issuedDate: string,
) {
  if (!env.DB) throw new Failure(503, "Base de datos pendiente de conexión.");
  const db = env.DB;
  const year = Number(issuedDate.slice(0, 4));
  await db
    .prepare(
      "INSERT OR IGNORE INTO receipt_sequences(sequence_year,next_number) VALUES(?,1)",
    )
    .bind(year)
    .run();
  const sequence = await db
    .prepare(
      "UPDATE receipt_sequences SET next_number=next_number+1 WHERE sequence_year=? RETURNING next_number-1 AS number",
    )
    .bind(year)
    .first<{ number: number }>();
  if (!sequence)
    throw new Failure(503, "No fue posible generar el folio del recibo.");
  const receipt: Receipt = {
    id: crypto.randomUUID(),
    saleId,
    sourceType,
    sourceId,
    folio: `CM-${year}-${String(sequence.number).padStart(6, "0")}`,
    sequenceYear: year,
    sequenceNumber: sequence.number,
    issuedDate,
    createdAt: new Date().toISOString(),
  };
  return {
    receipt,
    statement: db
      .prepare(
        "INSERT INTO receipts(id,sale_id,source_type,source_id,folio,sequence_year,sequence_number,issued_date) VALUES(?,?,?,?,?,?,?,?)",
      )
      .bind(
        receipt.id,
        receipt.saleId,
        receipt.sourceType,
        receipt.sourceId,
        receipt.folio,
        receipt.sequenceYear,
        receipt.sequenceNumber,
        receipt.issuedDate,
      ),
  };
}
function cashMovementStatement(
  db: D1Database,
  input: {
    id?: string;
    movementType: CashMovement["movementType"];
    category: CashMovement["category"];
    amount: number;
    movementDate: string;
    paymentMethod: Sale["paymentMethod"];
    beneficiary?: string;
    reference?: string;
    notes?: string;
    sourceType: CashMovement["sourceType"];
    sourceId: string;
    status?: CashMovement["status"];
    createdBy: string;
  },
) {
  return db
    .prepare(
      "INSERT INTO cash_movements(id,movement_type,category,amount,movement_date,payment_method,beneficiary,reference,notes,source_type,source_id,status,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(
      input.id || crypto.randomUUID(),
      input.movementType,
      input.category,
      input.amount,
      input.movementDate,
      input.paymentMethod,
      input.beneficiary || "",
      input.reference || "",
      input.notes || "",
      input.sourceType,
      input.sourceId,
      input.status || "Aplicado",
      input.createdBy,
    );
}
async function body(request: Request) {
  const raw = await request.text();
  if (raw.length > 50000) throw new Failure(413, "Registro demasiado grande.");
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new Failure(400, "Datos no válidos.");
  }
}
export function validate(kind: string, v: Record<string, unknown>) {
  const base = { id: text(v.id, 36, true), revision: number(v.revision, 1e9) };
  if (!/^[a-f0-9-]{36}$/.test(base.id) || !Number.isInteger(base.revision))
    throw new Failure(400, "Identificador no válido.");
  if (kind === "properties") {
    if (!Array.isArray(v.images) || v.images.length > 20)
      throw new Failure(400, "Máximo 20 imágenes.");
    const coord = (x: unknown, min: number, max: number) => {
      if (x === null) return null;
      if (typeof x !== "number" || !Number.isFinite(x) || x < min || x > max)
        throw new Failure(400, "Coordenadas no válidas.");
      return x;
    };
    const lat = coord(v.lat, -90, 90),
      lng = coord(v.lng, -180, 180);
    if ((lat === null) !== (lng === null))
      throw new Failure(400, "Indica ambas coordenadas.");
    const images = v.images.map(media);
    const publication = choice(v.publication, [
      "Borrador",
      "Publicado",
      "Oculto",
    ]);
    if (publication === "Publicado" && !images.length)
      throw new Failure(400, "Agrega una imagen antes de publicar.");
    return {
      ...base,
      title: text(v.title, 160, true),
      type: choice(v.type, ["Casa", "Local", "Terreno"]),
      operation: choice(v.operation, ["Venta", "Renta"]),
      price: number(v.price),
      area: number(v.area),
      bedrooms: number(v.bedrooms, 100),
      bathrooms: number(v.bathrooms, 100),
      description: text(v.description, 10000),
      address: text(v.address, 500),
      lat,
      lng,
      images,
      status: choice(v.status, [
        "Disponible",
        "Apartado",
        "Vendido",
        "Rentado",
      ]),
      publication,
      ...commission(v),
    } as Property;
  }
  if (kind === "developments")
    return {
      ...base,
      title: text(v.title, 160, true),
      description: text(v.description, 10000),
      address: text(v.address, 500),
      plan: media(v.plan),
      publication: choice(v.publication, ["Borrador", "Publicado", "Oculto"]),
      collection: v.collection === true,
      ...commission(v),
    } as Development;
  if (kind !== "lots") throw new Failure(404, "Sección no encontrada.");
  const polygon = v.polygon;
  if (
    !Array.isArray(polygon) ||
    polygon.length > 100 ||
    (polygon.length > 0 && polygon.length < 3) ||
    polygon.some(
      (p) =>
        !Array.isArray(p) ||
        p.length !== 2 ||
        p.some(
          (n) =>
            typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 100,
        ),
    )
  )
    throw new Failure(
      400,
      "El contorno requiere al menos tres puntos dentro del plano.",
    );
  const status = choice(v.status, ["Disponible", "Apartado", "Vendido"]),
    soldBy = choice(v.soldBy, ["Mexino", "Tercero", ""]);
  if (status === "Vendido" && !soldBy)
    throw new Failure(400, "Indica quién realizó la venta.");
  const reportedDate = text(v.reportedDate, 10);
  if (reportedDate && !/^\d{4}-\d{2}-\d{2}$/.test(reportedDate))
    throw new Failure(400, "Fecha no válida.");
  return {
    ...base,
    developmentId: text(v.developmentId, 36, true),
    block: text(v.block, 50, true),
    number: text(v.number, 50, true),
    area: number(v.area),
    price: number(v.price),
    status,
    polygon,
    soldBy: status === "Vendido" ? soldBy : "",
    reportedBy: text(v.reportedBy, 200),
    reportedDate,
    note: text(v.note, 3000),
  } as Lot;
}
async function save(
  request: Request,
  env: Env,
  user: { email: string; role: string },
  kind: string,
) {
  if (!env.DB)
    throw new Failure(503, "El guardado está pendiente de conexión.");
  const raw = await request.text();
  if (raw.length > 50000) throw new Failure(413, "Registro demasiado grande.");
  let input: Record<string, unknown>;
  try {
    input = JSON.parse(raw);
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new Error();
  } catch {
    throw new Failure(400, "Datos no válidos.");
  }
  const value = validate(kind, input);
  const old = await env.DB.prepare(
    "SELECT id,kind,data,revision FROM records WHERE id=?",
  )
    .bind(value.id)
    .first<Row>();
  if (
    (old && (old.kind !== kind || old.revision !== value.revision)) ||
    (!old && value.revision !== 0)
  )
    throw new Failure(
      409,
      "Otro usuario actualizó este registro. Recarga antes de guardar.",
    );
  if (
    old &&
    JSON.parse(old.data).status === "Vendido" &&
    "status" in value &&
    value.status !== "Vendido"
  )
    throw new Failure(
      400,
      "La liberación de un lote vendido requiere el flujo de cancelación de ventas, previsto para la segunda etapa.",
    );
  let parent: string | null = null,
    lotKey: string | null = null;
  if (kind === "lots") {
    const lot = value as Lot;
    parent = lot.developmentId;
    lotKey = `${lot.block.toLowerCase()}|${lot.number.toLowerCase()}`;
    if (
      !(await env.DB.prepare(
        "SELECT id FROM records WHERE id=? AND kind='developments'",
      )
        .bind(parent)
        .first())
    )
      throw new Failure(400, "Fraccionamiento no encontrado.");
  }
  const links =
    kind === "properties"
      ? (value as Property).images
      : kind === "developments"
        ? [(value as Development).plan].filter(Boolean)
        : [];
  for (const link of links)
    if (
      !(await env.DB.prepare("SELECT id FROM uploads WHERE id=?")
        .bind(fileId(link))
        .first())
    )
      throw new Failure(400, "Archivo no encontrado. Vuelve a subirlo.");
  const data = JSON.stringify({ ...value, revision: value.revision + 1 });
  const mutation = old
    ? env.DB.prepare(
        "UPDATE records SET data=?,revision=revision+1,parent_id=?,lot_key=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=?",
      ).bind(data, parent, lotKey, value.id, value.revision)
    : env.DB.prepare(
        "INSERT INTO records(id,kind,parent_id,lot_key,data) VALUES(?,?,?,?,?)",
      ).bind(value.id, kind, parent, lotKey, data);
  try {
    const result = await env.DB.batch([
      mutation,
      env.DB.prepare(
        "INSERT INTO audit(id,record_id,actor,action,before_data,after_data) SELECT ?,?,?,?,?,? WHERE changes()=1",
      ).bind(
        crypto.randomUUID(),
        value.id,
        user.email,
        old ? "Actualizar" : "Crear",
        old?.data || null,
        data,
      ),
    ]);
    if (result[0].meta.changes !== 1)
      throw new Failure(
        409,
        "Registro actualizado por otra persona. Recarga antes de guardar.",
      );
  } catch (e) {
    if (e instanceof Failure) throw e;
    if (String(e).includes("UNIQUE"))
      throw new Failure(409, "Ya existe ese lote en esta manzana.");
    throw e;
  }
  return json({ ...value, revision: value.revision + 1 });
}
async function saveCustomer(
  request: Request,
  env: Env,
  user: { email: string; role: string },
) {
  if (!env.DB) throw new Failure(503, "Clientes pendientes de conexión.");
  const v = await body(request);
  const value = {
    id: identifier(v.id),
    revision: number(v.revision, 1e9),
    name: text(v.name, 160, true),
    phone: text(v.phone, 35, true),
    address: text(v.address, 500),
    notes: text(v.notes, 3000),
  };
  if (!Number.isInteger(value.revision))
    throw new Failure(400, "Versión no válida.");
  const old = await env.DB.prepare("SELECT revision FROM customers WHERE id=?")
    .bind(value.id)
    .first<{ revision: number }>();
  if (
    (old && old.revision !== value.revision) ||
    (!old && value.revision !== 0)
  )
    throw new Failure(
      409,
      "Otro usuario actualizó este cliente. Recarga antes de guardar.",
    );
  const mutation = old
    ? env.DB.prepare(
        "UPDATE customers SET name=?,phone=?,address=?,notes=?,revision=revision+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=?",
      ).bind(
        value.name,
        value.phone,
        value.address,
        value.notes,
        user.email,
        value.id,
        value.revision,
      )
    : env.DB.prepare(
        "INSERT INTO customers(id,name,phone,address,notes,created_by,updated_by) VALUES(?,?,?,?,?,?,?)",
      ).bind(
        value.id,
        value.name,
        value.phone,
        value.address,
        value.notes,
        user.email,
        user.email,
      );
  const result = await env.DB.batch([
    mutation,
    env.DB.prepare(
      "INSERT INTO audit(id,record_id,actor,action,after_data) SELECT ?,?,?,?,? WHERE changes()=1",
    ).bind(
      crypto.randomUUID(),
      value.id,
      user.email,
      old ? "Actualizar cliente" : "Crear cliente",
      JSON.stringify(value),
    ),
  ]);
  if (result[0].meta.changes !== 1)
    throw new Failure(409, "El cliente cambió mientras lo editabas.");
  return json({ ...value, revision: value.revision + 1 });
}
function inventoryData(
  row: { id: string; kind: RecordKind; data: string; revision: number },
  sale: Pick<Sale, "status" | "saleDate">,
  email: string,
) {
  const current = JSON.parse(row.data) as Property | Lot;
  const status = sale.status === "Apartado" ? "Apartado" : "Vendido";
  return {
    ...current,
    status,
    ...(row.kind === "lots"
      ? {
          soldBy: status === "Vendido" ? "Mexino" : "",
          reportedBy: status === "Vendido" ? email : "",
          reportedDate: status === "Vendido" ? sale.saleDate : "",
        }
      : {}),
    revision: row.revision + 1,
  };
}
async function saveSale(
  request: Request,
  env: Env,
  user: { email: string; role: string },
) {
  if (!env.DB) throw new Failure(503, "Ventas pendientes de conexión.");
  const v = await body(request);
  const commissionType = choice(v.commissionType, ["Porcentaje", "Monto"]);
  const value: Sale = {
    id: identifier(v.id),
    revision: number(v.revision, 1e9),
    customerId: identifier(v.customerId),
    assetType: choice(v.assetType, ["Propiedad", "Lote"]),
    assetId: identifier(v.assetId),
    status: choice(v.status, ["Apartado", "Activa"]),
    agreedPrice: number(v.agreedPrice),
    reservationAmount: number(v.reservationAmount),
    downPayment: number(v.downPayment),
    monthlyPayment: number(v.monthlyPayment),
    termMonths: number(v.termMonths, 1200),
    paymentMethod: choice(v.paymentMethod, [
      "Efectivo",
      "Transferencia",
      "Tarjeta",
      "Otro",
    ]),
    saleDate: date(v.saleDate, true),
    nextPaymentDate: date(v.nextPaymentDate),
    commissionType,
    commissionValue: number(
      v.commissionValue,
      commissionType === "Porcentaje" ? 100 : 1e10,
    ),
    ownerName: text(v.ownerName ?? "", 160),
    ownerPhone: text(v.ownerPhone ?? "", 35),
    cancellationNotes: "",
    cancellationResolution: "",
  };
  if (!Number.isInteger(value.revision) || !Number.isInteger(value.termMonths))
    throw new Failure(400, "Revisa la versión y el plazo.");
  if (
    value.status === "Apartado" &&
    (!value.reservationAmount || !value.nextPaymentDate)
  )
    throw new Failure(
      400,
      "El apartado requiere cantidad y fecha del siguiente pago.",
    );
  if (
    value.agreedPrice <= 0 ||
    value.reservationAmount + value.downPayment > value.agreedPrice
  )
    throw new Failure(400, "Revisa el precio pactado, apartado y enganche.");
  const financed = Math.max(
    0,
    value.agreedPrice - value.reservationAmount - value.downPayment,
  );
  if (
    financed > 0 &&
    (value.monthlyPayment <= 0 ||
      value.termMonths <= 0 ||
      value.monthlyPayment * value.termMonths + 0.01 < financed)
  )
    throw new Failure(
      400,
      "La mensualidad y el plazo deben cubrir completamente el saldo financiado.",
    );
  if (
    !(await env.DB.prepare("SELECT id FROM customers WHERE id=?")
      .bind(value.customerId)
      .first())
  )
    throw new Failure(400, "Cliente no encontrado.");
  const old = await env.DB.prepare(
    "SELECT id,asset_type,asset_id,status,revision FROM sales WHERE id=?",
  )
    .bind(value.id)
    .first<{
      id: string;
      asset_type: string;
      asset_id: string;
      status: string;
      revision: number;
    }>();
  if (
    (old && old.revision !== value.revision) ||
    (!old && value.revision !== 0)
  )
    throw new Failure(
      409,
      "Otra persona actualizó esta venta. Recarga antes de guardar.",
    );
  if (old && old.status !== "Apartado" && old.status !== "Activa")
    throw new Failure(
      400,
      "Esta operación ya no puede editarse desde el formulario.",
    );
  if (old?.status === "Activa" && value.status !== "Activa")
    throw new Failure(
      400,
      "Una venta activa solo puede cancelarse mediante el flujo administrativo.",
    );
  if (
    old &&
    (old.asset_type !== value.assetType || old.asset_id !== value.assetId)
  )
    throw new Failure(
      400,
      "El inmueble no puede cambiarse después de registrar la operación.",
    );
  const expectedKind = value.assetType === "Propiedad" ? "properties" : "lots";
  const asset = await env.DB.prepare(
    "SELECT id,kind,data,revision FROM records WHERE id=? AND kind=?",
  )
    .bind(value.assetId, expectedKind)
    .first<Row>();
  if (!asset) throw new Failure(400, "Inmueble o lote no encontrado.");
  if (
    !old &&
    !["Disponible", "Apartado"].includes(String(JSON.parse(asset.data).status))
  )
    throw new Failure(409, "El inmueble seleccionado ya no está disponible.");
  const inventory = inventoryData(asset, value, user.email),
    saleMutation = old
      ? env.DB.prepare(
          "UPDATE sales SET customer_id=?,status=?,agreed_price=?,reservation_amount=?,down_payment=?,monthly_payment=?,term_months=?,payment_method=?,sale_date=?,next_payment_date=?,commission_type=?,commission_value=?,owner_name=?,owner_phone=?,revision=revision+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=?",
        ).bind(
          value.customerId,
          value.status,
          value.agreedPrice,
          value.reservationAmount,
          value.downPayment,
          value.monthlyPayment,
          value.termMonths,
          value.paymentMethod,
          value.saleDate,
          value.nextPaymentDate,
          value.commissionType,
          value.commissionValue,
          value.ownerName,
          value.ownerPhone,
          user.email,
          value.id,
          value.revision,
        )
      : env.DB.prepare(
          "INSERT INTO sales(id,customer_id,asset_type,asset_id,status,agreed_price,reservation_amount,down_payment,monthly_payment,term_months,payment_method,sale_date,next_payment_date,commission_type,commission_value,owner_name,owner_phone,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ).bind(
          value.id,
          value.customerId,
          value.assetType,
          value.assetId,
          value.status,
          value.agreedPrice,
          value.reservationAmount,
          value.downPayment,
          value.monthlyPayment,
          value.termMonths,
          value.paymentMethod,
          value.saleDate,
          value.nextPaymentDate,
          value.commissionType,
          value.commissionValue,
          value.ownerName,
          value.ownerPhone,
          user.email,
          user.email,
        );
  const initialReceipt =
    !old && value.reservationAmount + value.downPayment > 0
      ? await nextReceipt(env, value.id, "Inicial", value.id, value.saleDate)
      : null;
  try {
    const statements = [
      saleMutation,
      env.DB.prepare(
        "UPDATE records SET data=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=?",
      ).bind(JSON.stringify(inventory), asset.id, asset.revision),
    ];
    if (initialReceipt) statements.push(initialReceipt.statement);
    statements.push(
      env.DB.prepare(
        "INSERT INTO audit(id,record_id,actor,action,after_data) SELECT ?,?,?,?,? WHERE changes()=1",
      ).bind(
        crypto.randomUUID(),
        value.id,
        user.email,
        old ? "Actualizar venta" : "Registrar venta",
        JSON.stringify(value),
      ),
    );
    const result = await env.DB.batch(statements);
    if (result[0].meta.changes !== 1 || result[1].meta.changes !== 1)
      throw new Failure(
        409,
        "El registro cambió durante la operación. Recarga e intenta nuevamente.",
      );
  } catch (e) {
    if (e instanceof Failure) throw e;
    if (String(e).includes("UNIQUE"))
      throw new Failure(409, "Este inmueble ya tiene una operación activa.");
    throw e;
  }
  return json({ ...value, revision: value.revision + 1 });
}
async function registerPayment(
  request: Request,
  env: Env,
  user: { email: string; role: string },
  saleId: string,
) {
  if (!env.DB) throw new Failure(503, "Cobranza pendiente de conexión.");
  const v = await body(request);
  const saleRow = await env.DB.prepare(
    "SELECT id,customer_id,asset_type,asset_id,status,agreed_price,reservation_amount,down_payment,monthly_payment,term_months,payment_method,sale_date,next_payment_date,commission_type,commission_value,owner_name,owner_phone,cancellation_notes,cancellation_resolution,revision,created_at,updated_at FROM sales WHERE id=?",
  )
    .bind(saleId)
    .first<SaleRow>();
  if (!saleRow) throw new Failure(404, "Venta no encontrada.");
  if (!["Apartado", "Activa"].includes(saleRow.status))
    throw new Failure(400, "Esta operación no admite nuevos pagos.");
  const sale = saleDto(saleRow),
    paymentRows = await env.DB.prepare(
      "SELECT id,sale_id,amount,payment_date,payment_method,kind,reference,notes,status,cancellation_reason,revision,created_by,cancelled_by,created_at,cancelled_at FROM payments WHERE sale_id=? AND status='Aplicado' ORDER BY payment_date,created_at",
    )
      .bind(saleId)
      .all<PaymentRow>(),
    summary = saleBalance(sale, paymentRows.results.map(paymentDto));
  const amount = Math.round(number(v.amount) * 100) / 100;
  if (amount <= 0 || amount > summary.balance + 0.001)
    throw new Failure(
      400,
      `El pago debe ser mayor a cero y no superar el saldo de ${summary.balance.toFixed(2)}.`,
    );
  const payment: Payment = {
    id: crypto.randomUUID(),
    saleId,
    amount,
    paymentDate: date(v.paymentDate, true),
    paymentMethod: choice(v.paymentMethod, [
      "Efectivo",
      "Transferencia",
      "Tarjeta",
      "Otro",
    ]),
    kind: choice(v.kind, ["Mensualidad", "Abono extraordinario"]),
    reference: text(v.reference, 120),
    notes: text(v.notes, 1000),
    status: "Aplicado",
    cancellationReason: "",
    revision: 1,
    createdBy: user.email,
    cancelledBy: "",
    createdAt: new Date().toISOString(),
    cancelledAt: "",
  };
  const liquidated = amount >= summary.balance - 0.001,
    nextStatus = liquidated ? "Liquidada" : sale.status;
  const paymentReceipt = await nextReceipt(
    env,
    saleId,
    "Pago",
    payment.id,
    payment.paymentDate,
  );
  const result = await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO payments(id,sale_id,amount,payment_date,payment_method,kind,reference,notes,status,sale_status_before,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    ).bind(
      payment.id,
      saleId,
      payment.amount,
      payment.paymentDate,
      payment.paymentMethod,
      payment.kind,
      payment.reference,
      payment.notes,
      payment.status,
      sale.status,
      user.email,
    ),
    paymentReceipt.statement,
    env.DB.prepare(
      "UPDATE sales SET status=?,revision=revision+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=?",
    ).bind(nextStatus, user.email, saleId, sale.revision),
    env.DB.prepare(
      "INSERT INTO audit(id,record_id,actor,action,after_data) VALUES(?,?,?,?,?)",
    ).bind(
      crypto.randomUUID(),
      saleId,
      user.email,
      liquidated ? "Registrar pago y liquidar venta" : "Registrar pago",
      JSON.stringify(payment),
    ),
  ]);
  if (
    result[0].meta.changes !== 1 ||
    result[1].meta.changes !== 1 ||
    result[2].meta.changes !== 1
  )
    throw new Failure(
      409,
      "La venta cambió durante el pago. Recarga antes de intentarlo nuevamente.",
    );
  return json({ ...payment, saleStatus: nextStatus }, 201);
}
async function cancelPayment(
  request: Request,
  env: Env,
  user: { email: string; role: string },
  paymentId: string,
) {
  if (user.role !== "Administrador")
    throw new Failure(403, "Solo administradores pueden cancelar pagos.");
  if (!env.DB) throw new Failure(503, "Cobranza pendiente de conexión.");
  const v = await body(request),
    revision = number(v.revision, 1e9),
    reason = text(v.reason, 1000, true);
  const payment = await env.DB.prepare(
    "SELECT id,sale_id,status,revision,sale_status_before FROM payments WHERE id=?",
  )
    .bind(paymentId)
    .first<{
      id: string;
      sale_id: string;
      status: Payment["status"];
      revision: number;
      sale_status_before: Sale["status"];
    }>();
  if (!payment) throw new Failure(404, "Pago no encontrado.");
  if (payment.status !== "Aplicado")
    throw new Failure(400, "Este pago ya fue cancelado.");
  if (payment.revision !== revision)
    throw new Failure(409, "El pago cambió. Recarga antes de continuar.");
  const sale = await env.DB.prepare(
    "SELECT status,revision FROM sales WHERE id=?",
  )
    .bind(payment.sale_id)
    .first<{ status: Sale["status"]; revision: number }>();
  if (!sale) throw new Failure(409, "No se encontró la venta relacionada.");
  const nextStatus =
      sale.status === "Liquidada" ? payment.sale_status_before : sale.status,
    result = await env.DB.batch([
      env.DB.prepare(
        "UPDATE payments SET status='Cancelado',cancellation_reason=?,cancelled_by=?,cancelled_at=CURRENT_TIMESTAMP,revision=revision+1 WHERE id=? AND revision=? AND status='Aplicado'",
      ).bind(reason, user.email, paymentId, revision),
      env.DB.prepare(
        "UPDATE sales SET status=?,revision=revision+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=?",
      ).bind(nextStatus, user.email, payment.sale_id, sale.revision),
      env.DB.prepare(
        "INSERT INTO audit(id,record_id,actor,action,after_data) VALUES(?,?,?,?,?)",
      ).bind(
        crypto.randomUUID(),
        payment.sale_id,
        user.email,
        "Cancelar pago",
        JSON.stringify({ paymentId, reason }),
      ),
    ]);
  if (result[0].meta.changes !== 1 || result[1].meta.changes !== 1)
    throw new Failure(
      409,
      "La cobranza cambió durante la cancelación. Recarga antes de continuar.",
    );
  return json({
    ok: true,
    status: "Cancelado",
    revision: revision + 1,
    saleStatus: nextStatus,
  });
}
async function registerOwnerDelivery(
  request: Request,
  env: Env,
  user: { email: string; role: string },
  saleId: string,
) {
  if (user.role !== "Administrador")
    throw new Failure(
      403,
      "Solo administradores pueden registrar entregas al propietario.",
    );
  if (!env.DB) throw new Failure(503, "Entregas pendientes de conexión.");
  const v = await body(request);
  const saleRow = await env.DB.prepare(
    "SELECT id,customer_id,asset_type,asset_id,status,agreed_price,reservation_amount,down_payment,monthly_payment,term_months,payment_method,sale_date,next_payment_date,commission_type,commission_value,owner_name,owner_phone,cancellation_notes,cancellation_resolution,revision,created_at,updated_at FROM sales WHERE id=?",
  )
    .bind(saleId)
    .first<SaleRow>();
  if (!saleRow) throw new Failure(404, "Venta no encontrada.");
  if (saleRow.status === "Cancelada")
    throw new Failure(400, "Una venta cancelada no admite nuevas entregas.");
  const [paymentRows, deliveryRows] = await Promise.all([
    env.DB.prepare(
      "SELECT id,sale_id,amount,payment_date,payment_method,kind,reference,notes,status,cancellation_reason,revision,created_by,cancelled_by,created_at,cancelled_at FROM payments WHERE sale_id=? AND status='Aplicado'",
    )
      .bind(saleId)
      .all<PaymentRow>(),
    env.DB.prepare(
      "SELECT id,sale_id,amount,delivery_date,payment_method,recipient,reference,notes,status,cancellation_reason,revision,created_by,cancelled_by,created_at,cancelled_at FROM owner_deliveries WHERE sale_id=? AND status='Aplicada'",
    )
      .bind(saleId)
      .all<DeliveryRow>(),
  ]);
  const settlement = ownerSettlement(
      saleDto(saleRow),
      paymentRows.results.map(paymentDto),
      deliveryRows.results.map(deliveryDto),
    ),
    amount = Math.round(number(v.amount) * 100) / 100;
  if (amount <= 0 || amount > settlement.pendingDelivery + 0.001)
    throw new Failure(
      400,
      `La entrega debe ser mayor a cero y no superar ${settlement.pendingDelivery.toFixed(2)} disponibles.`,
    );
  const delivery: OwnerDelivery = {
    id: crypto.randomUUID(),
    saleId,
    amount,
    deliveryDate: date(v.deliveryDate, true),
    paymentMethod: choice(v.paymentMethod, [
      "Efectivo",
      "Transferencia",
      "Tarjeta",
      "Otro",
    ]),
    recipient: text(v.recipient, 160, true),
    reference: text(v.reference, 120),
    notes: text(v.notes, 1000),
    status: "Aplicada",
    cancellationReason: "",
    revision: 1,
    createdBy: user.email,
    cancelledBy: "",
    createdAt: new Date().toISOString(),
    cancelledAt: "",
  };
  const result = await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO owner_deliveries(id,sale_id,amount,delivery_date,payment_method,recipient,reference,notes,status,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)",
    ).bind(
      delivery.id,
      saleId,
      delivery.amount,
      delivery.deliveryDate,
      delivery.paymentMethod,
      delivery.recipient,
      delivery.reference,
      delivery.notes,
      delivery.status,
      user.email,
    ),
    env.DB.prepare(
      "INSERT INTO audit(id,record_id,actor,action,after_data) VALUES(?,?,?,?,?)",
    ).bind(
      crypto.randomUUID(),
      saleId,
      user.email,
      "Registrar entrega al propietario",
      JSON.stringify(delivery),
    ),
  ]);
  if (result[0].meta.changes !== 1)
    throw new Failure(
      409,
      "No fue posible registrar la entrega. Recarga e intenta nuevamente.",
    );
  return json(delivery, 201);
}
async function cancelOwnerDelivery(
  request: Request,
  env: Env,
  user: { email: string; role: string },
  deliveryId: string,
) {
  if (user.role !== "Administrador")
    throw new Failure(403, "Solo administradores pueden cancelar entregas.");
  if (!env.DB) throw new Failure(503, "Entregas pendientes de conexión.");
  const v = await body(request),
    revision = number(v.revision, 1e9),
    reason = text(v.reason, 1000, true);
  const delivery = await env.DB.prepare(
    "SELECT id,sale_id,status,revision FROM owner_deliveries WHERE id=?",
  )
    .bind(deliveryId)
    .first<{
      id: string;
      sale_id: string;
      status: OwnerDelivery["status"];
      revision: number;
    }>();
  if (!delivery) throw new Failure(404, "Entrega no encontrada.");
  if (delivery.status !== "Aplicada")
    throw new Failure(400, "Esta entrega ya fue cancelada.");
  if (delivery.revision !== revision)
    throw new Failure(409, "La entrega cambió. Recarga antes de continuar.");
  const result = await env.DB.batch([
    env.DB.prepare(
      "UPDATE owner_deliveries SET status='Cancelada',cancellation_reason=?,cancelled_by=?,cancelled_at=CURRENT_TIMESTAMP,revision=revision+1 WHERE id=? AND revision=? AND status='Aplicada'",
    ).bind(reason, user.email, deliveryId, revision),
    env.DB.prepare(
      "INSERT INTO audit(id,record_id,actor,action,after_data) VALUES(?,?,?,?,?)",
    ).bind(
      crypto.randomUUID(),
      delivery.sale_id,
      user.email,
      "Cancelar entrega al propietario",
      JSON.stringify({ deliveryId, reason }),
    ),
  ]);
  if (result[0].meta.changes !== 1)
    throw new Failure(409, "La entrega cambió durante la cancelación.");
  return json({ ok: true, status: "Cancelada", revision: revision + 1 });
}
async function cancelSale(
  request: Request,
  env: Env,
  user: { email: string; role: string },
  id: string,
  final: boolean,
) {
  if (user.role !== "Administrador")
    throw new Failure(
      403,
      "Solo administradores pueden gestionar cancelaciones.",
    );
  if (!env.DB) throw new Failure(503, "Ventas pendientes de conexión.");
  const v = await body(request),
    revision = number(v.revision, 1e9),
    notes = text(v.notes, 3000, true);
  const sale = await env.DB.prepare(
    "SELECT id,asset_type,asset_id,status,revision FROM sales WHERE id=?",
  )
    .bind(id)
    .first<{
      id: string;
      asset_type: Sale["assetType"];
      asset_id: string;
      status: Sale["status"];
      revision: number;
    }>();
  if (!sale || sale.revision !== revision)
    throw new Failure(409, "La venta cambió. Recarga antes de continuar.");
  if (final && sale.status !== "Cancelacion en revision")
    throw new Failure(400, "Primero registra la revisión de la cancelación.");
  if (!final && !["Apartado", "Activa"].includes(sale.status))
    throw new Failure(400, "Esta venta no admite una nueva revisión.");
  const next = final ? "Cancelada" : "Cancelacion en revision",
    queries = [
      env.DB.prepare(
        `UPDATE sales SET status=?,${final ? "cancellation_resolution" : "cancellation_notes"}=?,revision=revision+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=?`,
      ).bind(next, notes, user.email, id, revision),
    ];
  if (final) {
    const asset = await env.DB.prepare(
      "SELECT id,kind,data,revision FROM records WHERE id=?",
    )
      .bind(sale.asset_id)
      .first<Row>();
    if (!asset)
      throw new Failure(409, "No se encontró el inmueble relacionado.");
    const current = JSON.parse(asset.data) as Property | Lot,
      inventory = {
        ...current,
        status: "Disponible",
        ...(asset.kind === "lots"
          ? { soldBy: "", reportedBy: "", reportedDate: "" }
          : {}),
        revision: asset.revision + 1,
      };
    queries.push(
      env.DB.prepare(
        "UPDATE records SET data=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=?",
      ).bind(JSON.stringify(inventory), asset.id, asset.revision),
    );
  }
  queries.push(
    env.DB.prepare(
      "INSERT INTO audit(id,record_id,actor,action,after_data) SELECT ?,?,?,?,? WHERE changes()=1",
    ).bind(
      crypto.randomUUID(),
      id,
      user.email,
      final ? "Cancelar venta" : "Iniciar revisión de cancelación",
      notes,
    ),
  );
  const result = await env.DB.batch(queries);
  if (result.some((x) => x.meta.changes !== 1))
    throw new Failure(
      409,
      "La operación cambió durante la cancelación. Recarga e intenta nuevamente.",
    );
  return json({ ok: true, status: next, revision: revision + 1 });
}
async function cashData(env: Env, user: { role: string }): Promise<CashData> {
  if (user.role !== "Administrador")
    throw new Failure(403, "Solo administradores pueden consultar caja.");
  if (!env.DB) throw new Failure(503, "Caja pendiente de conexión.");
  const [movements, closings] = await Promise.all([
    env.DB.prepare(
      "SELECT id,movement_type,category,amount,movement_date,payment_method,beneficiary,reference,notes,source_type,source_id,status,cancellation_reason,revision,created_by,cancelled_by,created_at,cancelled_at FROM cash_movements ORDER BY movement_date DESC,created_at DESC",
    ).all<CashMovementRow>(),
    env.DB.prepare(
      "SELECT id,closing_date,payment_method,expected_amount,counted_amount,difference,notes,created_by,created_at FROM cash_closings ORDER BY closing_date DESC,created_at DESC",
    ).all<CashClosingRow>(),
  ]);
  return {
    movements: movements.results.map(cashMovementDto),
    closings: closings.results.map(cashClosingDto),
  };
}
async function registerCashMovement(
  request: Request,
  env: Env,
  user: { email: string; role: string },
) {
  if (user.role !== "Administrador")
    throw new Failure(
      403,
      "Solo administradores pueden registrar movimientos de caja.",
    );
  if (!env.DB) throw new Failure(503, "Caja pendiente de conexión.");
  const v = await body(request),
    movementType = choice(v.movementType, ["Ingreso", "Gasto"]),
    allowed =
      movementType === "Ingreso"
        ? ["Comisión", "Otro"]
        : ["Nómina", "Honorarios", "Gasto operativo", "Otro"],
    category = choice(v.category, allowed) as CashMovement["category"],
    amount = Math.round(number(v.amount) * 100) / 100,
    beneficiary = text(v.beneficiary, 160),
    movementDate = date(v.movementDate, true);
  if (amount <= 0) throw new Failure(400, "La cantidad debe ser mayor a cero.");
  if (["Nómina", "Honorarios"].includes(category) && !beneficiary)
    throw new Failure(400, "Indica a quién se realizó el pago.");
  const movement: CashMovement = {
    id: crypto.randomUUID(),
    movementType,
    category,
    amount,
    movementDate,
    paymentMethod: choice(v.paymentMethod, [
      "Efectivo",
      "Transferencia",
      "Tarjeta",
      "Otro",
    ]),
    beneficiary,
    reference: text(v.reference, 120),
    notes: text(v.notes, 1000),
    sourceType: "Manual",
    sourceId: crypto.randomUUID(),
    status: "Aplicado",
    cancellationReason: "",
    revision: 1,
    createdBy: user.email,
    cancelledBy: "",
    createdAt: new Date().toISOString(),
    cancelledAt: "",
  };
  await env.DB.batch([
    cashMovementStatement(env.DB, { ...movement, sourceId: movement.sourceId }),
    env.DB.prepare(
      "INSERT INTO audit(id,record_id,actor,action,after_data) VALUES(?,?,?,?,?)",
    ).bind(
      crypto.randomUUID(),
      movement.id,
      user.email,
      `Registrar ${movement.movementType.toLowerCase()} de caja`,
      JSON.stringify(movement),
    ),
  ]);
  return json(movement, 201);
}
async function cancelCashMovement(
  request: Request,
  env: Env,
  user: { email: string; role: string },
  id: string,
) {
  if (user.role !== "Administrador")
    throw new Failure(
      403,
      "Solo administradores pueden cancelar movimientos de caja.",
    );
  if (!env.DB) throw new Failure(503, "Caja pendiente de conexión.");
  const v = await body(request),
    revision = number(v.revision, 1e9),
    reason = text(v.reason, 1000, true),
    row = await env.DB.prepare(
      "SELECT source_type,status,revision FROM cash_movements WHERE id=?",
    )
      .bind(id)
      .first<{
        source_type: CashMovement["sourceType"];
        status: CashMovement["status"];
        revision: number;
      }>();
  if (!row) throw new Failure(404, "Movimiento no encontrado.");
  if (row.source_type !== "Manual")
    throw new Failure(
      400,
      "Cancela este movimiento desde su operación de origen.",
    );
  if (row.status !== "Aplicado")
    throw new Failure(400, "Este movimiento ya fue cancelado.");
  if (row.revision !== revision)
    throw new Failure(409, "El movimiento cambió. Recarga antes de continuar.");
  const result = await env.DB.batch([
    env.DB.prepare(
      "UPDATE cash_movements SET status='Cancelado',cancellation_reason=?,cancelled_by=?,cancelled_at=CURRENT_TIMESTAMP,revision=revision+1 WHERE id=? AND revision=? AND status='Aplicado'",
    ).bind(reason, user.email, id, revision),
    env.DB.prepare(
      "INSERT INTO audit(id,record_id,actor,action,after_data) VALUES(?,?,?,?,?)",
    ).bind(
      crypto.randomUUID(),
      id,
      user.email,
      "Cancelar movimiento de caja",
      JSON.stringify({ reason }),
    ),
  ]);
  if (result[0].meta.changes !== 1)
    throw new Failure(409, "El movimiento cambió durante la cancelación.");
  return json({ ok: true, status: "Cancelado", revision: revision + 1 });
}
async function registerCashClosing(
  request: Request,
  env: Env,
  user: { email: string; role: string },
) {
  if (user.role !== "Administrador")
    throw new Failure(
      403,
      "Solo administradores pueden realizar cierres de caja.",
    );
  if (!env.DB) throw new Failure(503, "Caja pendiente de conexión.");
  const v = await body(request),
    closingDate = date(v.closingDate, true),
    paymentMethod = choice(v.paymentMethod, [
      "Efectivo",
      "Transferencia",
      "Tarjeta",
      "Otro",
    ]),
    countedAmount = Math.round(number(v.countedAmount) * 100) / 100;
  if (countedAmount < 0)
    throw new Failure(400, "El importe contado no puede ser negativo.");
  const balance = await env.DB.prepare(
      "SELECT COALESCE(SUM(CASE WHEN movement_type='Ingreso' THEN amount ELSE -amount END),0) amount FROM cash_movements WHERE status='Aplicado' AND payment_method=? AND movement_date<=?",
    )
      .bind(paymentMethod, closingDate)
      .first<{ amount: number }>(),
    expectedAmount = Math.round((balance?.amount || 0) * 100) / 100,
    difference = Math.round((countedAmount - expectedAmount) * 100) / 100,
    closing: CashClosing = {
      id: crypto.randomUUID(),
      closingDate,
      paymentMethod,
      expectedAmount,
      countedAmount,
      difference,
      notes: text(v.notes, 1000),
      createdBy: user.email,
      createdAt: new Date().toISOString(),
    };
  try {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO cash_closings(id,closing_date,payment_method,expected_amount,counted_amount,difference,notes,created_by) VALUES(?,?,?,?,?,?,?,?)",
      ).bind(
        closing.id,
        closing.closingDate,
        closing.paymentMethod,
        closing.expectedAmount,
        closing.countedAmount,
        closing.difference,
        closing.notes,
        user.email,
      ),
      env.DB.prepare(
        "INSERT INTO audit(id,record_id,actor,action,after_data) VALUES(?,?,?,?,?)",
      ).bind(
        crypto.randomUUID(),
        closing.id,
        user.email,
        "Realizar cierre de caja",
        JSON.stringify(closing),
      ),
    ]);
  } catch (e) {
    if (String(e).includes("UNIQUE"))
      throw new Failure(
        409,
        "Ya existe un cierre para esa fecha y forma de pago.",
      );
    throw e;
  }
  return json(closing, 201);
}
async function resetStatus(env: Env, user: { role: string }) {
  if (user.role !== "Administrador")
    throw new Failure(403, "Solo administradores.");
  if (!env.DB) throw new Failure(503, "Base de datos pendiente de conexión.");
  const [
    control,
    customers,
    sales,
    payments,
    receipts,
    deliveries,
    cash,
    records,
  ] = await Promise.all([
    env.DB.prepare(
      "SELECT reset_locked,locked_at,locked_by FROM test_data_control WHERE id=1",
    ).first<{ reset_locked: number; locked_at: string; locked_by: string }>(),
    env.DB.prepare("SELECT COUNT(*) count FROM customers").first<{
      count: number;
    }>(),
    env.DB.prepare("SELECT COUNT(*) count FROM sales").first<{
      count: number;
    }>(),
    env.DB.prepare("SELECT COUNT(*) count FROM payments").first<{
      count: number;
    }>(),
    env.DB.prepare("SELECT COUNT(*) count FROM receipts").first<{
      count: number;
    }>(),
    env.DB.prepare("SELECT COUNT(*) count FROM owner_deliveries").first<{
      count: number;
    }>(),
    env.DB.prepare("SELECT COUNT(*) count FROM cash_movements").first<{
      count: number;
    }>(),
    env.DB.prepare("SELECT COUNT(*) count FROM records").first<{
      count: number;
    }>(),
  ]);
  return {
    locked: !!control?.reset_locked,
    lockedAt: control?.locked_at || "",
    lockedBy: control?.locked_by || "",
    counts: {
      customers: customers?.count || 0,
      sales: sales?.count || 0,
      payments: payments?.count || 0,
      receipts: receipts?.count || 0,
      deliveries: deliveries?.count || 0,
      cash: cash?.count || 0,
      catalog: records?.count || 0,
    },
  };
}
async function resetTestData(
  request: Request,
  env: Env,
  user: { email: string; role: string },
) {
  if (user.role !== "Administrador")
    throw new Failure(
      403,
      "Solo administradores pueden eliminar datos de prueba.",
    );
  if (!env.DB) throw new Failure(503, "Base de datos pendiente de conexión.");
  const v = await body(request),
    phrase = text(v.confirmation, 60, true),
    includeCatalog = v.includeCatalog === true;
  if (phrase !== "BORRAR DATOS DE PRUEBA")
    throw new Failure(400, "Escribe exactamente BORRAR DATOS DE PRUEBA.");
  const control = await env.DB.prepare(
    "SELECT reset_locked FROM test_data_control WHERE id=1",
  ).first<{ reset_locked: number }>();
  if (control?.reset_locked)
    throw new Failure(
      423,
      "La limpieza fue bloqueada para operación real y no puede reactivarse.",
    );
  const sales = await env.DB.prepare(
    "SELECT DISTINCT asset_id FROM sales",
  ).all<{ asset_id: string }>();
  const statements = [];
  if (!includeCatalog) {
    for (const sale of sales.results) {
      const row = await env.DB.prepare(
        "SELECT id,kind,data,revision FROM records WHERE id=?",
      )
        .bind(sale.asset_id)
        .first<Row>();
      if (!row) continue;
      const current = JSON.parse(row.data) as Property | Lot;
      const restored = {
        ...current,
        status: "Disponible",
        ...(row.kind === "lots"
          ? { soldBy: "", reportedBy: "", reportedDate: "" }
          : {}),
        revision: row.revision + 1,
      };
      statements.push(
        env.DB.prepare(
          "UPDATE records SET data=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ).bind(JSON.stringify(restored), row.id),
      );
    }
  }
  statements.push(
    env.DB.prepare("DELETE FROM cash_closings"),
    env.DB.prepare("DELETE FROM cash_movements"),
    env.DB.prepare("DELETE FROM owner_deliveries"),
    env.DB.prepare("DELETE FROM receipts"),
    env.DB.prepare("DELETE FROM payments"),
    env.DB.prepare("DELETE FROM sales"),
    env.DB.prepare("DELETE FROM customers"),
    env.DB.prepare("DELETE FROM receipt_sequences"),
    env.DB.prepare("DELETE FROM audit"),
  );
  const uploadedObjects = includeCatalog
    ? await env.DB.prepare("SELECT id FROM uploads").all<{ id: string }>()
    : { results: [] as { id: string }[] };
  if (includeCatalog)
    statements.push(
      env.DB.prepare("DELETE FROM records"),
      env.DB.prepare("DELETE FROM uploads"),
    );
  await env.DB.batch(statements);
  if (includeCatalog && env.BUCKET && uploadedObjects.results.length)
    await env.BUCKET.delete(uploadedObjects.results.map((item) => item.id));
  return json({ ok: true, includeCatalog });
}
async function lockTestReset(
  request: Request,
  env: Env,
  user: { email: string; role: string },
) {
  if (user.role !== "Administrador")
    throw new Failure(403, "Solo administradores.");
  if (!env.DB) throw new Failure(503, "Base de datos pendiente de conexión.");
  const v = await body(request);
  if (text(v.confirmation, 40, true) !== "INICIAR OPERACION REAL")
    throw new Failure(400, "Escribe exactamente INICIAR OPERACION REAL.");
  await env.DB.prepare(
    "UPDATE test_data_control SET reset_locked=1,locked_at=CURRENT_TIMESTAMP,locked_by=? WHERE id=1 AND reset_locked=0",
  )
    .bind(user.email)
    .run();
  return json({ ok: true, locked: true });
}
async function saveSettings(
  request: Request,
  env: Env,
  user: { email: string; role: string },
) {
  if (user.role !== "Administrador")
    throw new Failure(403, "Solo administradores pueden cambiar el portal.");
  if (!env.DB || !env.BUCKET)
    throw new Failure(
      503,
      "Los ajustes del portal están pendientes de conexión.",
    );
  const raw = await request.text();
  if (raw.length > 50000)
    throw new Failure(413, "Configuración demasiado grande.");
  let input: Record<string, unknown>;
  try {
    input = JSON.parse(raw);
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new Error();
  } catch {
    throw new Failure(400, "Datos no válidos.");
  }
  const value = validateSettings(input),
    old = await portalSettings(env);
  if (value.revision !== old.revision)
    throw new Failure(
      409,
      "Otro usuario actualizó el portal. Recarga antes de guardar.",
    );
  for (const link of value.heroImages)
    if (
      !(await env.DB.prepare("SELECT id FROM uploads WHERE id=?")
        .bind(fileId(link))
        .first())
    )
      throw new Failure(
        400,
        "Una imagen de portada ya no está disponible. Vuelve a subirla.",
      );
  const saved = { ...value, revision: value.revision + 1 },
    before = old.revision ? JSON.stringify(old) : null,
    after = JSON.stringify(saved);
  await env.BUCKET.put(settingsKey, after, {
    httpMetadata: { contentType: "application/json" },
  });
  try {
    await env.DB.prepare(
      "INSERT INTO audit(id,record_id,actor,action,before_data,after_data) VALUES(?,?,?,?,?,?)",
    )
      .bind(
        crypto.randomUUID(),
        "portal-settings",
        user.email,
        old.revision ? "Actualizar portal" : "Configurar portal",
        before,
        after,
      )
      .run();
  } catch (e) {
    console.error(
      "Portal settings audit failed",
      e instanceof Error ? e.message : "unknown",
    );
  }
  return json(saved);
}
async function upload(request: Request, env: Env, email: string) {
  if (!env.DB || !env.BUCKET)
    throw new Failure(503, "La carga de imágenes está pendiente de conexión.");
  const reader = request.body?.getReader();
  if (!reader) throw new Failure(400, "Archivo vacío.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 8 * 1024 * 1024) {
      await reader.cancel();
      throw new Failure(413, "Máximo 8 MB por imagen.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const mime =
    bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      ? "image/jpeg"
      : bytes[0] === 137 &&
          bytes[1] === 80 &&
          bytes[2] === 78 &&
          bytes[3] === 71
        ? "image/png"
        : new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
            new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
          ? "image/webp"
          : null;
  if (!mime) throw new Failure(400, "Solo imágenes JPG, PNG o WebP.");
  const id = crypto.randomUUID();
  await env.BUCKET.put(id, bytes, { httpMetadata: { contentType: mime } });
  try {
    await env.DB.prepare("INSERT INTO uploads(id,mime,actor) VALUES(?,?,?)")
      .bind(id, mime, email)
      .run();
  } catch (e) {
    await env.BUCKET.delete(id);
    throw e;
  }
  return json({ url: `/media/${id}` }, 201);
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url),
      path = url.pathname;
    try {
      if (path === "/api/catalog" && request.method === "GET")
        return json(publicCatalog(await catalog(env)));
      if (path.startsWith("/media/")) {
        if (!["GET", "HEAD"].includes(request.method))
          throw new Failure(405, "Método no permitido.");
        if (!env.BUCKET) throw new Failure(404, "Imagen no encontrada.");
        const all = publicCatalog(await catalog(env));
        const allowed =
          all.properties.some((p) => p.images.includes(path)) ||
          all.developments.some((d) => d.plan === path) ||
          all.settings.heroImages.includes(path);
        if (!allowed) await identity(request, env);
        const object = await env.BUCKET.get(path.slice(7));
        if (!object) throw new Failure(404, "Imagen no encontrada.");
        return new Response(request.method === "HEAD" ? null : object.body, {
          headers: {
            "Content-Type":
              object.httpMetadata?.contentType || "application/octet-stream",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
          },
        });
      }
      if (path.startsWith("/api/admin/")) {
        const user = await identity(request, env);
        if (
          request.method !== "GET" &&
          request.headers.get("Origin") !== url.origin
        )
          throw new Failure(403, "Origen no permitido.");
        if (path === "/api/admin/session" && request.method === "GET")
          return json(user);
        if (path === "/api/admin/catalog" && request.method === "GET")
          return json(await catalog(env));
        if (path === "/api/admin/business" && request.method === "GET")
          return json(await business(env, user));
        if (path === "/api/admin/cash" && request.method === "GET")
          return json(await cashData(env, user));
        if (path === "/api/admin/cash/movements" && request.method === "POST")
          return await registerCashMovement(request, env, user);
        if (path === "/api/admin/cash/closings" && request.method === "POST")
          return await registerCashClosing(request, env, user);
        const cashCancellation = path.match(
          /^\/api\/admin\/cash\/movements\/([a-f0-9-]{36})\/cancel$/,
        );
        if (cashCancellation && request.method === "POST")
          return await cancelCashMovement(
            request,
            env,
            user,
            cashCancellation[1],
          );
        if (path === "/api/admin/test-data" && request.method === "GET")
          return json(await resetStatus(env, user));
        if (path === "/api/admin/test-data/reset" && request.method === "POST")
          return await resetTestData(request, env, user);
        if (path === "/api/admin/test-data/lock" && request.method === "POST")
          return await lockTestReset(request, env, user);
        if (path === "/api/admin/audit" && request.method === "GET") {
          if (user.role !== "Administrador")
            throw new Failure(403, "Solo administradores.");
          if (!env.DB)
            throw new Failure(503, "Historial pendiente de conexión.");
          return json(
            (
              await env.DB.prepare(
                "SELECT id,record_id,actor,action,created_at FROM audit ORDER BY created_at DESC LIMIT 100",
              ).all()
            ).results,
          );
        }
        if (path === "/api/admin/uploads" && request.method === "POST")
          return await upload(request, env, user.email);
        if (path === "/api/admin/settings" && request.method === "PUT")
          return await saveSettings(request, env, user);
        if (path === "/api/admin/customers" && request.method === "PUT")
          return await saveCustomer(request, env, user);
        if (path === "/api/admin/sales" && request.method === "PUT")
          return await saveSale(request, env, user);
        const paymentRegistration = path.match(
          /^\/api\/admin\/sales\/([a-f0-9-]{36})\/payments$/,
        );
        if (paymentRegistration && request.method === "POST")
          return await registerPayment(
            request,
            env,
            user,
            paymentRegistration[1],
          );
        const paymentCancellation = path.match(
          /^\/api\/admin\/payments\/([a-f0-9-]{36})\/cancel$/,
        );
        if (paymentCancellation && request.method === "POST")
          return await cancelPayment(
            request,
            env,
            user,
            paymentCancellation[1],
          );
        const deliveryRegistration = path.match(
          /^\/api\/admin\/sales\/([a-f0-9-]{36})\/deliveries$/,
        );
        if (deliveryRegistration && request.method === "POST")
          return await registerOwnerDelivery(
            request,
            env,
            user,
            deliveryRegistration[1],
          );
        const deliveryCancellation = path.match(
          /^\/api\/admin\/deliveries\/([a-f0-9-]{36})\/cancel$/,
        );
        if (deliveryCancellation && request.method === "POST")
          return await cancelOwnerDelivery(
            request,
            env,
            user,
            deliveryCancellation[1],
          );
        const cancellation = path.match(
          /^\/api\/admin\/sales\/([a-f0-9-]{36})\/(review-cancellation|cancel)$/,
        );
        if (cancellation && request.method === "POST")
          return await cancelSale(
            request,
            env,
            user,
            cancellation[1],
            cancellation[2] === "cancel",
          );
        if (
          request.method === "PUT" &&
          /^\/api\/admin\/(properties|developments|lots)$/.test(path)
        )
          return await save(request, env, user, path.split("/").pop()!);
        throw new Failure(404, "Acción no encontrada.");
      }
      if (path.startsWith("/api/"))
        throw new Failure(404, "Ruta no encontrada.");
      return env.ASSETS.fetch(request);
    } catch (e) {
      if (e instanceof Failure) return json({ error: e.message }, e.status);
      console.error(
        "Mexino request failed",
        e instanceof Error ? e.message : "unknown",
      );
      return json(
        {
          error:
            "No se pudo completar la operación. Intenta nuevamente; tus cambios no se han descartado.",
        },
        500,
      );
    }
  },
};
