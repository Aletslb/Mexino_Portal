import type {Lot} from './model';
export default function PlanView({plan,lots,selected,onSelect,onPoint,draft=[]}:{plan:string;lots:Lot[];selected?:string;onSelect:(lot:Lot)=>void;onPoint?:(point:number[])=>void;draft?:number[][]}){
  if(!plan)return <div className="empty">Agrega el plano del fraccionamiento para ubicar sus lotes.</div>;
  return <div className="plan-scroll"><div className={'plan-canvas '+(onPoint?'drawing':'')}>
    <img src={plan} alt="Plano del fraccionamiento" draggable={false}/>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Lotes del fraccionamiento" onClick={e=>{if(!onPoint)return;const r=e.currentTarget.getBoundingClientRect();onPoint([(e.clientX-r.left)/r.width*100,(e.clientY-r.top)/r.height*100]);}}>
      {lots.filter(l=>l.polygon.length>=3).map(l=><polygon key={l.id} points={l.polygon.map(p=>p.join(',')).join(' ')} className={'lot '+l.status.toLowerCase()+(l.id===selected?' selected':'')} tabIndex={onPoint?-1:0} role="button" aria-label={`Manzana ${l.block}, lote ${l.number}, ${l.status}`} onClick={e=>{if(onPoint)return;e.stopPropagation();onSelect(l);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(l);}}}><title>{`M${l.block} · L${l.number} · ${l.status}`}</title></polygon>)}
      {draft.length>0&&<polyline points={draft.map(p=>p.join(',')).join(' ')} className="draft-polygon"/>}
    </svg>
  </div></div>;
}
