import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import service, {
  validate,
  validateSettings,
  publicCatalog,
} from "../worker/index";
import {
  blankProperty,
  blankDevelopment,
  blankLot,
  defaultPortalSettings,
  ownerSettlement,
  saleBalance,
} from "../src/model";
import type { BusinessData } from "../src/model";
import type { Env } from "../worker/types";

const mf = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    script: 'export default {fetch(){return new Response("ok")}}',
    compatibilityDate: "2026-09-09",
    d1Databases: ["DB"],
    r2Buckets: ["BUCKET"],
  }),
);
const db = await mf.getD1Database("DB"),
  bucket = await mf.getR2Bucket("BUCKET");
for (const migration of [
  "0001_catalog.sql",
  "0002_customers_sales.sql",
  "0003_payments.sql",
  "0004_owner_deliveries.sql",
  "0005_receipts_and_reset.sql",
  "0006_cash_control.sql",
]) {
  const sql = await readFile(
    new URL(`../migrations/${migration}`, import.meta.url),
    "utf8",
  );
  for (const statement of sql.split(";").filter((s) => s.trim()))
    await db.prepare(statement).run();
}
const { privateKey, publicKey } = await generateKeyPair("RS256"),
  jwk = await exportJWK(publicKey);
jwk.kid = "test-key";
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) =>
  String(input) === "https://test.cloudflareaccess.com/cdn-cgi/access/certs"
    ? Response.json({ keys: [jwk] })
    : originalFetch(input, init);
const env = {
  DB: db,
  BUCKET: bucket,
  ASSETS: { fetch: async () => new Response("SPA") },
  ACCESS_TEAM_DOMAIN: "test.cloudflareaccess.com",
  ACCESS_AUD: "mexino-test",
  ADMIN_EMAILS: "admin@example.test",
  ADVISOR_EMAILS: "advisor@example.test",
} as unknown as Env;
async function token(
  email = "admin@example.test",
  aud = "mexino-test",
  expired = false,
) {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setSubject("test-user")
    .setIssuer("https://test.cloudflareaccess.com")
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime(expired ? Math.floor(Date.now() / 1000) - 60 : "5m")
    .sign(privateKey);
}
const auth = await token();
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  jwt: string | null = auth,
  origin = "https://mexino.example",
) {
  const headers: Record<string, string> = { Origin: origin };
  if (jwt) headers["Cf-Access-Jwt-Assertion"] = jwt;
  if (body) headers["Content-Type"] = "application/json";
  return service.fetch(
    new Request(`https://mexino.example${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }),
    env,
  );
}
after(async () => {
  globalThis.fetch = originalFetch;
  await mf.dispose();
});

test("anonymous writes and forged identities are rejected", async () => {
  assert.equal(
    (await request("/api/admin/properties", "PUT", blankProperty(), null))
      .status,
    401,
  );
  assert.equal(
    (await request("/api/admin/session", "GET", undefined, "forged")).status,
    401,
  );
  assert.equal(
    (
      await request(
        "/api/admin/session",
        "GET",
        undefined,
        await token("stranger@example.test"),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/api/admin/session",
        "GET",
        undefined,
        await token("admin@example.test", "wrong"),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await request(
        "/api/admin/session",
        "GET",
        undefined,
        await token("admin@example.test", "mexino-test", true),
      )
    ).status,
    401,
  );
});

test("authenticated login bridge returns to the admin panel", async () => {
  const response = await request("/api/admin/me");
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get("location")!);
  assert.equal(location.pathname, "/admin/");
  assert.equal(location.searchParams.get("access"), "1");
});
test("missing configuration fails closed; cross-origin mutation is rejected", async () => {
  assert.equal(
    (
      await service.fetch(
        new Request("https://mexino.example/api/admin/session"),
        { ASSETS: env.ASSETS },
      )
    ).status,
    503,
  );
  assert.equal(
    (
      await request(
        "/api/admin/properties",
        "PUT",
        blankProperty(),
        auth,
        "https://other.example",
      )
    ).status,
    403,
  );
});
test("public projection excludes private commission and reporter fields", () => {
  const p = {
    ...blankProperty(),
    title: "Casa",
    publication: "Publicado" as const,
  };
  const d = {
    ...blankDevelopment(),
    title: "Desarrollo",
    publication: "Publicado" as const,
  };
  const lot = { ...blankLot(d.id), reportedBy: "PERSONAL", note: "PRIVATE" };
  const output = JSON.stringify(
    publicCatalog({
      properties: [
        p,
        { ...p, id: crypto.randomUUID(), publication: "Borrador" },
      ],
      developments: [d],
      lots: [lot],
      settings: defaultPortalSettings,
    }),
  );
  assert.ok(!output.includes("commission"));
  assert.ok(!output.includes("PERSONAL"));
  assert.ok(!output.includes("PRIVATE"));
  assert.ok(!output.includes("Borrador"));
});
test("validation rejects external assets, malformed polygons and invalid coordinates", () => {
  assert.throws(() =>
    validate("properties", {
      ...blankProperty(),
      title: "Test",
      images: ["javascript:alert(1)"],
    }),
  );
  assert.throws(() =>
    validate("properties", {
      ...blankProperty(),
      title: "Test",
      lat: 23,
      lng: null,
    }),
  );
  assert.throws(() =>
    validate("properties", {
      ...blankProperty(),
      title: "Test",
      commissionValue: 101,
    }),
  );
  assert.throws(() =>
    validate("lots", {
      ...blankLot(crypto.randomUUID()),
      block: "1",
      number: "1",
      polygon: [
        [0, 0],
        [1000, 5],
        [5, 5],
      ],
    }),
  );
});
test("property persists; optimistic concurrency preserves edits and audit", async () => {
  const p = { ...blankProperty(), title: "Casa prueba" };
  let r = await request("/api/admin/properties", "PUT", p);
  assert.equal(r.status, 200);
  const saved = (await r.json()) as typeof p;
  assert.equal(saved.revision, 1);
  r = await request("/api/admin/properties", "PUT", { ...saved, price: 100 });
  assert.equal(r.status, 200);
  assert.equal(
    (await request("/api/admin/properties", "PUT", { ...saved, price: 200 }))
      .status,
    409,
  );
  const row = await db
    .prepare("SELECT data,revision FROM records WHERE id=?")
    .bind(p.id)
    .first();
  assert.equal(row?.revision, 2);
  assert.equal(JSON.parse(String(row?.data)).price, 100);
  const audit = await db
    .prepare("SELECT COUNT(*) AS n FROM audit WHERE record_id=?")
    .bind(p.id)
    .first();
  assert.equal(audit?.n, 2);
});
test("duplicate lot numbers are blocked; third-party sale needs no buyer; sold cannot be silently released", async () => {
  const d = { ...blankDevelopment(), title: "Fraccionamiento prueba" };
  assert.equal(
    (await request("/api/admin/developments", "PUT", d)).status,
    200,
  );
  const lot = {
    ...blankLot(d.id),
    block: "A",
    number: "1",
    status: "Vendido",
    soldBy: "Tercero",
    reportedBy: "Propietario",
  };
  const result = await request("/api/admin/lots", "PUT", lot);
  assert.equal(result.status, 200);
  assert.equal(
    (
      await request("/api/admin/lots", "PUT", {
        ...lot,
        id: crypto.randomUUID(),
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/api/admin/lots", "PUT", {
        ...lot,
        revision: 1,
        status: "Disponible",
      })
    ).status,
    400,
  );
});
test("advisor can edit inventory but cannot read administrative audit", async () => {
  const advisor = await token("advisor@example.test");
  assert.equal(
    (
      await request(
        "/api/admin/properties",
        "PUT",
        { ...blankProperty(), title: "Asesor" },
        advisor,
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/admin/audit", "GET", undefined, advisor)).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/api/admin/settings",
        "PUT",
        defaultPortalSettings,
        advisor,
      )
    ).status,
    403,
  );
});
test("customers require name and phone; advisors can register them", async () => {
  const advisor = await token("advisor@example.test"),
    customer = {
      id: crypto.randomUUID(),
      revision: 0,
      name: "Cliente prueba",
      phone: "4881234567",
      address: "",
      notes: "",
    };
  assert.equal(
    (
      await request(
        "/api/admin/customers",
        "PUT",
        { ...customer, phone: "" },
        advisor,
      )
    ).status,
    400,
  );
  assert.equal(
    (await request("/api/admin/customers", "PUT", customer, advisor)).status,
    200,
  );
});
test("apartments reserve inventory and cancellation is admin-only with review", async () => {
  const d = { ...blankDevelopment(), title: "Fraccionamiento ventas" };
  await request("/api/admin/developments", "PUT", d);
  const lot = { ...blankLot(d.id), block: "B", number: "2", price: 250000 };
  await request("/api/admin/lots", "PUT", lot);
  const customer = {
    id: crypto.randomUUID(),
    revision: 0,
    name: "Comprador",
    phone: "4880000000",
    address: "",
    notes: "",
  };
  await request("/api/admin/customers", "PUT", customer);
  const sale = {
    id: crypto.randomUUID(),
    revision: 0,
    customerId: customer.id,
    assetType: "Lote",
    assetId: lot.id,
    status: "Apartado",
    agreedPrice: 240000,
    reservationAmount: 10000,
    downPayment: 0,
    monthlyPayment: 5000,
    termMonths: 46,
    paymentMethod: "Efectivo",
    saleDate: "2026-09-11",
    nextPaymentDate: "2026-10-11",
    commissionType: "Porcentaje",
    commissionValue: 3,
    cancellationNotes: "",
    cancellationResolution: "",
  };
  assert.equal(
    (await request("/api/admin/sales", "PUT", { ...sale, termMonths: 12 }))
      .status,
    400,
  );
  let response = await request("/api/admin/sales", "PUT", sale);
  assert.equal(response.status, 200);
  let saved = (await response.json()) as typeof sale;
  let record = await db
    .prepare("SELECT data FROM records WHERE id=?")
    .bind(lot.id)
    .first();
  assert.equal(JSON.parse(String(record?.data)).status, "Apartado");
  response = await request("/api/admin/sales", "PUT", {
    ...saved,
    status: "Activa",
  });
  assert.equal(response.status, 200);
  saved = (await response.json()) as typeof sale;
  assert.equal(
    (await request("/api/admin/sales", "PUT", { ...saved, status: "Apartado" }))
      .status,
    400,
  );
  const advisor = await token("advisor@example.test");
  assert.equal(
    (
      await request(
        `/api/admin/sales/${sale.id}/review-cancellation`,
        "POST",
        { revision: saved.revision, notes: "Cliente solicita cambio" },
        advisor,
      )
    ).status,
    403,
  );
  response = await request(
    `/api/admin/sales/${sale.id}/review-cancellation`,
    "POST",
    { revision: saved.revision, notes: "Cliente solicita devolución" },
  );
  assert.equal(response.status, 200);
  response = await request(`/api/admin/sales/${sale.id}/cancel`, "POST", {
    revision: saved.revision + 1,
    notes: "Acuerdo firmado entre cliente y propietario",
  });
  assert.equal(response.status, 200);
  record = await db
    .prepare("SELECT data FROM records WHERE id=?")
    .bind(lot.id)
    .first();
  assert.equal(JSON.parse(String(record?.data)).status, "Disponible");
});
test("partial and extraordinary payments reduce oldest installments; only admin cancels payments", async () => {
  const d = {
    ...blankDevelopment(),
    title: "Fraccionamiento cobranza",
    collection: true,
  };
  await request("/api/admin/developments", "PUT", d);
  const lot = { ...blankLot(d.id), block: "C", number: "3", price: 100000 };
  await request("/api/admin/lots", "PUT", lot);
  const customer = {
    id: crypto.randomUUID(),
    revision: 0,
    name: "Cliente cobranza",
    phone: "4881112233",
    address: "",
    notes: "",
  };
  await request("/api/admin/customers", "PUT", customer);
  const sale = {
    id: crypto.randomUUID(),
    revision: 0,
    customerId: customer.id,
    assetType: "Lote" as const,
    assetId: lot.id,
    status: "Activa" as const,
    agreedPrice: 100000,
    reservationAmount: 0,
    downPayment: 10000,
    monthlyPayment: 30000,
    termMonths: 3,
    paymentMethod: "Efectivo" as const,
    saleDate: "2026-09-11",
    nextPaymentDate: "2026-10-11",
    commissionType: "Porcentaje" as const,
    commissionValue: 3,
    cancellationNotes: "",
    cancellationResolution: "",
  };
  assert.equal((await request("/api/admin/sales", "PUT", sale)).status, 200);
  const advisor = await token("advisor@example.test"),
    partial = {
      amount: 15000,
      paymentDate: "2026-10-10",
      paymentMethod: "Efectivo",
      kind: "Mensualidad",
      reference: "R-1",
      notes: "",
    };
  let response = await request(
    `/api/admin/sales/${sale.id}/payments`,
    "POST",
    partial,
    advisor,
  );
  assert.equal(response.status, 201);
  const first = (await response.json()) as { id: string; revision: number };
  let data = (await (
      await request("/api/admin/business")
    ).json()) as BusinessData,
    summary = saleBalance(
      data.sales.find((x) => x.id === sale.id)!,
      data.payments,
      "2026-10-20",
    );
  assert.equal(summary.balance, 75000);
  assert.equal(summary.installments[0].status, "Parcial");
  assert.equal(summary.installments[0].pending, 15000);
  assert.equal(summary.overdue, 15000);
  response = await request(`/api/admin/sales/${sale.id}/payments`, "POST", {
    ...partial,
    amount: 75000,
    kind: "Abono extraordinario",
    reference: "R-2",
  });
  assert.equal(response.status, 201);
  data = (await (await request("/api/admin/business")).json()) as BusinessData;
  assert.equal(data.sales.find((x) => x.id === sale.id)?.status, "Liquidada");
  assert.equal(
    (
      await request(
        `/api/admin/payments/${first.id}/cancel`,
        "POST",
        { revision: first.revision, reason: "Captura duplicada" },
        advisor,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`/api/admin/payments/${first.id}/cancel`, "POST", {
        revision: first.revision,
        reason: "Captura duplicada",
      })
    ).status,
    200,
  );
  data = (await (await request("/api/admin/business")).json()) as BusinessData;
  summary = saleBalance(
    data.sales.find((x) => x.id === sale.id)!,
    data.payments,
    "2026-10-20",
  );
  assert.equal(data.sales.find((x) => x.id === sale.id)?.status, "Activa");
  assert.equal(summary.balance, 15000);
  assert.equal(
    data.payments.find((x) => x.id === first.id)?.status,
    "Cancelado",
  );
});
test("owner deliveries retain commission, enforce available funds and remain auditable when cancelled", async () => {
  const property = {
    ...blankProperty(),
    title: "Casa entregas",
    price: 100000,
  };
  await request("/api/admin/properties", "PUT", property);
  const customer = {
    id: crypto.randomUUID(),
    revision: 0,
    name: "Cliente entregas",
    phone: "4882223344",
    address: "",
    notes: "",
  };
  await request("/api/admin/customers", "PUT", customer);
  const sale = {
    id: crypto.randomUUID(),
    revision: 0,
    customerId: customer.id,
    assetType: "Propiedad" as const,
    assetId: property.id,
    status: "Activa" as const,
    agreedPrice: 100000,
    reservationAmount: 0,
    downPayment: 10000,
    monthlyPayment: 30000,
    termMonths: 3,
    paymentMethod: "Efectivo" as const,
    saleDate: "2026-09-12",
    nextPaymentDate: "2026-10-12",
    commissionType: "Porcentaje" as const,
    commissionValue: 3,
    ownerName: "Propietario prueba",
    ownerPhone: "4889998877",
    cancellationNotes: "",
    cancellationResolution: "",
  };
  assert.equal((await request("/api/admin/sales", "PUT", sale)).status, 200);
  const advisor = await token("advisor@example.test"),
    delivery = {
      amount: 5000,
      deliveryDate: "2026-09-12",
      paymentMethod: "Efectivo",
      recipient: "Propietario prueba",
      reference: "E-1",
      notes: "",
    };
  assert.equal(
    (
      await request(
        `/api/admin/sales/${sale.id}/deliveries`,
        "POST",
        delivery,
        advisor,
      )
    ).status,
    403,
  );
  let response = await request(
    `/api/admin/sales/${sale.id}/deliveries`,
    "POST",
    delivery,
  );
  assert.equal(response.status, 201);
  const saved = (await response.json()) as { id: string; revision: number };
  assert.equal(
    (
      await request(`/api/admin/sales/${sale.id}/deliveries`, "POST", {
        ...delivery,
        amount: 3000,
      })
    ).status,
    400,
  );
  let data = (await (
      await request("/api/admin/business")
    ).json()) as BusinessData,
    stored = data.sales.find((x) => x.id === sale.id)!;
  let settlement = ownerSettlement(stored, data.payments, data.deliveries);
  assert.equal(settlement.contractedCommission, 3000);
  assert.equal(settlement.commissionRetained, 3000);
  assert.equal(settlement.pendingDelivery, 2000);
  data = (await (
    await request("/api/admin/business", "GET", undefined, advisor)
  ).json()) as BusinessData;
  assert.deepEqual(data.deliveries, []);
  assert.equal(
    (
      await request(`/api/admin/deliveries/${saved.id}/cancel`, "POST", {
        revision: saved.revision,
        reason: "Entrega capturada por duplicado",
      })
    ).status,
    200,
  );
  data = (await (await request("/api/admin/business")).json()) as BusinessData;
  settlement = ownerSettlement(
    data.sales.find((x) => x.id === sale.id)!,
    data.payments,
    data.deliveries,
  );
  assert.equal(settlement.pendingDelivery, 7000);
  assert.equal(
    data.deliveries.find((x) => x.id === saved.id)?.status,
    "Cancelada",
  );
});
test("portal settings are validated, versioned and exposed publicly", async () => {
  assert.throws(() =>
    validateSettings({
      ...defaultPortalSettings,
      primaryUrl: "javascript:alert(1)",
    }),
  );
  let r = await request("/api/admin/settings", "PUT", {
    ...defaultPortalSettings,
    heroTitle: "Tu próximo espacio",
  });
  assert.equal(r.status, 200);
  const saved = (await r.json()) as typeof defaultPortalSettings;
  assert.equal(saved.revision, 1);
  r = await request("/api/admin/settings", "PUT", {
    ...defaultPortalSettings,
    heroTitle: "Versión anterior",
  });
  assert.equal(r.status, 409);
  const publicData = (await (
    await request("/api/catalog", "GET", undefined, null)
  ).json()) as { settings: typeof defaultPortalSettings };
  assert.equal(publicData.settings.heroTitle, "Tu próximo espacio");
});
test("upload is private until linked to a published property and becomes private when hidden", async () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const uploaded = await service.fetch(
    new Request("https://mexino.example/api/admin/uploads", {
      method: "POST",
      headers: {
        Origin: "https://mexino.example",
        "Cf-Access-Jwt-Assertion": auth,
      },
      body: png,
    }),
    env,
  );
  assert.equal(uploaded.status, 201);
  const { url } = (await uploaded.json()) as { url: string };
  assert.equal((await request(url, "GET", undefined, null)).status, 401);
  const p = {
    ...blankProperty(),
    title: "Con foto",
    images: [url],
    publication: "Publicado",
  };
  assert.equal((await request("/api/admin/properties", "PUT", p)).status, 200);
  const publicImage = await request(url, "GET", undefined, null);
  assert.equal(publicImage.status, 200);
  assert.equal(publicImage.headers.get("Content-Type"), "image/png");
  assert.equal(
    (
      await request("/api/admin/properties", "PUT", {
        ...p,
        revision: 1,
        publication: "Oculto",
      })
    ).status,
    200,
  );
  assert.equal((await request(url, "GET", undefined, null)).status, 401);
});
test("cash is admin-only, separated from collections and supports closing and cancellation", async () => {
  const advisor = await token("advisor@example.test");
  assert.equal(
    (await request("/api/admin/cash", "GET", undefined, advisor)).status,
    403,
  );
  let cash = (await (await request("/api/admin/cash")).json()) as {
    movements: Array<{
      id: string;
      revision: number;
      sourceType: string;
      amount: number;
      movementType: string;
      status: string;
    }>;
    closings: unknown[];
  };
  assert.deepEqual(cash.movements, []);
  let response = await request("/api/admin/cash/movements", "POST", {
    movementType: "Ingreso",
    category: "Comisión",
    amount: 5000,
    movementDate: "2026-09-12",
    paymentMethod: "Efectivo",
    beneficiary: "",
    reference: "COM-1",
    notes: "Comisión cobrada",
  });
  assert.equal(response.status, 201);
  response = await request("/api/admin/cash/movements", "POST", {
    movementType: "Gasto",
    category: "Nómina",
    amount: 1200,
    movementDate: "2026-09-12",
    paymentMethod: "Efectivo",
    beneficiary: "Colaborador",
    reference: "NOM-1",
    notes: "Pago semanal",
  });
  assert.equal(response.status, 201);
  const expense = (await response.json()) as { id: string; revision: number };
  response = await request("/api/admin/cash/closings", "POST", {
    closingDate: "2026-09-12",
    paymentMethod: "Efectivo",
    countedAmount: 3800,
    notes: "Cierre correcto",
  });
  assert.equal(response.status, 201);
  assert.equal(
    ((await response.json()) as { difference: number }).difference,
    0,
  );
  assert.equal(
    (
      await request("/api/admin/cash/closings", "POST", {
        closingDate: "2026-09-12",
        paymentMethod: "Efectivo",
        countedAmount: 3800,
        notes: "Duplicado",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(`/api/admin/cash/movements/${expense.id}/cancel`, "POST", {
        revision: expense.revision,
        reason: "Captura duplicada",
      })
    ).status,
    200,
  );
  cash = (await (await request("/api/admin/cash")).json()) as typeof cash;
  assert.equal(
    cash.movements
      .filter((x) => x.status === "Aplicado")
      .reduce(
        (sum, x) => sum + (x.movementType === "Ingreso" ? x.amount : -x.amount),
        0,
      ),
    5000,
  );
  assert.ok(cash.movements.every((x) => x.sourceType === "Manual"));
});
test("receipts are sequential and test cleanup is protected and permanent", async () => {
  const before = (await (
    await request("/api/admin/business")
  ).json()) as BusinessData;
  assert.ok(before.receipts.length >= 2);
  const folios = before.receipts.map((receipt) => receipt.folio);
  assert.equal(new Set(folios).size, folios.length);
  assert.ok(folios.every((folio) => /^CM-\d{4}-\d{6}$/.test(folio)));

  const advisor = await token("advisor@example.test");
  assert.equal(
    (
      await request(
        "/api/admin/test-data/reset",
        "POST",
        { confirmation: "BORRAR DATOS DE PRUEBA", includeCatalog: false },
        advisor,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/admin/test-data/reset", "POST", {
        confirmation: "borrar",
        includeCatalog: false,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/admin/test-data/reset", "POST", {
        confirmation: "BORRAR DATOS DE PRUEBA",
        includeCatalog: false,
      })
    ).status,
    200,
  );
  const after = (await (
    await request("/api/admin/business")
  ).json()) as BusinessData;
  assert.deepEqual(after.customers, []);
  assert.deepEqual(after.sales, []);
  assert.deepEqual(after.payments, []);
  assert.deepEqual(after.receipts, []);
  assert.deepEqual(after.deliveries, []);
  const catalog = (await (await request("/api/admin/catalog")).json()) as {
    properties: Array<{ status: string }>;
  };
  assert.ok(catalog.properties.length > 0);
  assert.ok(
    catalog.properties.every((property) => property.status === "Disponible"),
  );

  assert.equal(
    (
      await request("/api/admin/test-data/lock", "POST", {
        confirmation: "INICIAR OPERACION REAL",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/api/admin/test-data/reset", "POST", {
        confirmation: "BORRAR DATOS DE PRUEBA",
        includeCatalog: false,
      })
    ).status,
    423,
  );
});
