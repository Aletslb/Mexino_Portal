import {useEffect,useRef} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type {Property} from './model';
import {money} from './model';
type Props={properties:Property[]; onPick?:(lat:number,lng:number)=>void; location?:[number,number]|null};
export default function MapView({properties,onPick,location}:Props){
  const host=useRef<HTMLDivElement>(null), map=useRef<L.Map|null>(null), layer=useRef<L.LayerGroup|null>(null);
  useEffect(()=>{
    if(!host.current)return;
    const m=L.map(host.current,{scrollWheelZoom:false}).setView([23.648,-100.644],13);map.current=m;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(m);
    layer.current=L.layerGroup().addTo(m);
    const resize=new ResizeObserver(()=>m.invalidateSize());resize.observe(host.current);
    return()=>{resize.disconnect();m.remove();map.current=null;};
  },[]);
  useEffect(()=>{const m=map.current;if(!m||!onPick)return;const click=(e:L.LeafletMouseEvent)=>onPick(Number(e.latlng.lat.toFixed(6)),Number(e.latlng.lng.toFixed(6)));m.on('click',click);return()=>{m.off('click',click);};},[onPick]);
  useEffect(()=>{
    if(!layer.current)return;layer.current.clearLayers();
    properties.filter(p=>p.lat!==null&&p.lng!==null).forEach(p=>{
      const card=document.createElement('div');card.className='map-card';
      if(p.images[0]){const img=document.createElement('img');img.src=p.images[0];img.alt=p.title;card.append(img);}
      const title=document.createElement('strong');title.textContent=p.title;card.append(title);
      const price=document.createElement('p');price.textContent=`${money(p.price)} · ${p.operation}`;card.append(price);
      const a=document.createElement('a');a.href=`/propiedades/${p.id}`;a.textContent='Ver propiedad';card.append(a);
      L.circleMarker([p.lat!,p.lng!],{radius:10,color:'#fff',weight:3,fillColor:p.operation==='Venta'?'#2364ed':'#ad43aa',fillOpacity:1}).bindPopup(card).addTo(layer.current!);
    });
    if(location)L.circleMarker(location,{radius:9,color:'#18232f',fillColor:'#c9f25b',fillOpacity:1}).addTo(layer.current);
  },[properties,location]);
  return <div className="map-surface" ref={host} aria-label="Mapa interactivo de propiedades en Matehuala"/>;
}
