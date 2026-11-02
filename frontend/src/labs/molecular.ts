import { mountStructures } from "./structures";
import { mountDiagrams } from "./diagrams";
import { LabSession, numberField, assumptions } from './session';
import { esc } from '../components/dom';
import { plot } from '../components/plot';
import { OrbitalViewer } from '../visualization/viewer';
import type { MeshData } from '../types';
import { csv, download } from '../services/export';
interface Molecule {
  model:string;assumptions:string;surface_note:string;distance_a0:number;distance_angstrom:number;overlap:number;
  electronic_energies_hartree:number[];total_energies_hartree:number[];nuclear_repulsion_hartree:number;
  coefficients:number[][];hamiltonian_hartree:number[][];overlap_matrix:number[][];residual:number;
  extent:number;points:number[][];phases:number[];surfaces:MeshData[];centers_a0:number[][];orbital:string;grid_size:number;
  curve:{distance_a0:number[];bonding_total_hartree:number[];antibonding_total_hartree:number[];bonding_electronic_hartree:number[];nuclear_repulsion_hartree:number[];equilibrium_a0:number;minimum_total_hartree:number;binding_energy_hartree:number};
}
function mountLcao(host:HTMLElement){
  const session=new LabSession(host,'molecular','Molecular Lab','Calculate H₂⁺ molecular orbitals and a bond-energy curve from a two-center variational Hamiltonian.',`<label>System<select name="system"><option value="h2plus">H₂⁺ · one electron, two protons</option></select></label>${numberField('distance','Nuclear separation / a₀',2,.5,10,.05)}<label>Calculated orbital<select name="orbital"><option value="bonding">σ1s · bonding</option><option value="antibonding">σ*1s · antibonding</option><option value="atomic-a">Atomic 1s on A · before combination</option><option value="atomic-b">Atomic 1s on B · before combination</option></select></label>${numberField('threshold','Surface amplitude / grid peak',.12,.02,.4,.01)}<p class="lab-explanation">Use the same separation and threshold to compare signed orbitals. The antibonding state has a plane of zero amplitude between the nuclei. Its total energy is distinct from the bonding state.</p>`);
  let viewer:OrbitalViewer|undefined;
  const calculate=()=>{
    if(!session.form.reportValidity())return;viewer?.dispose();viewer=undefined;
    const params=session.params();
    void session.run<Molecule>(`/api/molecular?${params}`,d=>{
      const selected=d.orbital==='antibonding'?1:0;
      session.result.innerHTML=`<div class="result-heading"><span class="method-badge">${esc(d.model)}</span><h2>H₂⁺ <small>${esc(d.orbital)} state</small></h2><p>R=${d.distance_a0.toFixed(3)} a₀ = ${d.distance_angstrom.toFixed(4)} Å. One electron; fixed proton centers.</p></div><div class="molecular-viewport" data-molecular-view aria-label="Calculated molecular orbital"><div class="molecular-legend">Cyan +ψ · amber −ψ<br>Nuclei enlarged · lengths a₀</div></div><div class="lab-actions"><button data-camera>Reset camera</button><button data-orbital-image>Export orbital PNG</button></div><p class="lab-explanation">${esc(d.surface_note)} ${d.grid_size}³ finite grid. Drag to rotate; scroll to zoom; arrow keys pan when the canvas is focused.</p><dl class="result-metrics"><div><dt>Orbital overlap S</dt><dd>${d.overlap.toFixed(6)}</dd></div><div><dt>Selected MO electronic energy</dt><dd>${d.electronic_energies_hartree[selected].toFixed(6)} Eₕ</dd></div><div><dt>Total including nuclear repulsion</dt><dd>${d.total_energies_hartree[selected].toFixed(6)} Eₕ</dd></div></dl><p class="lab-explanation">σ bonding: ${d.total_energies_hartree[0].toFixed(6)} Eₕ total; σ* antibonding: ${d.total_energies_hartree[1].toFixed(6)} Eₕ total. Nuclear contribution: ${d.nuclear_repulsion_hartree.toFixed(6)} Eₕ. Atomic-before-combination views show a basis function; the displayed MO energies still describe the molecular Hamiltonian.</p><details class="assumptions"><summary>Hamiltonian, overlap and eigenvectors</summary><pre>${esc(JSON.stringify({H_hartree:d.hamiltonian_hartree,S:d.overlap_matrix,coefficients_columns:d.coefficients,max_residual:d.residual},null,2))}</pre></details><h3>Bond formation & dissociation</h3>${plot([{label:'Bonding total E',x:d.curve.distance_a0,y:d.curve.bonding_total_hartree,color:'#68cce7'},{label:'Antibonding total E',x:d.curve.distance_a0,y:d.curve.antibonding_total_hartree,color:'#efad79',dashed:true},{label:'H + proton limit',x:d.curve.distance_a0,y:d.curve.distance_a0.map(()=>-.5),color:'#9bd6b6',dashed:true}],'Separation R / a₀','Total energy / Eₕ','H₂⁺ fixed-exponent LCAO / nuclear repulsion included')}<p class="lab-explanation">This model’s optimized separation is ${d.curve.equilibrium_a0.toFixed(5)} a₀, minimum ${d.curve.minimum_total_hartree.toFixed(8)} Eₕ, binding relative to H + p ${d.curve.binding_energy_hartree.toFixed(6)} Eₕ. These are predictions of this small basis, not measured H₂⁺ constants. Both states approach −½ Eₕ as R → ∞.</p><div class="lab-actions"><button data-csv>Export bond-curve CSV</button><button data-results>Export calculation JSON</button></div>${assumptions(d.assumptions)}`;
      const viewport=session.result.querySelector<HTMLElement>('[data-molecular-view]')!;
      try {viewer=new OrbitalViewer(viewport,()=>{session.status.textContent='Fixed proton center. Marker size is schematic.';});viewer.showMolecule(d);}
      catch {viewport.textContent='WebGL unavailable. Calculated energies, matrices and the bond curve remain available.';}
      session.result.querySelector('[data-camera]')!.addEventListener('click',()=>viewer?.reset());
      session.result.querySelector('[data-orbital-image]')!.addEventListener('click',()=>{
        if(!viewer){session.status.textContent='No WebGL image is available.';return;}
        const a=document.createElement('a');a.download='quantum-h2plus.png';a.href=viewer.screenshot(`H₂⁺ / ${d.orbital} / R=${d.distance_a0} a₀ / fixed-exponent LCAO`,`ψ isosurface threshold=${params.get('threshold')} of grid peak; nuclei schematic`);a.click();
      });
      session.result.querySelector('[data-csv]')!.addEventListener('click',()=>csv('quantum-h2plus-bond.csv',d.model,params.toString(),[['distance_a0','bonding_total_Eh','antibonding_total_Eh','bonding_electronic_Eh','nuclear_repulsion_Eh'],...d.curve.distance_a0.map((r,i)=>[r,d.curve.bonding_total_hartree[i],d.curve.antibonding_total_hartree[i],d.curve.bonding_electronic_hartree[i],d.curve.nuclear_repulsion_hartree[i]])]));
      session.result.querySelector('[data-results]')!.addEventListener('click',()=>download('quantum-h2plus.json',JSON.stringify({model:d.model,units:{energy:'Hartree',length:'a0'},parameters:params.toString(),electronic_energies:d.electronic_energies_hartree,total_energies:d.total_energies_hartree,H:d.hamiltonian_hartree,S:d.overlap_matrix,coefficients:d.coefficients,curve:d.curve},null,2),'application/json'));
    });
  };
  session.form.onsubmit=e=>{e.preventDefault();calculate();};calculate();return()=>{viewer?.dispose();session.dispose();};
}

export function mountMolecular(host:HTMLElement){
  host.innerHTML='<nav class="experiment-nav" aria-label="Molecular tools"><button data-molecular="lcao" aria-pressed="true">H₂⁺ calculated orbitals</button><button data-molecular="diagrams" aria-pressed="false">MO reference diagrams</button><button data-molecular="structures" aria-pressed="false">3D structures</button></nav><div data-molecular-host></div>';
  const target=host.querySelector<HTMLElement>('[data-molecular-host]')!;let cleanup=mountLcao(target);
  host.querySelectorAll<HTMLButtonElement>('[data-molecular]').forEach(b=>b.onclick=()=>{
    cleanup();host.querySelectorAll('[data-molecular]').forEach(button=>button.setAttribute('aria-pressed',String(button===b)));
    cleanup=b.dataset.molecular==='lcao'?mountLcao(target):b.dataset.molecular==='diagrams'?mountDiagrams(target):mountStructures(target);
  });return()=>cleanup();
}
