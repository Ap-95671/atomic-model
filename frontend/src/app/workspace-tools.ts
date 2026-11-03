import {$,esc} from '../components/dom';
import {modal,closeModal} from '../components/dialog';
import type {ElementData} from '../types';
import {labNames,readRoute} from './route';

const destinations=[
 ['Atomic Explorer','lab=atomic','Atoms, electron configurations, orbitals'],
 ['Periodic Table','lab=periodic','Elements, properties, periodic trends and ground-state orbitals'],
 ['Orbital Comparison','lab=compare','Independent orbital cameras and common physical scale'],
 ['Molecular Lab','lab=molecular','Calculated molecular orbitals'],
 ['Molecular structures','lab=molecular&tool=structures','Water, methane, benzene and other source conformers'],
 ['MO reference diagrams','lab=molecular&tool=diagrams','Occupancy, bonding, spin'],
 ['Spectroscopy','lab=spectroscopy','Emission, absorption, photon wavelengths'],
 ['Quantum Dynamics','lab=dynamics','Wavefunction evolution'],
 ['Quantum Experiments','lab=experiments','Measurement, tunneling, fields, qubits'],
 ['Position measurements','lab=experiments&tool=measurement','Born-rule batches and histograms'],
 ['Quantum tunneling','lab=experiments&tool=tunneling','Gaussian packet and a finite barrier · local Python engine'],
 ['Fields and spin','lab=experiments&tool=fields','Stark, Zeeman and angular momentum · local Python engine'],
 ['Quantum circuits','lab=experiments&tool=quantum&sub=circuits','Qubits, gates and measurements'],
 ['Computational Chemistry','lab=computation','Hartree–Fock and optional local solvers'],
 ['Quantum Materials','lab=materials','Illustrative tight-binding bands'],
 ['Atomic Theory','lab=history','Timeline and side-by-side model comparison'],
];
interface Preset{name:string;hash:string}
const storageKey='qal-experiments-v1';
function presets():Preset[]{
 try{const data:unknown=JSON.parse(localStorage.getItem(storageKey)??'[]');
  if(!Array.isArray(data))return[];
  return data.filter((v):v is Preset=>!!v&&typeof v.name==='string'&&v.name.length<=60&&typeof v.hash==='string'&&v.hash.startsWith('#')&&v.hash.length<=16000&&labNames.includes(new URLSearchParams(v.hash.slice(1)).get('lab') as typeof labNames[number])).slice(0,12);
 }catch{return[];}
}
export function initializeWorkspaceTools(getElements:()=>ElementData[],selectElement:(z:number)=>void){
 const setTheme=(theme:string)=>{
  document.documentElement.dataset.theme=theme;
  $('theme-toggle').textContent=theme==='light'?'◐':'◑';
  $('theme-toggle').setAttribute('aria-label',`Switch to ${theme==='light'?'dark':'light'} theme`);
  try{localStorage.setItem('qal-theme',theme);}catch{/* Optional preference. */}
 };
 let theme='dark';try{theme=localStorage.getItem('qal-theme')??(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');}catch{/* Device defaults. */}
 setTheme(theme==='light'?'light':'dark');
 $('theme-toggle').onclick=()=>setTheme(document.documentElement.dataset.theme==='light'?'dark':'light');

 const search=()=>{
  modal('Find your next experiment',`<label class="command-label">Search elements and laboratories<input id="command-input" role="combobox" aria-expanded="true" aria-controls="command-results" aria-autocomplete="list" type="search" placeholder="Try carbon, orbitals, or spectroscopy…" autocomplete="off" autofocus></label><div id="command-results" class="command-results" role="listbox" aria-label="Search results"></div><p id="command-status" class="body-copy" role="status"></p><p class="body-copy">↑ ↓ to choose · Enter to open · Esc to close</p>`,'COMMAND SEARCH');
  const input=$<HTMLInputElement>('command-input');let selected=0;
  const draw=()=>{
   const query=input.value.trim().toLowerCase();
   const entries=destinations.filter(d=>d.join(' ').toLowerCase().includes(query)).map(([name,hash,description])=>({name,description,hash,z:0}));
   if(query)entries.push(...getElements().filter(e=>`${e.z} ${e.symbol} ${e.name}`.toLowerCase().includes(query)).slice(0,10).map(e=>({name:`${e.symbol} · ${e.name}`,description:`Element ${e.z} · ${e.configuration}`,hash:'',z:e.z})));
   selected=0;
   $('command-results').innerHTML=entries.map((e,i)=>`<button role="option" tabindex="-1" data-command="${i}"><strong>${esc(e.name)}</strong><span>${esc(e.description)}</span><span aria-hidden="true">↗</span></button>`).join('');
   $('command-status').textContent=entries.length?`${entries.length} results`:'No matches. Try an element name or laboratory.';
   const buttons=[...$('command-results').querySelectorAll<HTMLButtonElement>('button')];
   const highlight=()=>{buttons.forEach((button,i)=>{button.classList.toggle('selected',i===selected);button.id=`command-result-${i}`;button.setAttribute('aria-selected',String(i===selected));});if(buttons.length)input.setAttribute('aria-activedescendant',buttons[selected].id);else input.removeAttribute('aria-activedescendant');};highlight();
   buttons.forEach((button,i)=>button.onclick=()=>{const e=entries[i];closeModal();if(e.z)selectElement(e.z);else location.hash=e.hash;});
   input.onkeydown=e=>{
    if(e.key==='Escape'){e.preventDefault();closeModal();return;}
    if(!buttons.length)return;
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();selected=(selected+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;highlight();buttons[selected].scrollIntoView({block:'nearest'});}
    if(e.key==='Enter'){e.preventDefault();buttons[selected].click();}
   };
  };
  input.oninput=draw;draw();input.focus();
 };
 $('command-search').onclick=search;
 window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();search();}});
 $('share-experiment').onclick=async()=>{
  try{await navigator.clipboard.writeText(location.href);$('share-experiment').textContent='Copied';setTimeout(()=>{$('share-experiment').textContent='Share ↗';},2000);}
  catch{modal('Share this experiment',`<p class="body-copy">Copy this URL to restore the selected laboratory and parameters.</p><label class="command-label">Experiment URL<textarea readonly rows="5">${esc(location.href)}</textarea></label>`,'REPRODUCIBLE SELECTION');}
 };
 $('experiment-presets').onclick=()=>{
  const render=()=>{
   const saved=presets();
   modal('Your experiment shelf',`<p class="body-copy">Save up to 12 experiment selections on this device. Camera settings are included where available. Calculation results are not stored.</p><form id="preset-form" class="preset-form"><label>Preset name<input name="name" maxlength="60" required placeholder="e.g. Carbon ground state"></label><button class="primary" type="submit">Save current</button></form><p id="preset-status" role="status"></p><div class="preset-list">${saved.map((p,i)=>`<div><a href="${esc(p.hash)}" data-preset-open>${esc(p.name)}</a><button data-preset-delete="${i}" aria-label="Delete ${esc(p.name)}">×</button></div>`).join('')||'<p class="body-copy">No saved experiments yet.</p>'}</div>`,'LOCAL PRESETS');
   $('preset-form').onsubmit=e=>{e.preventDefault();const input=$<HTMLInputElement>('preset-form').querySelector<HTMLInputElement>('input')!;const name=input.value.trim();if(!name)return;
    if(saved.length>=12){$('preset-status').textContent='Delete a preset before saving another.';return;}
    if(readRoute().get('lab')==='home'){$('preset-status').textContent='Open a laboratory before saving an experiment.';return;}
    try{localStorage.setItem(storageKey,JSON.stringify([...saved,{name,hash:location.hash}]));render();$('preset-status').textContent='Experiment saved on this device.';}catch{$('preset-status').textContent='Local storage is unavailable.';}
   };
   document.querySelectorAll<HTMLAnchorElement>('[data-preset-open]').forEach(a=>a.onclick=()=>closeModal());
   document.querySelectorAll<HTMLButtonElement>('[data-preset-delete]').forEach(b=>b.onclick=()=>{try{saved.splice(Number(b.dataset.presetDelete),1);localStorage.setItem(storageKey,JSON.stringify(saved));render();}catch{$('preset-status').textContent='Local storage is unavailable.';}});
  };render();
 };
}

/** CSS presentation mode also works where native Fullscreen API is unavailable. */
export function initializePresentation(){
 const button=$('presentation');let returnFocus:HTMLElement|null=null;
 const exit=()=>{document.body.classList.remove('presenting');button.setAttribute('aria-pressed','false');button.setAttribute('aria-label','Enter presentation mode');returnFocus?.focus();};
 button.onclick=async()=>{
  if(document.body.classList.contains('presenting')){if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});exit();return;}
  returnFocus=document.activeElement as HTMLElement;document.body.classList.add('presenting');button.setAttribute('aria-pressed','true');button.setAttribute('aria-label','Exit presentation mode');
  await $('viewport').requestFullscreen?.().catch(()=>{/* CSS mode remains available. */});
 };
 document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)exit();});
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('presenting')){exit();if(document.fullscreenElement)void document.exitFullscreen();}});
}
