import {$} from '../components/dom';
import {readRoute,writeRoute,rememberRoute,routeForLab,type Lab} from './route';
export type {Lab} from './route';
type Mount=(host:HTMLElement)=>()=>void;
const mounts=new Map<Lab,Mount>();
export function registerLab(lab:Lab,mount:Mount){mounts.set(lab,mount);}
/** One mounted lab lifetime. Re-selecting it is a no-op, never a fresh job. */
export function initializeNavigation(actions:{guide:()=>void;atomic?:(active:boolean,route:URLSearchParams)=>void}){
 const nav=document.createElement('nav');nav.className='lab-nav';nav.setAttribute('aria-label','Scientific laboratories');
 const items=[['atomic','Atomic Explorer'],['molecular','Molecular Lab'],['dynamics','Quantum Dynamics'],['spectroscopy','Spectroscopy'],['experiments','Quantum Experiments'],['computation','Computational Chemistry'],['materials','Quantum Materials'],['guide','Scientific Guide']];
 let cleanup:(()=>void)|undefined,current:string|undefined;
 const display=(route:URLSearchParams,force=false)=>{
  const lab=route.get('lab') as Lab;if(!force&&lab===current)return;
  cleanup?.();cleanup=undefined;current=lab;
  $('atomic-workspace').hidden=lab!=='atomic';$('lab-workspace').hidden=lab==='atomic';
  nav.querySelectorAll<HTMLButtonElement>('[data-lab]').forEach(b=>{if(b.dataset.lab==='guide')return;const selected=b.dataset.lab===lab;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
  actions.atomic?.(lab==='atomic',route);
  if(lab!=='atomic')cleanup=mounts.get(lab)?.($('lab-workspace'));else $('lab-workspace').replaceChildren();
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
