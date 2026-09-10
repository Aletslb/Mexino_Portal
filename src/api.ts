export async function api<T>(path:string, init?:RequestInit):Promise<T> {
  const response=await fetch(path,{...init,credentials:'same-origin',headers:{...init?.headers}});
  if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('No se pudo conectar. Inicia sesión nuevamente o intenta más tarde.');
  const body=await response.json();if(!response.ok)throw new Error(body.error||'No se pudo completar la operación.');return body;
}
export const saveRecord=<T>(kind:string,data:T)=>api<T>(`/api/admin/${kind}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
export async function uploadImage(file:File):Promise<string> {
  const result=await api<{url:string}>('/api/admin/uploads',{method:'POST',headers:{'Content-Type':file.type},body:file});return result.url;
}
