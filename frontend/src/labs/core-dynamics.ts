import {LabSession,numberField,assumptions} from './session';
import {plot} from '../components/plot';
import {Playback} from '../components/playback';
import {download,csv,plotPng} from '../services/export';
import {esc} from '../components/dom';
import {OrbitalViewer} from '../visualization/viewer';
interface Data{
 model:string;assumptions:string;coefficients:{real:number;imag:number}[];energies_hartree:number[];max_norm_error:number;overlap_error:number;
 states:number[]|number[][];times_au:number[];period_au?:number;revival_au?:number;expectation_xyz_a0?:number[][];expectation_x_a0?:number[];
 x_a0?:number[];basis?:number[][];position_matrix_a0?:number[][];length_a0?:number;position_quadrature_error_a0?:number;
 points?:number[][];extent?:number;basis_real?:number[][];basis_imag?:number[][];proposal_density?:number[];
 axis_z_a0?:number[];line_basis_real?:number[][];line_basis_imag?:number[][];
}
export function mountCoreDynamics(host:HTMLElement,atomic=false){
 const session=new LabSession(host,atomic?'atomic-dynamics':'general-well',atomic?'3D Atomic Superpositions':'General Well Superpositions',atomic?'Evolve selected hydrogenic eigenstates and inspect calculated 3D density, phase and position expectations.':'Edit up to eight normalized complex coefficients and evolve them exactly in a hard-wall well.',`<label>Basis states / JSON<input name="states" value='${atomic?'[[1,0,0],[2,1,0]]':'[1,2,3,4]'}' required></label><label>Real coefficients / JSON<input name="real" value='${atomic?'[1,1]':'[1,1,0.5,0.25]'}' required></label><label>Imaginary coefficients / JSON<input name="imag" value='${atomic?'[0,0]':'[0,0,0,0]'}' required></label>${atomic?'<label>Spherical quadrature<select name="quality"><option value="preview">Preview · 24 radial nodes</option><option value="balanced" selected>Balanced · 48 nodes</option><option value="high">High · 80 nodes</option></select></label>':`${numberField('length','Well length / a₀',10,2,30,.1)}<label>Spatial samples<select name="grid"><option>129</option><option selected>257</option><option>513</option></select></label>`}<p class="lab-explanation">${atomic?'Atomic triples are [n,l,m], n≤2 in the complex spherical-harmonic basis. One to four distinct states.':'Choose distinct integer n=1…16; one to eight states.'} Coefficient lists must match the states; they normalize automatically. Set all but one coefficient to zero to inspect stationary density.</p>`);
 let playback:Playback|undefined,viewer:OrbitalViewer|undefined;session.form.addEventListener('input',()=>playback?.pause());session.form.addEventListener('change',()=>playback?.pause());
 const calculate=()=>{
  if(!session.form.reportValidity())return;playback?.dispose();viewer?.dispose();viewer=undefined;const p=session.params();let parameters:Record<string,unknown>;
  try{parameters={states:JSON.parse(p.get('states')!),real:JSON.parse(p.get('real')!),imag:JSON.parse(p.get('imag')!),...(atomic?{quality:p.get('quality')}:{length:Number(p.get('length')),grid:Number(p.get('grid'))})};}catch{session.invalidate();session.status.textContent='Invalid JSON arrays; use numeric entries such as [1,2].';return;}
  const query=new URLSearchParams({operation:atomic?'atomic':'well',parameters:JSON.stringify(parameters)});
  void session.run<Data>(`/api/physics?${query}`,d=>{
   session.result.innerHTML=`<div class="result-heading"><span class="method-badge">${esc(d.model)}</span><h2>${atomic?'Calculated 3D interference':'Normalized finite-state evolution'}</h2></div>${atomic?'<div class="molecular-viewport" data-atomic-time-view><div class="molecular-legend">Importance-weighted brightness ∝ |Ψ|²/q<br>Cyclic color: arg Ψ · lengths a₀ · fixed sample positions</div></div>':''}<div data-playback></div><dl class="result-metrics"><div><dt>Max quadrature norm error</dt><dd>${d.max_norm_error.toExponential(3)}</dd></div><div><dt>Basis overlap error</dt><dd>${d.overlap_error.toExponential(3)}</dd></div><div><dt>${atomic?'Time / atomic units':'Position quadrature error'}</dt><dd data-current>${atomic?'0':d.position_quadrature_error_a0!.toExponential(3)+' a₀'}</dd></div></dl><div data-density></div><div data-phase></div>${plot(atomic?(['x','y','z'].map((s,k)=>({label:`⟨${s}⟩`,x:d.times_au,y:d.expectation_xyz_a0!.map(v=>v[k]),color:['#68cce7','#efad79','#9bd6b6'][k]}))):[{label:'Exact ⟨x⟩',x:d.times_au,y:d.expectation_x_a0!,color:'#68cce7'}],'Time / atomic units','Position expectation / a₀','Time-dependent position expectations')}<div class="lab-actions">${atomic?'<button data-camera>Reset camera</button><button data-image>Export atomic PNG</button>':''}<button data-json>Export dynamics JSON</button><button data-csv>Export expectation CSV</button><button data-plot>Export density PNG</button></div>${assumptions(d.assumptions)}`;
   if(atomic){const view=session.result.querySelector<HTMLElement>('[data-atomic-time-view]')!;try{viewer=new OrbitalViewer(view,()=>{});viewer.showWeightedCloud(d.points!,d.extent!);}catch{view.textContent='WebGL unavailable. Calculated line density and expectations remain available.';}}
   const evolve=(real:number[][],imag:number[][]|undefined,time:number)=>{
    const co=d.coefficients.map((v,i)=>{const a=-d.energies_hartree[i]*time;return [v.real*Math.cos(a)-v.imag*Math.sin(a),v.real*Math.sin(a)+v.imag*Math.cos(a)];});
    return real[0].map((_,p)=>{let re=0,im=0;co.forEach((v,j)=>{const a=real[j][p],b=imag?.[j][p]??0;re+=v[0]*a-v[1]*b;im+=v[0]*b+v[1]*a;});return{density:re*re+im*im,phase:Math.atan2(im,re)};});
   };
   const axis=atomic?d.axis_z_a0!:d.x_a0!,real=atomic?d.line_basis_real!:d.basis!,imag=atomic?d.line_basis_imag:undefined;
   const draw=(time:number)=>{
    const line=evolve(real,imag,time);
    session.result.querySelector('[data-density]')!.innerHTML=plot([{label:atomic?'|Ψ(0,0,z,t)|²':'|Ψ(x,t)|²',x:axis,y:line.map(v=>v.density),color:'#68cce7'}],atomic?'z / a₀':'Position / a₀',atomic?'Line density / a₀⁻³':'Density / a₀⁻¹',atomic?'Axial cut (not a radial probability distribution)':'Calculated well probability density',atomic?[0,Math.max(...real[0].map((_,i)=>d.coefficients.reduce((sum,c,j)=>sum+Math.hypot(c.real,c.imag)*Math.hypot(real[j][i],imag?.[j][i]??0),0)**2))*1.05]:[0,2*d.coefficients.length/d.length_a0!]);
    session.result.querySelector('[data-phase]')!.innerHTML=plot([{label:'arg Ψ (zero-amplitude samples shown as 0)',x:axis,y:line.map(v=>v.density<1e-15?0:v.phase),color:'#efad79'}],atomic?'z / a₀':'Position / a₀','Phase / rad','Complex phase; undefined at nodes',[-Math.PI,Math.PI]);
    if(atomic){const cloud=evolve(d.basis_real!,d.basis_imag!,time);viewer?.updateWeightedCloud(cloud.map((v,i)=>Math.min(1,v.density/(d.coefficients.length*d.proposal_density![i]))),cloud.map(v=>v.phase));session.result.querySelector('[data-current]')!.textContent=time.toFixed(5);}
   };
   const max=d.period_au??d.revival_au!;playback=new Playback(session.result.querySelector('[data-playback]')!,max,max/12,draw);
   session.result.querySelector('[data-camera]')?.addEventListener('click',()=>viewer?.reset());session.result.querySelector('[data-image]')?.addEventListener('click',()=>{if(viewer){const a=document.createElement('a');a.download='atomic-superposition.png';a.href=viewer.screenshot(d.model,'Lengths a₀; density brightness importance weighted; nucleus schematic','Cyclic phase color; fixed positions are display samples, not electron trajectories.');a.click();}});
   session.result.querySelector('[data-json]')!.addEventListener('click',()=>download('quantum-dynamics.json',JSON.stringify(d,null,2),'application/json'));
   session.result.querySelector('[data-csv]')!.addEventListener('click',()=>csv('quantum-expectations.csv',d.model,query.toString(),atomic?[['time_au','mean_x_a0','mean_y_a0','mean_z_a0'],...d.times_au.map((t,i)=>[t,...d.expectation_xyz_a0![i]])]:[['time_au','mean_x_a0'],...d.times_au.map((t,i)=>[t,d.expectation_x_a0![i]])]));
   session.result.querySelector('[data-plot]')!.addEventListener('click',()=>void plotPng(session.result.querySelector('[data-density] svg')!,'dynamics-density.png').catch(e=>session.status.textContent=String(e)));
  });
 };session.form.onsubmit=e=>{e.preventDefault();calculate();};calculate();return()=>{playback?.dispose();viewer?.dispose();session.dispose();};
}
