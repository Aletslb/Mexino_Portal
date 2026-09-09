export type Property = {
  id: string; revision: number; title: string; type: 'Casa' | 'Local' | 'Terreno'; operation: 'Venta' | 'Renta';
  price: number; area: number; bedrooms: number; bathrooms: number; description: string; address: string;
  lat: number | null; lng: number | null; images: string[]; status: 'Disponible' | 'Apartado' | 'Vendido' | 'Rentado';
  publication: 'Borrador' | 'Publicado' | 'Oculto'; commissionType: 'Porcentaje' | 'Monto'; commissionValue: number;
};
export type Development = { id: string; revision: number; title: string; description: string; address: string; plan: string; publication: 'Borrador' | 'Publicado' | 'Oculto'; commissionType: 'Porcentaje' | 'Monto'; commissionValue: number; collection: boolean };
export type Lot = { id: string; revision: number; developmentId: string; block: string; number: string; area: number; price: number; status: 'Disponible' | 'Apartado' | 'Vendido'; polygon: number[][]; soldBy: 'Mexino' | 'Tercero' | ''; reportedBy: string; reportedDate: string; note: string };
export type Catalog = { properties: Property[]; developments: Development[]; lots: Lot[] };
export const emptyCatalog: Catalog = {properties: [], developments: [], lots: []};
export const money = (value: number) => new Intl.NumberFormat('es-MX', {style:'currency',currency:'MXN',maximumFractionDigits:0}).format(value);
export function blankProperty(): Property { return {id:crypto.randomUUID(),revision:0,title:'',type:'Casa',operation:'Venta',price:0,area:0,bedrooms:0,bathrooms:0,description:'',address:'',lat:null,lng:null,images:[],status:'Disponible',publication:'Borrador',commissionType:'Porcentaje',commissionValue:3}; }
export function blankDevelopment(): Development {return {id:crypto.randomUUID(),revision:0,title:'',description:'',address:'',plan:'',publication:'Borrador',commissionType:'Porcentaje',commissionValue:3,collection:false};}
export function blankLot(developmentId: string): Lot {return {id:crypto.randomUUID(),revision:0,developmentId,block:'',number:'',area:0,price:0,status:'Disponible',polygon:[],soldBy:'',reportedBy:'',reportedDate:'',note:''};}
