import {lazy,Suspense} from 'react';
import PublicPortal from './PublicPortal';
import './App.css';
const Admin=lazy(()=>import('./Admin'));
export default function App(){return location.pathname.startsWith('/admin')?<Suspense fallback={<div className="empty">Cargando panel…</div>}><Admin/></Suspense>:<PublicPortal/>;}
