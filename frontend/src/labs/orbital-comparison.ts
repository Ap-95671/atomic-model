import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {OrbitalViewer} from '../visualization/viewer';
import {LabSession,numberField,assumptions} from './session';
import {api} from '../services/api';
import {runtime} from '../services/runtime';
import {esc} from '../components/dom';
import {readRoute,writeRoute} from '../app/route';
import type {ElementData,OrbitalData,Species} from '../types';

/** Clones own GPU resources; disposing either pane cannot invalidate the other. */
function cloneScene(source:THREE.Scene){
 const scene=source.clone(true);
 scene.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.geometry)mesh.geometry=mesh.geometry.clone();if(mesh.material){const copy=(material:THREE.Material)=>{const cloned=material.clone() as THREE.SpriteMaterial;if(cloned.map)cloned.map=cloned.map.clone();return cloned;};mesh.material=Array.isArray(mesh.material)?mesh.material.map(copy):copy(mesh.material);}});
 return scene;
}
function disposeScene(scene:THREE.Scene){scene.traverse(object=>{const mesh=object as THREE.Mesh;mesh.geometry?.dispose();if(mesh.material)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){(material as THREE.SpriteMaterial).map?.dispose();material.dispose();}});scene.clear();}
const stateFields=(prefix:string,n:number,l:number)=>`<fieldset><legend>${prefix==='a'?'Left':'Right'} orbital</legend>${numberField(prefix+'n','Principal n',n,1,8)}${numberField(prefix+'l','Angular l (s=0, p=1, d=2, f=3)',l,0,3)}${numberField(prefix+'m','Real-basis index',0,-3,3)}</fieldset>`;
export function mountOrbitalComparison(host:HTMLElement,elements:ElementData[]){
 const session=new LabSession(host,'orbital-comparison','Orbital Comparison','Inspect two mathematical orbitals with independent camera controls. State selection does not prepare an excitation.',`<label>Neutral element<select name="z">${elements.map(e=>`<option value="${e.z}">${e.symbol} · ${e.name}</option>`).join('')}</select></label>${stateFields('a',1,0)}${stateFields('b',2,1)}<label>Representation<select name="mode"><option value="cloud">Probability samples</option><option value="surface">Amplitude isosurfaces</option></select></label><label>Scale<select name="scale"><option value="common">Common physical scale</option><option value="fit">Fit each pane independently</option></select></label><label>Color<select name="color"><option value="phase">Wavefunction sign</option><option value="density">Nonnegative density</option></select></label><label>Calculation quality<select name="quality"><option value="preview">Preview</option><option value="balanced">Balanced</option><option value="high">High detail</option></select></label><p class="lab-explanation">Quantum numbers must satisfy n ≥ 1, l &lt; n, |index| ≤ l. Many-electron shapes use illustrative Z_eff = 1; no many-electron excitation energies are inferred.</p>`);
 if(runtime.mode==='public'){const select=host.querySelector<HTMLSelectElement>('[name="quality"]')!;select.value='preview';[...select.options].forEach(o=>o.disabled=o.value!=='preview');}
 let viewer:OrbitalViewer|undefined,right:THREE.Scene|undefined,rightControls:OrbitControls|undefined;
 const release=()=>{rightControls?.dispose();rightControls=undefined;if(right){disposeScene(right);right=undefined;}viewer?.dispose();viewer=undefined;};
 // Keep the shared session cancellation/revision contract; combine the independent
 // reference/orbital reads in a small endpoint adapter owned by this lab.
 let revision=0,controller:AbortController|undefined,closed=false;
 const run=async()=>{
  if(!session.form.reportValidity())return;
  const current=++revision;controller?.abort();controller=new AbortController();release();const params=session.params();
  session.invalidate();session.status.setAttribute('role','status');session.status.textContent='Preparing both orbitals…';session.result.hidden=true;
  const z=Number(params.get('z'));
  try{
   const atom=await api<Species>(`/api/species?z=${z}&charge=0`,controller.signal);
   const request=(prefix:string)=>new URLSearchParams({z:String(z),a:String(atom.a),charge:'0',n:params.get(prefix+'n')!,l:params.get(prefix+'l')!,m:params.get(prefix+'m')!,basis:'real',mode:params.get('mode')!,quality:params.get('quality')!,points:'5000',threshold:'.06',zeff:'1'});
   const [left,dataRight]=await Promise.all([api<OrbitalData>(`/api/orbital?${request('a')}`,controller.signal),api<OrbitalData>(`/api/orbital?${request('b')}`,controller.signal)]);
   if(closed||current!==revision)return;
   const common=params.get('scale')==='common',extent=Math.max(left.extent,dataRight.extent),phase=params.get('color')==='phase';
   const label=(prefix:string,d:OrbitalData)=>{const n=Number(params.get(prefix+'n')),l=Number(params.get(prefix+'l')),m=Number(params.get(prefix+'m')),s=atom.electronic.occupancy.find(s=>s.n===n&&s.l===l),o=s?.orbitals.find(o=>o.m===m);return`${d.label} · ${o?.spins.length??0} reference electrons`;};
   session.result.innerHTML=`<div class="result-heading"><span class="method-badge">${esc(left.model)}</span><h2>${esc(atom.name)} · independent orbital views</h2><p>${common?'Both panes use the same physical length scale.':'Each pane fits its own frame; apparent sizes are not directly comparable.'}</p></div><div class="molecular-viewport comparison-viewport" data-comparison-view><div class="comparison-pane" data-pane="a" tabindex="0" aria-label="Left orbital camera: drag to rotate, scroll to zoom"><span>${esc(label('a',left))}</span></div><div class="comparison-pane" data-pane="b" tabindex="0" aria-label="Right orbital camera: drag to rotate, scroll to zoom"><span>${esc(label('b',dataRight))}</span></div><div class="comparison-scale">${common?`Common frame radius ${(extent*left.length_scale_a0).toFixed(3)} a₀`:`Separate radii: ${left.extent_a0.toFixed(3)} / ${dataRight.extent_a0.toFixed(3)} a₀`} · ${phase?'Cyan +ψ / amber −ψ':'|ψ|² ≥ 0'}</div></div><p class="body-copy">Left: ${left.nodes.radial} radial / ${left.nodes.angular} angular nodes. Right: ${dataRight.nodes.radial} radial / ${dataRight.nodes.angular} angular nodes. Each orbital is individually normalized. Empty reference orbitals are mathematical states, not occupied electrons.</p>${assumptions('One-electron nonrelativistic hydrogenic functions; reduced mass. Neutral many-electron shapes are illustrative hydrogenic Z_eff = 1, not self-consistent atomic orbitals. Real basis indices label tesseral functions, not definite Lz. Probability samples are possible measurements; isosurfaces are fractions of a sampled amplitude peak, not enclosed electron populations.')}`;
   const view=session.result.querySelector<HTMLElement>('[data-comparison-view]')!;
   try{
    viewer=new OrbitalViewer(view,()=>{});viewer.show(dataRight,atom,phase,false,common?extent:dataRight.extent);right=cloneScene(viewer.scene);viewer.show(left,atom,phase,false,common?extent:left.extent);
    const leftPane=view.querySelector<HTMLElement>('[data-pane="a"]')!,rightPane=view.querySelector<HTMLElement>('[data-pane="b"]')!;
    const target=viewer.controls.target.clone();viewer.controls.dispose();viewer.controls=new OrbitControls(viewer.camera,leftPane);viewer.controls.target.copy(target);viewer.controls.minDistance=.8;viewer.controls.maxDistance=50;viewer.controls.enableDamping=!matchMedia('(prefers-reduced-motion: reduce)').matches;viewer.controls.listenToKeyEvents(leftPane);viewer.controls.addEventListener('change',viewer.invalidate);viewer.controls.addEventListener('end',()=>view.dispatchEvent(new Event('qal-camera-change')));
    const camera=viewer.camera.clone();rightControls=new OrbitControls(camera,rightPane);rightControls.target.copy(target);rightControls.minDistance=.8;rightControls.maxDistance=50;rightControls.enableDamping=viewer.controls.enableDamping;rightControls.listenToKeyEvents(rightPane);rightControls.addEventListener('change',viewer.invalidate);
    try{const saved=JSON.parse(readRoute().get('rightCamera')??'null');if(saved&&[saved.position,saved.target].every((v:unknown)=>Array.isArray(v)&&v.length===3&&v.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<10000))){camera.position.fromArray(saved.position);rightControls.target.fromArray(saved.target);rightControls.update();}}catch{/* Optional camera state. */}
    rightControls.addEventListener('end',()=>{const p=readRoute();p.set('rightCamera',JSON.stringify({position:camera.position.toArray(),target:rightControls!.target.toArray()}));writeRoute(p);});
    viewer.setRenderOverride(()=>{if(!viewer||!right||!rightControls)return;const size=viewer.renderer.getSize(new THREE.Vector2()),half=size.x/2;viewer.camera.aspect=half/size.y;camera.aspect=half/size.y;viewer.camera.updateProjectionMatrix();camera.updateProjectionMatrix();if(rightControls.update())viewer.invalidate();viewer.renderer.setScissorTest(true);viewer.renderer.setViewport(0,0,half,size.y);viewer.renderer.setScissor(0,0,half,size.y);viewer.renderer.render(viewer.scene,viewer.camera);viewer.renderer.setViewport(half,0,half,size.y);viewer.renderer.setScissor(half,0,half,size.y);viewer.renderer.render(right,camera);viewer.renderer.setScissorTest(false);viewer.renderer.setViewport(0,0,size.x,size.y);});
   }catch(error){view.innerHTML=`<p class="webgl-fallback">3D unavailable: ${esc((error as Error).message)}. The orbital and model information remains available.</p>`;}
   session.result.hidden=false;session.status.textContent=runtime.static_demo?'Browser result ready.':'Calculation complete.';
  }catch(error){if(!closed&&current===revision&&(error as Error).name!=='AbortError'){session.status.setAttribute('role','alert');session.status.textContent=`Calculation failed: ${(error as Error).message}. Use Calculate to retry.`;}}
 };
 const invalidate=()=>{++revision;controller?.abort();release();};session.form.addEventListener('input',invalidate);session.form.addEventListener('change',invalidate);
 session.form.onsubmit=e=>{e.preventDefault();void run();};void run();return()=>{closed=true;++revision;controller?.abort();release();session.dispose();};
}
