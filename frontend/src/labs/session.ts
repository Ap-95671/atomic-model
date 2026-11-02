import { esc } from '../components/dom';
import { api } from '../services/api';

/** Mounted lab lifetime: superseded requests, status, validation and local presets. */
export class LabSession {
  private controller?: AbortController;
  private revision=0;
  private closed=false;
  private original: Record<string,string>={};
  readonly status: HTMLElement;
  readonly result: HTMLElement;
  constructor(readonly host: HTMLElement, readonly key: string, title: string, description: string, controls: string) {
    host.innerHTML=`<div class="lab-heading"><div><span class="eyebrow">QUANTUM ATOM LAB / ${esc(key.toUpperCase())}</span><h1 tabindex="-1">${esc(title)}</h1><p>${esc(description)}</p></div></div><div class="lab-layout"><aside class="lab-controls"><form>${controls}<div class="lab-actions"><button type="submit" class="primary">Calculate</button><button type="button" data-save>Save parameters</button><button type="button" data-restore>Restore saved</button><button type="button" data-defaults>Defaults</button></div></form><p class="lab-status" role="status" aria-live="polite">Ready.</p></aside><section class="lab-results" aria-label="Scientific results"><div data-result></div></section></div>`;
    this.status=host.querySelector('.lab-status')!; this.result=host.querySelector('[data-result]')!;
    for(const el of this.inputs())this.original[el.name]=el.value;
    host.querySelector('[data-save]')!.addEventListener('click',()=>{
      if(!this.form.reportValidity())return;
      try {localStorage.setItem(`quantum-lab:${key}:v1`,JSON.stringify(Object.fromEntries(this.inputs().map(i=>[i.name,i.value]))));this.status.textContent='Parameters saved on this device.';}
      catch {this.status.textContent='Local storage is unavailable.';}
    });
    host.querySelector('[data-restore]')!.addEventListener('click',()=>{
      try {const stored=localStorage.getItem(`quantum-lab:${key}:v1`); if(!stored){this.status.textContent='No saved parameters for this experiment.';return;} this.restore(JSON.parse(stored));}
      catch {this.status.textContent='Saved parameters could not be read.';}
    });
    host.querySelector('[data-defaults]')!.addEventListener('click',()=>this.restore(this.original));
    this.form.addEventListener('input',()=>this.invalidate());
    this.form.addEventListener('change',()=>this.invalidate());
  }
  get form(){return this.host.querySelector('form')!;}
  inputs(){return [...this.host.querySelectorAll<HTMLInputElement|HTMLSelectElement>('form [name]')];}
  params(){return new URLSearchParams(this.inputs().map(i=>[i.name,i.value]));}
  private restore(values: unknown){
    if(!values || typeof values!=='object')throw new Error('Invalid configuration');
    for(const input of this.inputs()){
      const value=(values as Record<string,unknown>)[input.name];
      if(typeof value==='string' && value.length<100)input.value=value;
    }
    this.invalidate(); this.form.requestSubmit();
  }
  invalidate(){
    this.controller?.abort(); ++this.revision;
    this.status.setAttribute('role','status');
    this.status.textContent='Parameters changed. Calculate to update the results.';
    this.result.hidden=true;
    this.host.querySelector('.lab-results')?.setAttribute('aria-busy','false');
  }
  async run<T>(path: string, render: (data:T)=>void){
    this.controller?.abort(); this.controller=new AbortController();const id=++this.revision;
    this.result.hidden=true;
    this.status.setAttribute('role','status');this.status.textContent='Calculating…';
    this.host.querySelector('.lab-results')?.setAttribute('aria-busy','true');
    try {
      const data=await api<T>(path,this.controller.signal);
      if(this.closed || id!==this.revision)return;
      render(data);this.result.hidden=false;this.status.textContent='Calculation complete.';
    } catch(error){
      if(this.closed || id!==this.revision || (error as Error).name==='AbortError')return;
      this.status.setAttribute('role','alert');this.status.textContent=`Calculation failed: ${(error as Error).message}`;
    } finally {
      if(!this.closed && id===this.revision)this.host.querySelector('.lab-results')?.setAttribute('aria-busy','false');
    }
  }
  dispose=()=>{this.closed=true;this.controller?.abort();++this.revision;};
}
export const numberField=(name:string,label:string,value:number,min:number,max:number,step=1)=>`<label>${label}<input name="${name}" type="number" value="${value}" min="${min}" max="${max}" step="${step}" required></label>`;
export const speciesField=`<label>One-electron species<select name="species"><option value="h">Hydrogen-1</option><option value="he">Helium-4 ion He⁺</option></select></label>`;
export const speciesParams=(params:URLSearchParams)=>{
  const he=params.get('species')==='he';params.delete('species');params.set('z',he?'2':'1');params.set('a',he?'4':'1');params.set('charge',he?'1':'0');return params;
};
export const assumptions=(body:string)=>`<details class="assumptions" open><summary>Scientific assumptions & interpretation</summary><p>${esc(body)}</p></details>`;
