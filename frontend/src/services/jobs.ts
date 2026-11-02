export interface Job<T=unknown> {
  id:string;calculation_id:string;status:'queued'|'running'|'cancelling'|'succeeded'|'failed'|'cancelled'|'timed_out';
  stage:string;elapsed_seconds:number;progress:{stage:string;iteration?:number;total_energy_hartree?:number}[];
  result?:T;error?:string;
}
async function json<T>(url:string,init?:RequestInit):Promise<T>{
  const response=await fetch(url,{...init,signal:init?.signal??AbortSignal.timeout(15_000)});
  const body=await response.json();if(!response.ok)throw new Error(body.error||`HTTP ${response.status}`);return body as T;
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
  async cancel(){
    ++this.revision;this.controller?.abort();const id=this.id;this.id=undefined;
    if(id)return json<Job>(`/api/jobs/${id}`,{method:'DELETE'});
  }
  async run<T>(body:unknown,progress:(job:Job<T>)=>void):Promise<Job<T>>{
    await this.cancel();const revision=++this.revision;
    // Do not abort the short POST: retain its ID so a late response can be cancelled.
    const created=await json<Job<T>>('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(revision!==this.revision){await json(`/api/jobs/${created.id}`,{method:'DELETE'});throw new DOMException('Cancelled','AbortError');}
    this.id=created.id;this.controller=new AbortController();const signal=this.controller.signal;
    let job=created;
    while(true){
      if(revision!==this.revision)throw new DOMException('Cancelled','AbortError');
      progress(job);
      if(job.status==='succeeded'){this.id=undefined;return job;}
      if(['failed','cancelled','timed_out'].includes(job.status)){this.id=undefined;throw new Error(job.error||job.stage);}
      await pause(signal);job=await json<Job<T>>(`/api/jobs/${created.id}`,{signal});
    }
  }
}
