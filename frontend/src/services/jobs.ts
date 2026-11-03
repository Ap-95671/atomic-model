import {ResultCache,stableKey} from './result-cache';
const completed=new ResultCache(16*1024*1024,12,60000);
export interface Job<T=unknown> {
  id:string;calculation_id:string;status:'queued'|'running'|'cancelling'|'succeeded'|'failed'|'cancelled'|'timed_out';
  stage:string;elapsed_seconds:number;progress:{stage:string;iteration?:number;total_energy_hartree?:number}[];
  result?:T;error?:string;
}
async function json<T>(url:string,init?:RequestInit,timeoutMs=15_000):Promise<T>{
  const timeout=AbortSignal.timeout(timeoutMs),signal=init?.signal?AbortSignal.any([init.signal,timeout]):timeout;
  const response=await fetch(url,{...init,signal});
  const body=await response.json();if(!response.ok){if(response.status===410)completed.clear();throw new Error(body.error||`HTTP ${response.status}`);}return body as T;
}
const pause=(signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{
  const finish=()=>{signal.removeEventListener('abort',cancel);resolve();};
  const timer=setTimeout(finish,250);
  const cancel=()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'));};
  if(signal.aborted){cancel();return;}signal.addEventListener('abort',cancel,{once:true});
});
/** Server jobs outlive HTTP requests; revision ownership cancels late POST replies too. */
export class JobClient {
  private revision=0;private id?:string;private controller?:AbortController;
  constructor(private requestTimeoutMs=15000,private deadlineMs=105000){}
  async cancel(){
    ++this.revision;this.controller?.abort();const id=this.id;this.id=undefined;
    if(id)return json<Job>(`/api/jobs/${id}`,{method:'DELETE'});
  }
  async run<T>(body:unknown,progress:(job:Job<T>)=>void):Promise<Job<T>>{
    const cancelling=this.cancel(),revision=this.revision;await cancelling;
    if(revision!==this.revision)throw new DOMException('Cancelled','AbortError');
    const key=stableKey(body),cached=completed.get(key);if(cached){const job=JSON.parse(cached) as Job<T>;progress({...job,stage:'Reused identical completed calculation'});return job;}
    // Do not abort the short POST: retain its ID so a late response can be cancelled.
    const created=await json<Job<T>>('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},this.requestTimeoutMs);
    if(revision!==this.revision){await json(`/api/jobs/${created.id}`,{method:'DELETE'});throw new DOMException('Cancelled','AbortError');}
    this.id=created.id;this.controller=new AbortController();const signal=this.controller.signal;
    const deadline=AbortSignal.timeout(this.deadlineMs),pollSignal=AbortSignal.any([signal,deadline]);
    let job=created;
    try{while(true){
      if(revision!==this.revision)throw new DOMException('Cancelled','AbortError');
      progress(job);
      if(job.status==='succeeded'){this.id=undefined;completed.set(key,JSON.stringify(job));return job;}
      if(['failed','cancelled','timed_out'].includes(job.status)){this.id=undefined;throw new Error(job.error||job.stage);}
      await pause(pollSignal);job=await json<Job<T>>(`/api/jobs/${created.id}`,{signal:pollSignal},this.requestTimeoutMs);
    }}catch(error){
      if(revision===this.revision){this.id=undefined;this.controller?.abort();await json(`/api/jobs/${created.id}`,{method:'DELETE'},this.requestTimeoutMs).catch(()=>{});}
      if(deadline.aborted)throw new Error('Calculation deadline reached; stop requested for this job. Try a smaller model.');
      if((error as Error).name==='TimeoutError')throw new Error('Job status request timed out; stop requested for this job. Retry the calculation.');
      throw error;
    }
  }
}
