import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import service,{validate,publicCatalog} from '../worker/index';
import {blankProperty,blankDevelopment,blankLot} from '../src/model';
import type {Env} from '../worker/types';

const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-09-09',d1Databases:['DB'],r2Buckets:['BUCKET']}));
const db=await mf.getD1Database('DB'),bucket=await mf.getR2Bucket('BUCKET');
const sql=await readFile(new URL('../migrations/0001_catalog.sql',import.meta.url),'utf8');
for(const statement of sql.split(';').filter(s=>s.trim()))await db.prepare(statement).run();
const {privateKey,publicKey}=await generateKeyPair('RS256'),jwk=await exportJWK(publicKey);jwk.kid='test-key';
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,init)=>String(input)==='https://test.cloudflareaccess.com/cdn-cgi/access/certs'?Response.json({keys:[jwk]}):originalFetch(input,init);
const env={DB:db,BUCKET:bucket,ASSETS:{fetch:async()=>new Response('SPA')},ACCESS_TEAM_DOMAIN:'test.cloudflareaccess.com',ACCESS_AUD:'mexino-test',ADMIN_EMAILS:'admin@example.test',ADVISOR_EMAILS:'advisor@example.test'} as unknown as Env;
async function token(email='admin@example.test',aud='mexino-test',expired=false){return new SignJWT({email}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setSubject('test-user').setIssuer('https://test.cloudflareaccess.com').setAudience(aud).setIssuedAt().setExpirationTime(expired?Math.floor(Date.now()/1000)-60:'5m').sign(privateKey);}
const auth=await token();
async function request(path:string,method='GET',body?:unknown,jwt:string|null=auth,origin='https://mexino.example'){
  const headers:Record<string,string>={Origin:origin};if(jwt)headers['Cf-Access-Jwt-Assertion']=jwt;
  if(body)headers['Content-Type']='application/json';
  return service.fetch(new Request(`https://mexino.example${path}`,{method,headers,body:body?JSON.stringify(body):undefined}),env);
}
after(async()=>{globalThis.fetch=originalFetch;await mf.dispose();});

test('anonymous writes and forged identities are rejected',async()=>{
  assert.equal((await request('/api/admin/properties','PUT',blankProperty(),null)).status,401);
  assert.equal((await request('/api/admin/session','GET',undefined,'forged')).status,401);
  assert.equal((await request('/api/admin/session','GET',undefined,await token('stranger@example.test'))).status,403);
  assert.equal((await request('/api/admin/session','GET',undefined,await token('admin@example.test','wrong'))).status,401);
  assert.equal((await request('/api/admin/session','GET',undefined,await token('admin@example.test','mexino-test',true))).status,401);
});
test('missing configuration fails closed; cross-origin mutation is rejected',async()=>{
  assert.equal((await service.fetch(new Request('https://mexino.example/api/admin/session'),{ASSETS:env.ASSETS})).status,503);
  assert.equal((await request('/api/admin/properties','PUT',blankProperty(),auth,'https://other.example')).status,403);
});
test('public projection excludes private commission and reporter fields',()=>{
  const p={...blankProperty(),title:'Casa',publication:'Publicado' as const};
  const d={...blankDevelopment(),title:'Desarrollo',publication:'Publicado' as const};
  const lot={...blankLot(d.id),reportedBy:'PERSONAL',note:'PRIVATE'};
  const output=JSON.stringify(publicCatalog({properties:[p,{...p,id:crypto.randomUUID(),publication:'Borrador'}],developments:[d],lots:[lot]}));
  assert.ok(!output.includes('commission'));assert.ok(!output.includes('PERSONAL'));assert.ok(!output.includes('PRIVATE'));assert.ok(!output.includes('Borrador'));
});
test('validation rejects external assets, malformed polygons and invalid coordinates',()=>{
  assert.throws(()=>validate('properties',{...blankProperty(),title:'Test',images:['javascript:alert(1)']}));
  assert.throws(()=>validate('properties',{...blankProperty(),title:'Test',lat:23,lng:null}));
  assert.throws(()=>validate('properties',{...blankProperty(),title:'Test',commissionValue:101}));
  assert.throws(()=>validate('lots',{...blankLot(crypto.randomUUID()),block:'1',number:'1',polygon:[[0,0],[1000,5],[5,5]]}));
});
test('property persists; optimistic concurrency preserves edits and audit',async()=>{
  const p={...blankProperty(),title:'Casa prueba'};
  let r=await request('/api/admin/properties','PUT',p);assert.equal(r.status,200);const saved=await r.json() as typeof p;assert.equal(saved.revision,1);
  r=await request('/api/admin/properties','PUT',{...saved,price:100});assert.equal(r.status,200);
  assert.equal((await request('/api/admin/properties','PUT',{...saved,price:200})).status,409);
  const row=await db.prepare('SELECT data,revision FROM records WHERE id=?').bind(p.id).first();assert.equal(row?.revision,2);assert.equal(JSON.parse(String(row?.data)).price,100);
  const audit=await db.prepare('SELECT COUNT(*) AS n FROM audit WHERE record_id=?').bind(p.id).first();assert.equal(audit?.n,2);
});
test('duplicate lot numbers are blocked; third-party sale needs no buyer; sold cannot be silently released',async()=>{
  const d={...blankDevelopment(),title:'Fraccionamiento prueba'};assert.equal((await request('/api/admin/developments','PUT',d)).status,200);
  const lot={...blankLot(d.id),block:'A',number:'1',status:'Vendido',soldBy:'Tercero',reportedBy:'Propietario'};
  const result=await request('/api/admin/lots','PUT',lot);assert.equal(result.status,200);
  assert.equal((await request('/api/admin/lots','PUT',{...lot,id:crypto.randomUUID()})).status,409);
  assert.equal((await request('/api/admin/lots','PUT',{...lot,revision:1,status:'Disponible'})).status,400);
});
test('advisor can edit inventory but cannot read administrative audit',async()=>{
  const advisor=await token('advisor@example.test');assert.equal((await request('/api/admin/properties','PUT',{...blankProperty(),title:'Asesor'},advisor)).status,200);
  assert.equal((await request('/api/admin/audit','GET',undefined,advisor)).status,403);
});
test('upload is private until linked to a published property and becomes private when hidden',async()=>{
  const png=new Uint8Array([137,80,78,71,13,10,26,10]);
  const uploaded=await service.fetch(new Request('https://mexino.example/api/admin/uploads',{method:'POST',headers:{Origin:'https://mexino.example','Cf-Access-Jwt-Assertion':auth},body:png}),env);
  assert.equal(uploaded.status,201);const {url}=await uploaded.json() as {url:string};
  assert.equal((await request(url,'GET',undefined,null)).status,401);
  const p={...blankProperty(),title:'Con foto',images:[url],publication:'Publicado'};assert.equal((await request('/api/admin/properties','PUT',p)).status,200);
  const publicImage=await request(url,'GET',undefined,null);assert.equal(publicImage.status,200);assert.equal(publicImage.headers.get('Content-Type'),'image/png');
  assert.equal((await request('/api/admin/properties','PUT',{...p,revision:1,publication:'Oculto'})).status,200);
  assert.equal((await request(url,'GET',undefined,null)).status,401);
});
