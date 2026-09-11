export type Property = {
  id: string; revision: number; title: string; type: 'Casa' | 'Local' | 'Terreno'; operation: 'Venta' | 'Renta';
  price: number; area: number; bedrooms: number; bathrooms: number; description: string; address: string;
  lat: number | null; lng: number | null; images: string[]; status: 'Disponible' | 'Apartado' | 'Vendido' | 'Rentado';
  publication: 'Borrador' | 'Publicado' | 'Oculto'; commissionType: 'Porcentaje' | 'Monto'; commissionValue: number;
};
export type Development = { id: string; revision: number; title: string; description: string; address: string; plan: string; publication: 'Borrador' | 'Publicado' | 'Oculto'; commissionType: 'Porcentaje' | 'Monto'; commissionValue: number; collection: boolean };
export type Lot = { id: string; revision: number; developmentId: string; block: string; number: string; area: number; price: number; status: 'Disponible' | 'Apartado' | 'Vendido'; polygon: number[][]; soldBy: 'Mexino' | 'Tercero' | ''; reportedBy: string; reportedDate: string; note: string };
export type Customer = { id:string; revision:number; name:string; phone:string; address:string; notes:string; createdAt?:string; updatedAt?:string };
export type SaleStatus = 'Apartado'|'Activa'|'Liquidada'|'Cancelacion en revision'|'Cancelada';
export type Sale = {
  id:string; revision:number; customerId:string; assetType:'Propiedad'|'Lote'; assetId:string; status:SaleStatus;
  agreedPrice:number; reservationAmount:number; downPayment:number; monthlyPayment:number; termMonths:number;
  paymentMethod:'Efectivo'|'Transferencia'|'Tarjeta'|'Otro'; saleDate:string; nextPaymentDate:string;
  commissionType:'Porcentaje'|'Monto'; commissionValue:number; cancellationNotes:string; cancellationResolution:string;
  createdAt?:string; updatedAt?:string;
};
export type BusinessData={customers:Customer[];sales:Sale[]};
export type PortalSettings = {
  revision: number;
  heroMode: 'Imagen fija' | 'Carrusel';
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
  heroMode: 'Imagen fija',
  heroImages: [],
  heroTitle: 'Encuentra el espacio',
  heroAccent: 'donde comienza tu historia.',
  heroDescription: 'Compra, vende o renta en Matehuala con acompañamiento cercano en cada decisión inmobiliaria.',
  primaryLabel: 'Ver propiedades',
  primaryUrl: '#catalogo',
  secondaryLabel: 'Explorar por ubicación',
  secondaryUrl: '/mapa',
  imagePositionDesktop: 'center center',
  imagePositionMobile: 'center center',
  phone: '',
  whatsapp: '',
  email: '',
  address: 'Matehuala, San Luis Potosí'
};
export type Catalog = { properties: Property[]; developments: Development[]; lots: Lot[]; settings: PortalSettings };
export const emptyCatalog: Catalog = {properties: [], developments: [], lots: [], settings: defaultPortalSettings};
export const money = (value: number) => new Intl.NumberFormat('es-MX', {style:'currency',currency:'MXN',maximumFractionDigits:0}).format(value);
export function blankProperty(): Property { return {id:crypto.randomUUID(),revision:0,title:'',type:'Casa',operation:'Venta',price:0,area:0,bedrooms:0,bathrooms:0,description:'',address:'',lat:null,lng:null,images:[],status:'Disponible',publication:'Borrador',commissionType:'Porcentaje',commissionValue:3}; }
export function blankDevelopment(): Development {return {id:crypto.randomUUID(),revision:0,title:'',description:'',address:'',plan:'',publication:'Borrador',commissionType:'Porcentaje',commissionValue:3,collection:false};}
export function blankLot(developmentId: string): Lot {return {id:crypto.randomUUID(),revision:0,developmentId,block:'',number:'',area:0,price:0,status:'Disponible',polygon:[],soldBy:'',reportedBy:'',reportedDate:'',note:''};}
export function blankCustomer():Customer{return {id:crypto.randomUUID(),revision:0,name:'',phone:'',address:'',notes:''};}
export function blankSale():Sale{return {id:crypto.randomUUID(),revision:0,customerId:'',assetType:'Lote',assetId:'',status:'Apartado',agreedPrice:0,reservationAmount:0,downPayment:0,monthlyPayment:0,termMonths:0,paymentMethod:'Efectivo',saleDate:new Date().toISOString().slice(0,10),nextPaymentDate:'',commissionType:'Porcentaje',commissionValue:3,cancellationNotes:'',cancellationResolution:''};}
