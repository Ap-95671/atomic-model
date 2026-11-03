/** One short-lived worker per request. Abort/timeout terminates the computation.
 * No server API, persistent queue or scientific-result cache in static mode.
 */
export const staticDemo=import.meta.env.VITE_STATIC_DEMO==='true';
export function browserApi<T>(url:string,signal?:AbortSignal):Promise<T>{
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(new DOMException('Aborted','AbortError'));return;}
  const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
  let finished=false;
  const cleanup=()=>{if(finished)return;finished=true;clearTimeout(timer);worker.terminate();signal?.removeEventListener('abort',abort);};
  const abort=()=>{cleanup();reject(new DOMException('Aborted','AbortError'));};
  const timer=setTimeout(()=>{cleanup();reject(new Error('Browser calculation exceeded 15 seconds. Use a smaller model or the local Python engine.'));},15000);
  signal?.addEventListener('abort',abort,{once:true});
  worker.onmessage=event=>{cleanup();if(event.data.error)reject(new Error(event.data.error));else resolve(event.data.result);};
  worker.onerror=()=>{cleanup();reject(new Error('The browser scientific worker could not run. Reload, or use the local Python application.'));};
  worker.postMessage(url);
 });
}
export const staticCapabilities={mode:'public' as const,static_demo:true,advanced_computation:false,atomic_max_points:8000,atomic_qualities:['preview'],message:'BROWSER DEMO · Calculations run on your device. Atomic/H₂⁺/measurement/well/circuits calculate on this device; recorded HF examples are explicitly labeled. Advanced Python research remains local.'};
