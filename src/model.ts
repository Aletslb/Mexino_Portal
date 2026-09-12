export type Property = {
  id: string;
  revision: number;
  title: string;
  type: "Casa" | "Local" | "Terreno";
  operation: "Venta" | "Renta";
  price: number;
  area: number;
  bedrooms: number;
  bathrooms: number;
  description: string;
  address: string;
  lat: number | null;
  lng: number | null;
  images: string[];
  status: "Disponible" | "Apartado" | "Vendido" | "Rentado";
  publication: "Borrador" | "Publicado" | "Oculto";
  commissionType: "Porcentaje" | "Monto";
  commissionValue: number;
};
export type Development = {
  id: string;
  revision: number;
  title: string;
  description: string;
  address: string;
  plan: string;
  publication: "Borrador" | "Publicado" | "Oculto";
  commissionType: "Porcentaje" | "Monto";
  commissionValue: number;
  collection: boolean;
};
export type Lot = {
  id: string;
  revision: number;
  developmentId: string;
  block: string;
  number: string;
  area: number;
  price: number;
  status: "Disponible" | "Apartado" | "Vendido";
  polygon: number[][];
  soldBy: "Mexino" | "Tercero" | "";
  reportedBy: string;
  reportedDate: string;
  note: string;
};
export type Customer = {
  id: string;
  revision: number;
  name: string;
  phone: string;
  address: string;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
};
export type SaleStatus =
  "Apartado" | "Activa" | "Liquidada" | "Cancelacion en revision" | "Cancelada";
export type Sale = {
  id: string;
  revision: number;
  customerId: string;
  assetType: "Propiedad" | "Lote";
  assetId: string;
  status: SaleStatus;
  agreedPrice: number;
  reservationAmount: number;
  downPayment: number;
  monthlyPayment: number;
  termMonths: number;
  paymentMethod: "Efectivo" | "Transferencia" | "Tarjeta" | "Otro";
  saleDate: string;
  nextPaymentDate: string;
  commissionType: "Porcentaje" | "Monto";
  commissionValue: number;
  ownerName: string;
  ownerPhone: string;
  cancellationNotes: string;
  cancellationResolution: string;
  createdAt?: string;
  updatedAt?: string;
};
export type Payment = {
  id: string;
  saleId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: Sale["paymentMethod"];
  kind: "Mensualidad" | "Abono extraordinario";
  reference: string;
  notes: string;
  status: "Aplicado" | "Cancelado";
  cancellationReason: string;
  revision: number;
  createdBy: string;
  cancelledBy: string;
  createdAt: string;
  cancelledAt: string;
};
export type OwnerDelivery = {
  id: string;
  saleId: string;
  amount: number;
  deliveryDate: string;
  paymentMethod: Sale["paymentMethod"];
  recipient: string;
  reference: string;
  notes: string;
  status: "Aplicada" | "Cancelada";
  cancellationReason: string;
  revision: number;
  createdBy: string;
  cancelledBy: string;
  createdAt: string;
  cancelledAt: string;
};
export type Receipt = {
  id: string;
  saleId: string;
  sourceType: "Inicial" | "Pago";
  sourceId: string;
  folio: string;
  sequenceYear: number;
  sequenceNumber: number;
  issuedDate: string;
  createdAt: string;
};
export type CashMovement = {
  id: string;
  movementType: "Ingreso" | "Gasto";
  category:
    | "Cobro de cliente"
    | "Entrega a propietario"
    | "Comisión"
    | "Nómina"
    | "Honorarios"
    | "Gasto operativo"
    | "Otro";
  amount: number;
  movementDate: string;
  paymentMethod: Sale["paymentMethod"];
  beneficiary: string;
  reference: string;
  notes: string;
  sourceType: "Manual";
  sourceId: string;
  status: "Aplicado" | "Cancelado";
  cancellationReason: string;
  revision: number;
  createdBy: string;
  cancelledBy: string;
  createdAt: string;
  cancelledAt: string;
};
export type CashClosing = {
  id: string;
  closingDate: string;
  paymentMethod: Sale["paymentMethod"];
  expectedAmount: number;
  countedAmount: number;
  difference: number;
  notes: string;
  createdBy: string;
  createdAt: string;
};
export type CashData = {
  movements: CashMovement[];
  closings: CashClosing[];
};
export type Installment = {
  number: number;
  dueDate: string;
  amount: number;
  paid: number;
  pending: number;
  status: "Pagada" | "Parcial" | "Vencida" | "Pendiente";
};
export type SaleBalance = {
  initialPaid: number;
  paymentsPaid: number;
  principalAdvance: number;
  totalPaid: number;
  balance: number;
  overdue: number;
  nextDueDate: string;
  installments: Installment[];
};
export type OwnerSettlement = {
  contractedCommission: number;
  commissionRetained: number;
  ownerFundsAvailable: number;
  delivered: number;
  pendingDelivery: number;
};
export type BusinessData = {
  customers: Customer[];
  sales: Sale[];
  payments: Payment[];
  deliveries: OwnerDelivery[];
  receipts: Receipt[];
};
export type PortalSettings = {
  revision: number;
  heroMode: "Imagen fija" | "Carrusel";
  heroImages: string[];
  heroTitle: string;
  heroAccent: string;
  heroDescription: string;
  primaryLabel: string;
  primaryUrl: string;
  secondaryLabel: string;
  secondaryUrl: string;
  imagePositionDesktop: string;
  imagePositionMobile: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
};
export const defaultPortalSettings: PortalSettings = {
  revision: 0,
  heroMode: "Imagen fija",
  heroImages: [],
  heroTitle: "Encuentra el espacio",
  heroAccent: "donde comienza tu historia.",
  heroDescription:
    "Compra, vende o renta en Matehuala con acompañamiento cercano en cada decisión inmobiliaria.",
  primaryLabel: "Ver propiedades",
  primaryUrl: "#catalogo",
  secondaryLabel: "Explorar por ubicación",
  secondaryUrl: "/mapa",
  imagePositionDesktop: "center center",
  imagePositionMobile: "center center",
  phone: "",
  whatsapp: "",
  email: "",
  address: "Matehuala, San Luis Potosí",
};
export type Catalog = {
  properties: Property[];
  developments: Development[];
  lots: Lot[];
  settings: PortalSettings;
};
export const emptyCatalog: Catalog = {
  properties: [],
  developments: [],
  lots: [],
  settings: defaultPortalSettings,
};
export const money = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
export function blankProperty(): Property {
  return {
    id: crypto.randomUUID(),
    revision: 0,
    title: "",
    type: "Casa",
    operation: "Venta",
    price: 0,
    area: 0,
    bedrooms: 0,
    bathrooms: 0,
    description: "",
    address: "",
    lat: null,
    lng: null,
    images: [],
    status: "Disponible",
    publication: "Borrador",
    commissionType: "Porcentaje",
    commissionValue: 3,
  };
}
export function blankDevelopment(): Development {
  return {
    id: crypto.randomUUID(),
    revision: 0,
    title: "",
    description: "",
    address: "",
    plan: "",
    publication: "Borrador",
    commissionType: "Porcentaje",
    commissionValue: 3,
    collection: false,
  };
}
export function blankLot(developmentId: string): Lot {
  return {
    id: crypto.randomUUID(),
    revision: 0,
    developmentId,
    block: "",
    number: "",
    area: 0,
    price: 0,
    status: "Disponible",
    polygon: [],
    soldBy: "",
    reportedBy: "",
    reportedDate: "",
    note: "",
  };
}
export function blankCustomer(): Customer {
  return {
    id: crypto.randomUUID(),
    revision: 0,
    name: "",
    phone: "",
    address: "",
    notes: "",
  };
}
export function blankSale(): Sale {
  return {
    id: crypto.randomUUID(),
    revision: 0,
    customerId: "",
    assetType: "Lote",
    assetId: "",
    status: "Apartado",
    agreedPrice: 0,
    reservationAmount: 0,
    downPayment: 0,
    monthlyPayment: 0,
    termMonths: 0,
    paymentMethod: "Efectivo",
    saleDate: new Date().toISOString().slice(0, 10),
    nextPaymentDate: "",
    commissionType: "Porcentaje",
    commissionValue: 3,
    ownerName: "",
    ownerPhone: "",
    cancellationNotes: "",
    cancellationResolution: "",
  };
}
const cents = (value: number) => Math.round(value * 100) / 100;
function addMonths(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number),
    target = new Date(Date.UTC(year, month - 1 + months, 1)),
    last = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
    ).getUTCDate();
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
}
export function saleBalance(
  sale: Sale,
  payments: Payment[],
  today = new Date().toISOString().slice(0, 10),
): SaleBalance {
  const initialPaid = cents(
    Math.min(sale.agreedPrice, sale.reservationAmount + sale.downPayment),
  );
  const applied = payments
    .filter((p) => p.saleId === sale.id && p.status === "Aplicado")
    .sort(
      (a, b) =>
        a.paymentDate.localeCompare(b.paymentDate) ||
        a.createdAt.localeCompare(b.createdAt),
    );
  const paymentsPaid = cents(applied.reduce((sum, p) => sum + p.amount, 0));
  const totalPaid = cents(
      Math.min(sale.agreedPrice, initialPaid + paymentsPaid),
    ),
    balance = cents(Math.max(0, sale.agreedPrice - totalPaid));
  const financed = cents(Math.max(0, sale.agreedPrice - initialPaid)),
    installments: Installment[] = [];
  if (sale.monthlyPayment > 0 && sale.nextPaymentDate && financed > 0) {
    let planned = financed,
      index = 0,
      advance = 0;
    while (planned > 0.001 && index < 1200) {
      const amount = cents(Math.min(sale.monthlyPayment, planned));
      installments.push({
        number: index + 1,
        dueDate: addMonths(sale.nextPaymentDate, index),
        amount,
        paid: 0,
        pending: amount,
        status: "Pendiente",
      });
      planned = cents(planned - amount);
      index++;
    }
    for (const payment of applied) {
      let available = payment.amount;
      const due = installments.filter(
        (x) => x.pending > 0.001 && x.dueDate <= payment.paymentDate,
      );
      for (const item of due) {
        const amount = cents(Math.min(item.pending, available));
        item.paid = cents(item.paid + amount);
        item.pending = cents(item.pending - amount);
        available = cents(available - amount);
        if (available <= 0.001) break;
      }
      if (available > 0.001 && !due.length) {
        const next = installments.find((x) => x.pending > 0.001);
        if (next) {
          const amount = cents(Math.min(next.pending, available));
          next.paid = cents(next.paid + amount);
          next.pending = cents(next.pending - amount);
          available = cents(available - amount);
        }
      }
      advance = cents(advance + available);
    }
    for (let i = installments.length - 1; i >= 0 && advance > 0.001; i--) {
      const item = installments[i];
      if (item.paid > 0) continue;
      const reduction = cents(Math.min(item.amount, advance));
      item.amount = cents(item.amount - reduction);
      item.pending = cents(item.pending - reduction);
      advance = cents(advance - reduction);
      if (item.amount <= 0.001) installments.splice(i, 1);
    }
    installments.forEach((item, i) => {
      item.number = i + 1;
      item.status =
        item.pending <= 0.001
          ? "Pagada"
          : item.paid > 0
            ? "Parcial"
            : item.dueDate <= today
              ? "Vencida"
              : "Pendiente";
    });
  }
  const scheduledPaid = cents(installments.reduce((sum, x) => sum + x.paid, 0)),
    principalAdvance = cents(Math.max(0, paymentsPaid - scheduledPaid));
  const overdue = cents(
      installments
        .filter((x) => x.dueDate <= today)
        .reduce((sum, x) => sum + x.pending, 0),
    ),
    nextDueDate = installments.find((x) => x.pending > 0.001)?.dueDate || "";
  return {
    initialPaid,
    paymentsPaid,
    principalAdvance,
    totalPaid,
    balance,
    overdue,
    nextDueDate,
    installments,
  };
}
export function ownerSettlement(
  sale: Sale,
  payments: Payment[],
  deliveries: OwnerDelivery[],
): OwnerSettlement {
  const collected = saleBalance(sale, payments).totalPaid;
  const contractedCommission = cents(
    Math.min(
      sale.agreedPrice,
      sale.commissionType === "Porcentaje"
        ? (sale.agreedPrice * sale.commissionValue) / 100
        : sale.commissionValue,
    ),
  );
  const commissionRetained = cents(Math.min(contractedCommission, collected));
  const ownerFundsAvailable = cents(
    Math.max(0, collected - commissionRetained),
  );
  const delivered = cents(
    deliveries
      .filter((x) => x.saleId === sale.id && x.status === "Aplicada")
      .reduce((sum, x) => sum + x.amount, 0),
  );
  return {
    contractedCommission,
    commissionRetained,
    ownerFundsAvailable,
    delivered,
    pendingDelivery: cents(Math.max(0, ownerFundsAvailable - delivered)),
  };
}
