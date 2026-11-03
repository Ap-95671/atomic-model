import {readCache,cacheKey} from './result-cache';
import {runtime} from './runtime';
/** One cancellation/timeout/error contract; bounded public busy/rate backoff. */
export async function api<T>(url:string,signal?:AbortSignal):Promise<T>{
 if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 const key=cacheKey(url),cached=key?readCache.get(key):undefined;if(cached!==undefined)return JSON.parse(cached) as T;
 if(import.meta.env.VITE_STATIC_DEMO==='true'){
  const value=await(await import('../static/client')).browserApi<T>(url,signal);
  if(key)readCache.set(key,JSON.stringify(value));return value;
 }

 const timeout=AbortSignal.timeout(30_000),combined=signal?AbortSignal.any([signal,timeout]):timeout;
 const pause=(milliseconds:number)=>new Promise<void>((resolve,reject)=>{
  if(combined.aborted){reject(new DOMException('Aborted','AbortError'));return;}
  const abort=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));};
  const timer=setTimeout(()=>{combined.removeEventListener('abort',abort);resolve();},milliseconds);
  combined.addEventListener('abort',abort,{once:true});
 });
 try{
  for(let attempt=0;attempt<3;attempt++){
   const response=await fetch(url,{signal:combined});
   const json=response.headers.get('content-type')?.includes('application/json');
   const raw=json?await response.text():undefined;
   const body=raw?JSON.parse(raw):{error:response.status===503?'The scientific server is busy. Retry shortly.':`HTTP ${response.status}`};
   const retry=response.headers.get('retry-after');
   if(runtime.mode==='public'&&attempt<2&&(response.status===429||response.status===503)&&(retry||!json)){
    const seconds=Math.min(5,Math.max(1,Number(retry)||1));await pause(seconds*1000);continue;
   }
   if(!response.ok)throw new Error(body.error||`HTTP ${response.status}`);
   if(key&&raw)readCache.set(key,raw);
   return body as T;
  }
  throw new Error('Public demo is busy. Wait and retry.');
 }catch(error){
  if(timeout.aborted&&!signal?.aborted)throw new Error('Calculation timed out after 30 seconds. Try a smaller calculation.');
  throw error;
 }
}
