import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Env } from './types';
import type { Catalog, Property, Development, Lot } from '../src/model';

const json = (data: unknown, status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
class Failure extends Error { constructor(public status: number, message: string) {super(message);} }
const keys = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function identity(request: Request, env: Env) {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ADMIN_EMAILS) throw new Failure(503,'El acceso administrativo está pendiente de activación.');
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN)) throw new Failure(503,'Configuración de acceso pendiente.');
  const token = request.headers.get('Cf-Access-Jwt-Assertion') || request.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('CF_Authorization='))?.slice(17);
  if (!token) throw new Failure(401,'Inicia sesión para continuar.');
  const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
  if (!keys.has(issuer)) keys.set(issuer,createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)));
  let email: string;
  try {const {payload} = await jwtVerify(token,keys.get(issuer)!,{issuer,audience:env.ACCESS_AUD,algorithms:['RS256'],requiredClaims:['sub','exp','email']}); email=String(payload.email).toLowerCase();}
  catch {throw new Failure(401,'La sesión venció. Vuelve a iniciar sesión.');}
  const list=(s?:string)=> (s||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  const role=list(env.ADMIN_EMAILS).includes(email)?'Administrador':list(env.ADVISOR_EMAILS).includes(email)?'Asesor':null;
  if (!role) throw new Failure(403,'Tu cuenta no tiene acceso a Mexino.');
  return {email,role};
}
type Row={id:string;kind:keyof Catalog;data:string;revision:number};
async function catalog(env: Env): Promise<Catalog> {
  if (!env.DB) throw new Failure(503,'El catálogo está pendiente de conexión.');
  const {results}=await env.DB.prepare('SELECT id,kind,data,revision FROM records ORDER BY updated_at DESC').all<Row>();
  const result: Catalog={properties:[],developments:[],lots:[]};
  for(const row of results) (result[row.kind] as unknown[]).push({...JSON.parse(row.data),id:row.id,revision:row.revision});
  return result;
}
export function publicCatalog(data: Catalog) {
  const developments=data.developments.filter(x=>x.publication==='Publicado').map(({id,title,description,address,plan})=>({id,title,description,address,plan}));
  return {
    properties:data.properties.filter(x=>x.publication==='Publicado').map(({id,title,type,operation,price,area,bedrooms,bathrooms,description,address,lat,lng,images,status})=>({id,title,type,operation,price,area,bedrooms,bathrooms,description,address,lat,lng,images,status})),
    developments,
    lots:data.lots.filter(x=>developments.some(d=>d.id===x.developmentId)).map(({id,developmentId,block,number,area,price,status,polygon})=>({id,developmentId,block,number,area,price,status,polygon}))
  };
}
function text(v: unknown, max=200, required=false) {if(typeof v!=='string'||v.length>max||(required&&!v.trim())) throw new Failure(400,'Revisa los textos obligatorios y su longitud.'); return v.trim();}
function number(v: unknown,max=1e10) {if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max) throw new Failure(400,'Revisa los importes y superficies.');return v;}
function choice<T extends string>(v: unknown, choices:T[]): T {if(!choices.includes(v as T)) throw new Failure(400,'Opción no válida.');return v as T;}
const fileId=(s:string)=>s.match(/^\/media\/([a-f0-9-]{36})$/)?.[1];
function media(v:unknown) {const s=text(v);if(s&&!fileId(s)) throw new Failure(400,'Sube el archivo desde el panel.');return s;}
function commission(v:Record<string,unknown>) {const commissionType=choice(v.commissionType,['Porcentaje','Monto']);return {commissionType,commissionValue:number(v.commissionValue,commissionType==='Porcentaje'?100:1e10)};}
export function validate(kind:string,v:Record<string,unknown>) {
  const base={id:text(v.id,36,true),revision:number(v.revision,1e9)};
  if(!/^[a-f0-9-]{36}$/.test(base.id)||!Number.isInteger(base.revision)) throw new Failure(400,'Identificador no válido.');
  if(kind==='properties') {
    if(!Array.isArray(v.images)||v.images.length>20) throw new Failure(400,'Máximo 20 imágenes.');
    const coord=(x:unknown,min:number,max:number)=>{if(x===null)return null;if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)throw new Failure(400,'Coordenadas no válidas.');return x;};
    const lat=coord(v.lat,-90,90),lng=coord(v.lng,-180,180);
    if((lat===null)!==(lng===null)) throw new Failure(400,'Indica ambas coordenadas.');
    const images=v.images.map(media);const publication=choice(v.publication,['Borrador','Publicado','Oculto']);
    if(publication==='Publicado'&&!images.length)throw new Failure(400,'Agrega una imagen antes de publicar.');
    return {...base,title:text(v.title,160,true),type:choice(v.type,['Casa','Local','Terreno']),operation:choice(v.operation,['Venta','Renta']),price:number(v.price),area:number(v.area),bedrooms:number(v.bedrooms,100),bathrooms:number(v.bathrooms,100),description:text(v.description,10000),address:text(v.address,500),lat,lng,images,status:choice(v.status,['Disponible','Apartado','Vendido','Rentado']),publication,...commission(v)} as Property;
  }
  if(kind==='developments')return {...base,title:text(v.title,160,true),description:text(v.description,10000),address:text(v.address,500),plan:media(v.plan),publication:choice(v.publication,['Borrador','Publicado','Oculto']),collection:v.collection===true,...commission(v)} as Development;
  if(kind!=='lots')throw new Failure(404,'Sección no encontrada.');
  const polygon=v.polygon;
  if(!Array.isArray(polygon)||polygon.length>100||(polygon.length>0&&polygon.length<3)||polygon.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>100)))throw new Failure(400,'El contorno requiere al menos tres puntos dentro del plano.');
  const status=choice(v.status,['Disponible','Apartado','Vendido']),soldBy=choice(v.soldBy,['Mexino','Tercero','']);
  if(status==='Vendido'&&!soldBy)throw new Failure(400,'Indica quién realizó la venta.');
  const reportedDate=text(v.reportedDate,10);
  if(reportedDate&&!/^\d{4}-\d{2}-\d{2}$/.test(reportedDate))throw new Failure(400,'Fecha no válida.');
  return {...base,developmentId:text(v.developmentId,36,true),block:text(v.block,50,true),number:text(v.number,50,true),area:number(v.area),price:number(v.price),status,polygon,soldBy:status==='Vendido'?soldBy:'',reportedBy:text(v.reportedBy,200),reportedDate,note:text(v.note,3000)} as Lot;
}
async function save(request:Request,env:Env,user:{email:string;role:string},kind:string) {
  if(!env.DB)throw new Failure(503,'El guardado está pendiente de conexión.');
  const raw=await request.text();if(raw.length>50000)throw new Failure(413,'Registro demasiado grande.');
  let input:Record<string,unknown>;try{input=JSON.parse(raw);if(!input||typeof input!=='object'||Array.isArray(input))throw new Error();}catch{throw new Failure(400,'Datos no válidos.');}
  const value=validate(kind,input);const old=await env.DB.prepare('SELECT id,kind,data,revision FROM records WHERE id=?').bind(value.id).first<Row>();
  if(old&&(old.kind!==kind||old.revision!==value.revision)||!old&&value.revision!==0)throw new Failure(409,'Otro usuario actualizó este registro. Recarga antes de guardar.');
  if(old&&JSON.parse(old.data).status==='Vendido'&&'status' in value&&value.status!=='Vendido')throw new Failure(400,'La liberación de un lote vendido requiere el flujo de cancelación de ventas, previsto para la segunda etapa.');
  let parent:string|null=null,lotKey:string|null=null;
  if(kind==='lots') {const lot=value as Lot;parent=lot.developmentId;lotKey=`${lot.block.toLowerCase()}|${lot.number.toLowerCase()}`;if(!await env.DB.prepare("SELECT id FROM records WHERE id=? AND kind='developments'").bind(parent).first())throw new Failure(400,'Fraccionamiento no encontrado.');}
  const links=kind==='properties'?(value as Property).images:kind==='developments'?[(value as Development).plan].filter(Boolean):[];
  for(const link of links)if(!await env.DB.prepare('SELECT id FROM uploads WHERE id=?').bind(fileId(link)).first())throw new Failure(400,'Archivo no encontrado. Vuelve a subirlo.');
  const data=JSON.stringify({...value,revision:value.revision+1});
  const mutation=old?env.DB.prepare('UPDATE records SET data=?,revision=revision+1,parent_id=?,lot_key=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=?').bind(data,parent,lotKey,value.id,value.revision):env.DB.prepare('INSERT INTO records(id,kind,parent_id,lot_key,data) VALUES(?,?,?,?,?)').bind(value.id,kind,parent,lotKey,data);
  try {
    const result=await env.DB.batch([mutation,env.DB.prepare("INSERT INTO audit(id,record_id,actor,action,before_data,after_data) SELECT ?,?,?,?,?,? WHERE changes()=1").bind(crypto.randomUUID(),value.id,user.email,old?'Actualizar':'Crear',old?.data||null,data)]);
    if(result[0].meta.changes!==1)throw new Failure(409,'Registro actualizado por otra persona. Recarga antes de guardar.');
  }catch(e){if(e instanceof Failure)throw e; if(String(e).includes('UNIQUE'))throw new Failure(409,'Ya existe ese lote en esta manzana.');throw e;}
  return json({...value,revision:value.revision+1});
}
async function upload(request:Request,env:Env,email:string) {
  if(!env.DB||!env.BUCKET)throw new Failure(503,'La carga de imágenes está pendiente de conexión.');
  const reader=request.body?.getReader();if(!reader)throw new Failure(400,'Archivo vacío.');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024){await reader.cancel();throw new Failure(413,'Máximo 8 MB por imagen.');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const mime=bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP'?'image/webp':null;
  if(!mime)throw new Failure(400,'Solo imágenes JPG, PNG o WebP.');
  const id=crypto.randomUUID();await env.BUCKET.put(id,bytes,{httpMetadata:{contentType:mime}});
  try{await env.DB.prepare('INSERT INTO uploads(id,mime,actor) VALUES(?,?,?)').bind(id,mime,email).run();}catch(e){await env.BUCKET.delete(id);throw e;}
  return json({url:`/media/${id}`},201);
}
export default {
  async fetch(request:Request,env:Env):Promise<Response> {
    const url=new URL(request.url),path=url.pathname;
    try {
      if(path==='/api/catalog'&&request.method==='GET')return json(publicCatalog(await catalog(env)));
      if(path.startsWith('/media/')) {
        if(!['GET','HEAD'].includes(request.method))throw new Failure(405,'Método no permitido.');
        if(!env.BUCKET)throw new Failure(404,'Imagen no encontrada.');
        const all=publicCatalog(await catalog(env));const allowed=all.properties.some(p=>p.images.includes(path))||all.developments.some(d=>d.plan===path);
        if(!allowed)await identity(request,env);
        const object=await env.BUCKET.get(path.slice(7));if(!object)throw new Failure(404,'Imagen no encontrada.');
        return new Response(request.method==='HEAD'?null:object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}});
      }
      if(path.startsWith('/api/admin/')) {
        const user=await identity(request,env);
        if(request.method!=='GET'&&request.headers.get('Origin')!==url.origin)throw new Failure(403,'Origen no permitido.');
        if(path==='/api/admin/session'&&request.method==='GET')return json(user);
        if(path==='/api/admin/catalog'&&request.method==='GET')return json(await catalog(env));
        if(path==='/api/admin/audit'&&request.method==='GET') {
          if(user.role!=='Administrador')throw new Failure(403,'Solo administradores.');
          if(!env.DB)throw new Failure(503,'Historial pendiente de conexión.');
          return json((await env.DB.prepare('SELECT id,record_id,actor,action,created_at FROM audit ORDER BY created_at DESC LIMIT 100').all()).results);
        }
        if(path==='/api/admin/uploads'&&request.method==='POST')return await upload(request,env,user.email);
        if(request.method==='PUT'&&/^\/api\/admin\/(properties|developments|lots)$/.test(path))return await save(request,env,user,path.split('/').pop()!);
        throw new Failure(404,'Acción no encontrada.');
      }
      if(path.startsWith('/api/'))throw new Failure(404,'Ruta no encontrada.');
      return env.ASSETS.fetch(request);
    }catch(e){if(e instanceof Failure)return json({error:e.message},e.status);console.error('Mexino request failed',e instanceof Error?e.message:'unknown');return json({error:'No se pudo completar la operación. Intenta nuevamente; tus cambios no se han descartado.'},500);}
  }
};
