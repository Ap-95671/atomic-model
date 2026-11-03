import {savedParameters} from '../app/route';
import { LabSession,numberField,assumptions } from './session';
import { chemistryCatalog,type ChemistryResult } from '../services/chemistry';
import { esc } from '../components/dom';
import { OrbitalViewer } from '../visualization/viewer';
import { plot } from '../components/plot';
import { csv,download,plotPng } from '../services/export';

export function mountComputedMolecules(host:HTMLElement,initialSystem='h2'){
  if(import.meta.env.VITE_STATIC_DEMO==='true'){let closed=false,cleanup:(()=>void)|undefined;host.innerHTML='<p role="status">Loading recorded molecular examples…</p>';void import('../static/recorded').then(module=>{if(!closed)cleanup=module.mountRecordedMolecules(host,initialSystem);});return()=>{closed=true;cleanup?.();};}
  let disposed=false,session:LabSession|undefined,viewer:OrbitalViewer|undefined;
  let calculationId:string|undefined,current:ChemistryResult|undefined;
  host.innerHTML='<p role="status">Loading supported chemistry methods…</p>';
  void chemistryCatalog().then(catalog=>{
    if(disposed)return;
    let initialOrbital=savedParameters('computed-molecules')?.orbital;
    const system=catalog.systems.find(v=>v.id===initialSystem)||catalog.systems[0];
    session=new LabSession(host,'computed-molecules','Calculated Molecular Orbitals','Select a molecule, spin-aware computational method, and any calculated orbital.',`<label>System<select name="system">${catalog.systems.map(s=>`<option value="${s.id}" ${s.id===system.id?'selected':''}>${esc(s.label)}</option>`).join('')}</select></label><label>Electronic method<select name="method"><option value="hf">HF · automatic RHF/UHF by spin</option><option value="rhf">Restricted HF · spin 0</option><option value="uhf">Unrestricted HF</option><option value="rohf">Restricted open-shell HF</option><option value="pbe">PBE · RKS/UKS by spin</option><option value="b3lyp">B3LYP · RKS/UKS by spin</option></select></label><label>Basis<select name="basis">${catalog.bases.map(b=>`<option>${b}</option>`).join('')}</select></label>${numberField('distance','Diatomic separation / a₀',system.distance,.6,10,.01)}${numberField('spin','Spin polarization Nα − Nβ = 2S',system.spin,0,4)}<label>Field<select name="view"><option value="orbital">Calculated orbital amplitude</option><option value="density">Total electron density</option><option value="spin-density">Spin density · ρα − ρβ</option></select></label><label>Spin channel<select name="channel"><option value="alpha">α</option><option value="beta">β</option></select></label><label>Calculated orbital<select name="orbital"><option value="-1">HOMO · calculate to load every orbital</option></select></label><details><summary>Numerical settings</summary><label>DFT integration grid<select name="grid_level"><option value="0">Low · level 0</option><option value="1" selected>Balanced · level 1</option><option value="3">High · level 3</option></select></label><label>Display grid<select name="quality"><option value="preview" selected>Preview · 41³</option><option value="balanced">Balanced · 65³</option><option value="high">High · 97³</option></select></label>${numberField('threshold','Isosurface / sampled field peak',.08,.01,.4,.01)}<label>Initial density guess<select name="guess"><option value="minao">MINAO</option><option value="atom">Atomic densities</option><option value="hcore">Core Hamiltonian</option><option value="broken-symmetry">Broken symmetry · H₂/UHF only</option></select></label><label>DIIS acceleration<select name="diis"><option value="true">Enabled</option><option value="false">Disabled</option></select></label>${numberField('max_cycles','Maximum SCF cycles',100,1,100)}</details><p class="lab-explanation">Diatomic separations are demonstration inputs, not optimized geometries. Other structures use bundled PubChem3D conformers. O₂/B₂ default to triplet polarization; computed spin diagnostics are reported. PySCF is optional.</p>`);
    const input=(name:string)=>session!.form.querySelector<HTMLInputElement|HTMLSelectElement>(`[name="${name}"]`)!;
    const request=()=>{
      const values:Record<string,unknown>=Object.fromEntries(session!.params());
      for(const name of ['distance','spin','orbital','grid_level','threshold','max_cycles'])values[name]=Number(values[name]);
      values.diis=values.diis==='true';if(initialOrbital!==undefined)values.orbital=Number(initialOrbital);return values;
    };
    const synchronizeSystem=()=>{
      const chosen=catalog.systems.find(s=>s.id===input('system').value)!;
      input('distance').value=String(chosen.distance);input('spin').value=String(chosen.spin);
      input('distance').closest('label')!.hidden=!chosen.diatomic;
    };
    if(!session.hasRestoredParameters)synchronizeSystem();
    const populateOrbitals=()=>{
      if(!current)return;const channel=current.channels[input('channel').value==='alpha'?0:1];
      const previous=initialOrbital??input('orbital').value;initialOrbital=undefined;
      input('orbital').innerHTML=`<option value="-1" ${channel.homo===null?'disabled':''}>HOMO${channel.homo===null?' · no occupied orbital':''}</option>`+channel.energies_hartree.map((energy,i)=>`<option value="${i}">${i+1}${i===channel.homo?' · HOMO':i===channel.lumo?' · LUMO':''} · ${energy.toFixed(5)} Eₕ · occ ${channel.occupations[i]}</option>`).join('');
      input('orbital').value=previous==='-1'&&channel.homo===null?'0':previous;
      if(input('orbital').value==='')input('orbital').value=channel.homo===null?'0':'-1';
    };
    const drawField=(data:ChemistryResult)=>{
      current=data;
      const field=data.field;
      const container=session!.result.querySelector<HTMLElement>('[data-computed-view]')!;
      if(!viewer){
        try{viewer=new OrbitalViewer(container,()=>{session!.status.textContent='Fixed nuclear center; marker size is schematic.';});}
        catch{container.textContent='WebGL unavailable. Calculated energies, occupations and diagnostics remain available.';}
      }
      viewer?.showMolecule(field);if(field.field_kind==='density')viewer?.setColor(false);
      session!.result.querySelector('[data-field-title]')!.textContent=field.field_kind==='orbital'?`${field.channel} orbital ${(field.orbital_index??0)+1}`:field.field_kind;
      session!.result.querySelector('[data-field-legend]')!.textContent=field.field_kind==='density'?'Electron density ≥ 0':field.field_kind==='spin-density'?'Cyan α excess · amber β excess':'Cyan +ψ · amber −ψ';
      session!.result.querySelector('[data-field-note]')!.textContent=`${field.grid_size}³ grid. ${field.surface_note}${field.peak<1e-14?' The calculated field is zero within tolerance; no isosurface exists.':''}`;
      session!.result.querySelector('[data-field-integral]')!.textContent=field.finite_grid_integral===null?'':`Display-grid integral: ${field.finite_grid_integral.toFixed(7)} ${field.field_kind==='density'?'electrons':'net spin-polarized electrons'} (finite-grid approximation).`;
    };
    const render=(data:ChemistryResult,id:string)=>{
      viewer?.dispose();viewer=undefined;calculationId=id;current=data;
      session!.result.innerHTML=`<div class="result-heading"><span class="method-badge">${esc(data.model)}</span><h2>${data.total_energy_hartree.toFixed(9)} <small>Eₕ total</small></h2><p>${esc((input('system') as HTMLSelectElement).selectedOptions[0].textContent)} · <span data-field-title></span></p></div><div class="molecular-viewport" data-computed-view><div class="molecular-legend"><span data-field-legend></span><br>Nuclear markers schematic · lengths a₀</div></div><div class="lab-actions"><button data-camera>Reset camera</button><button data-image>Export field PNG</button></div><p class="lab-explanation" data-field-note></p><p class="lab-explanation" data-field-integral></p><dl class="result-metrics"><div><dt>Electrons · α / β</dt><dd>${data.electron_count.toFixed(6)} · ${data.spin_electron_counts.map(v=>v.toFixed(3)).join(' / ')}</dd></div><div><dt>⟨S²⟩ / target · ℏ²</dt><dd>${data.spin_squared.toFixed(6)} / ${data.spin_squared_target.toFixed(3)}</dd></div><div><dt>Spin contamination · ℏ²</dt><dd>${data.spin_contamination.toExponential(3)}</dd></div></dl><p class="lab-explanation">${esc(data.geometry_note)} S-orthonormality error ${data.orthonormality_error.toExponential(2)}. Density idempotency error ${data.spin_density_idempotency_error.toExponential(2)}. UHF spin contamination is a diagnostic, not a universal accuracy test.</p><h3>Energy decomposition</h3><div class="lab-table-scroll"><table><thead><tr><th>Contribution</th><th>Energy / Eₕ</th></tr></thead><tbody>${Object.entries(data.energy_components_hartree).map(([name,value])=>`<tr><td>${esc(name.replaceAll('_',' '))}</td><td>${value.toFixed(9)}</td></tr>`).join('')}</tbody></table></div><p class="lab-explanation">Components sum to total within ${data.energy_decomposition_error.toExponential(2)} Eₕ. Basis size ${data.basis_size}; all calculated α/β orbitals are selectable.</p>${plot([{label:'SCF total energy',x:data.scf_history.map(v=>v.iteration),y:data.scf_history.map(v=>v.total_energy_hartree),color:'#68cce7'}],'SCF cycle','Energy / Eₕ',data.model)}<div class="lab-actions"><button data-csv>Export all orbitals CSV</button><button data-json>Export calculation JSON</button><button data-plot>Export convergence PNG</button></div><p class="lab-explanation">Worker wall ${data.resources.wall_seconds.toFixed(3)} s; CPU ${data.resources.cpu_seconds.toFixed(3)} s; lifetime peak RSS ${data.resources.peak_rss_mib.toFixed(1)} MiB. Display-field changes reuse the calculated state without repeating SCF.</p>${assumptions(data.assumptions)}`;
      populateOrbitals();drawField(data);
      session!.result.querySelector('[data-camera]')!.addEventListener('click',()=>viewer?.reset());
      session!.result.querySelector('[data-image]')!.addEventListener('click',()=>{if(!viewer)return;const link=document.createElement('a');link.download='calculated-molecular-orbital.png';link.href=viewer.screenshot(data.model,`${input('system').value} / ${session!.result.querySelector('[data-field-title]')!.textContent} / length a₀ / field threshold ${input('threshold').value}`);link.click();});
      session!.result.querySelector('[data-csv]')!.addEventListener('click',()=>csv('calculated-orbitals.csv',data.model,JSON.stringify(data.request),[['channel','orbital_index_1_based','orbital_energy_Eh','occupation'],...data.channels.flatMap(c=>c.energies_hartree.map((e,i)=>[c.name,i+1,e,c.occupations[i]]))]));
      session!.result.querySelector('[data-json]')!.addEventListener('click',()=>{const{field,...numbers}=current!;download('molecular-calculation.json',JSON.stringify({...numbers,field:{...field,surfaces:undefined}},null,2),'application/json');});
      session!.result.querySelector('[data-plot]')!.addEventListener('click',()=>{void plotPng(session!.result.querySelector('svg')!,'scf-convergence.png').catch(e=>session!.status.textContent=String(e));});
    };
    session.form.onsubmit=event=>{event.preventDefault();if(!session!.form.reportValidity())return;calculationId=undefined;void session!.runJob<ChemistryResult>({operation:'scf',request:request()},render);};
    session.form.addEventListener('change',event=>{
      const name=(event.target as HTMLInputElement).name;
      if(name==='system')synchronizeSystem();
      if(['view','channel','orbital','quality','threshold'].includes(name)&&calculationId){
        if(name==='channel')populateOrbitals();
        if(!session!.form.reportValidity())return;
        const values=request();
        void session!.runJob<ChemistryResult>({operation:'field',calculation_id:calculationId,request:Object.fromEntries(['view','channel','orbital','quality','threshold'].map(k=>[k,values[k]]))},drawField);
      }else if(!['view','channel','orbital','quality','threshold'].includes(name)){calculationId=undefined;}
    });
    session.form.requestSubmit();
  }).catch(error=>{if(!disposed)host.innerHTML=`<p role="alert">Chemistry setup failed: ${esc((error as Error).message)}</p>`;});
  return()=>{disposed=true;session?.dispose();viewer?.dispose();};
}
