import {$} from '../components/dom';
import {readRoute,writeRoute,rememberRoute,routeForLab,type Lab} from './route';
export type {Lab} from './route';
type Mount=(host:HTMLElement)=>()=>void;
const mounts=new Map<Lab,Mount>();
export function registerLab(lab:Lab,mount:Mount){mounts.set(lab,mount);}
/** Load optional tools on demand; old imports may finish after navigation. */
export function registerLazyLab(lab:Lab,load:()=>Promise<Mount>){
 let ready:Mount|undefined,pending:Promise<Mount>|undefined;
 registerLab(lab,host=>{
  // Native imports are asynchronous even when cached. Mount already-loaded
  // tools synchronously so repeat navigation doesn't wait another frame.
  if(ready)return ready(host);
  let closed=false,cleanup:(()=>void)|undefined;
  const start=()=>{
   host.innerHTML='<p class="module-loading" role="status">Preparing the laboratory…</p>';
   const request=pending??=load().then(mount=>{ready=mount;return mount;}).catch(error=>{pending=undefined;throw error;});
   void request.then(mount=>{if(!closed)cleanup=mount(host);}).catch(()=>{
    if(closed)return;
    host.innerHTML='<div class="callout" role="alert">The laboratory could not load. Check your connection and retry. <button class="secondary" data-retry-module>Retry</button></div>';
    host.querySelector<HTMLButtonElement>('[data-retry-module]')!.onclick=start;
   });
  };start();return()=>{closed=true;cleanup?.();};
 });
}
/** One mounted lab lifetime. Re-selecting it is a no-op, never a fresh job. */
export function initializeNavigation(actions:{guide:()=>void;atomic?:(active:boolean,route:URLSearchParams)=>void}){
 const nav=document.createElement('nav');nav.className='lab-nav';nav.setAttribute('aria-label','Scientific laboratories');
 const items=[['home','Overview'],['atomic','Atomic Explorer'],['periodic','Periodic Table'],['compare','Orbital Comparison'],['molecular','Molecular Lab'],['dynamics','Quantum Dynamics'],['spectroscopy','Spectroscopy'],['experiments','Quantum Experiments'],['computation','Computational Chemistry'],['materials','Quantum Materials'],['history','Atomic Theory'],['guide','Scientific Guide']];
 let cleanup:(()=>void)|undefined,current:string|undefined;
 const display=(route:URLSearchParams,force=false)=>{
  const lab=route.get('lab') as Lab;if(!force&&lab===current)return;
  cleanup?.();cleanup=undefined;current=lab;
  const home=lab==='home';document.body.dataset.page=lab;
  $('home-workspace').hidden=!home;
  $('atomic-workspace').hidden=lab!=='atomic';$('lab-workspace').hidden=lab==='atomic'||home;
  // Move the existing viewer, preserving its WebGL context and scientific data.
  if(home)$('home-scene').append($('viewport'));
  else document.querySelector('.center-panel')!.prepend($('viewport'));
  nav.querySelectorAll<HTMLButtonElement>('[data-lab]').forEach(b=>{if(b.dataset.lab==='guide')return;const selected=b.dataset.lab===lab;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
  actions.atomic?.(lab==='atomic'||home,route);
  if(lab!=='atomic'&&!home)cleanup=mounts.get(lab)?.($('lab-workspace'));else $('lab-workspace').replaceChildren();
  document.title=`${items.find(([key])=>key===lab)?.[1]??'Workspace'} · Quantum Atom Lab`;
 };
 for(const [key,name] of items){const button=document.createElement('button');button.textContent=name;button.dataset.lab=key;button.onclick=()=>{
  if(key==='guide'){actions.guide();return;}if(current===key)return;
  rememberRoute();const next=routeForLab(key as Lab);writeRoute(next,true);display(next);
 };nav.append(button);}
 $('atomic-workspace').before(nav);
 const restore=()=>{const p=readRoute();writeRoute(p);display(p,true);};
 // Every supported route lives in the fragment. Back/Forward and direct hash
 // edits emit hashchange; pushState calls above mount explicitly, exactly once.
 window.addEventListener('hashchange',restore);
 restore();
 window.addEventListener('pagehide',()=>{cleanup?.();cleanup=undefined;},{once:true});
}
