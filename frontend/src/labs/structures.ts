import { LabSession,assumptions } from './session';
import { OrbitalViewer } from '../visualization/viewer';
import { esc } from '../components/dom';
import { download } from '../services/export';
export const moleculeOptions=`<option value="water">H₂O · water</option><option value="ammonia">NH₃ · ammonia</option><option value="methane">CH₄ · methane</option><option value="carbon-dioxide">CO₂ · carbon dioxide</option><option value="carbon-monoxide">CO · carbon monoxide</option><option value="benzene">C₆H₆ · benzene</option>`;
interface Structure {name:string;formula:string;geometry:string;model:string;assumptions:string;source_url:string;pubchem_cid:number;symbols:string[];atomic_numbers:number[];coordinates_angstrom:number[][];bonds:{a:number;b:number;order:number;length_angstrom:number}[];angles:{a:number;center:number;b:number;degrees:number}[];}
export function mountStructures(host:HTMLElement){
  const session=new LabSession(host,'structures','3D Molecular Structures','Inspect source-preserved PubChem3D conformers, connectivity and derived geometry.',`<label>Reference molecule<select name="name">${moleculeOptions}</select></label><p class="lab-explanation">These computed conformers are not an equilibrium optimization. Orbital and density calculations are available separately in Computational Chemistry.</p>`);
  let viewer:OrbitalViewer|undefined;
  session.form.onsubmit=e=>{
    e.preventDefault();viewer?.dispose();viewer=undefined;const params=session.params();
    void session.run<Structure>(`/api/molecular/structure?${params}`,d=>{
      session.result.innerHTML=`<div class="result-heading"><span class="method-badge">${esc(d.model)}</span><h2>${esc(d.formula)} <small>${esc(d.geometry)}</small></h2><p><a href="${esc(d.source_url)}" target="_blank" rel="noreferrer">PubChem CID ${d.pubchem_cid} · source record ↗</a></p></div><div class="molecular-viewport" data-structure-view><div class="molecular-legend">H white · C gray · N blue · O red<br>Ball/stick sizes schematic; source distances in Å</div></div><div class="lab-actions"><button data-camera>Reset camera</button><button data-json>Export coordinates JSON</button></div><h3>Atomic coordinates · source frame / Å</h3><div class="lab-table-scroll"><table><thead><tr><th>Atom</th><th>x / Å</th><th>y / Å</th><th>z / Å</th></tr></thead><tbody>${d.coordinates_angstrom.map((p,i)=>`<tr><td>${i+1} · ${esc(d.symbols[i])}</td>${p.map(v=>`<td>${v.toFixed(4)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><h3>Bond lengths & connectivity</h3><p class="lab-explanation">Sticks indicate connectivity. Source bond order is listed here; aromatic delocalization is not a calculated localized-bond pattern.</p><div class="lab-table-scroll"><table><thead><tr><th>Atoms</th><th>Source bond order</th><th>Length / Å</th></tr></thead><tbody>${d.bonds.map(b=>`<tr><td>${b.a+1}–${b.b+1}</td><td>${b.order}</td><td>${b.length_angstrom.toFixed(4)}</td></tr>`).join('')}</tbody></table></div><h3>Bond angles · derived from coordinates</h3><p class="lab-explanation">${d.angles.length?d.angles.map(v=>`${v.a+1}–${v.center+1}–${v.b+1}: ${v.degrees.toFixed(2)}°`).join('; '):'Diatomic: no three-atom bond angle.'}</p>${assumptions(d.assumptions)}`;
      const view=session.result.querySelector<HTMLElement>('[data-structure-view]')!;
      try{viewer=new OrbitalViewer(view,type=>{session.status.textContent=type+' · inspect the coordinate table for identity.';});viewer.showStructure(d);}catch{view.textContent='WebGL unavailable. Source coordinates and derived geometry remain available.';}
      session.result.querySelector('[data-camera]')!.addEventListener('click',()=>viewer?.reset());
      session.result.querySelector('[data-json]')!.addEventListener('click',()=>download(`${d.name}-conformer.json`,JSON.stringify(d,null,2),'application/json'));
    });
  };session.form.requestSubmit();return()=>{viewer?.dispose();session.dispose();};
}
