import { LabSession, numberField, speciesField, speciesParams, assumptions } from './session';
import { esc } from '../components/dom';
import { plot } from '../components/plot';
import { csv, plotPng } from '../services/export';
interface Measurement {
  model:string;assumptions:string;count:number;seed:number;edges_a0:number[];counts:number[];theory_bin_probability:number[];
  tail_count:number;theory_tail_probability:number;mean_r_a0:number;sample_mean_r_a0:number;sigma_r_a0:number;
  sigma_position_xyz_a0:number[];sigma_momentum_xyz_au:number[];uncertainty_products_xyz_hbar:number[];
}
export function mountMeasurement(host:HTMLElement){
  const session=new LabSession(host,'measurement','Quantum Measurements','Compare repeated position measurements with the Born-rule probability distribution.',`${speciesField}<fieldset><legend>Prepared orbital</legend><div class="lab-field-grid">${numberField('n','Principal n',1,1,8)}${numberField('l','Angular l',0,0,3)}${numberField('m','Basis index / mₗ',0,-3,3)}</div><label>Angular basis<select name="basis"><option value="real">Real chemistry basis</option><option value="complex">Complex mₗ eigenstate</option></select></label></fieldset>${numberField('count','Measurements per batch',2000,1,60000)}${numberField('seed','Random seed (reproducible)',42,0,4294967295)}<p class="lab-explanation">Require l &lt; n and |m| ≤ l. Calculate replaces the sample. Use a different seed for an independent repeated preparation.</p>`);
  const calculate=()=>{
    if(!session.form.reportValidity())return;
    const params=speciesParams(session.params());
    void session.run<Measurement>(`/api/measurement?${params}`,d=>{
      const centers=d.counts.map((_,i)=>(d.edges_a0[i]+d.edges_a0[i+1])/2);
      const widths=d.counts.map((_,i)=>d.edges_a0[i+1]-d.edges_a0[i]);
      const sample=d.counts.map((v,i)=>v/d.count/widths[i]);
      const theory=d.theory_bin_probability.map((v,i)=>v/widths[i]);
      session.result.innerHTML=`<div class="result-heading"><span class="method-badge">${esc(d.model)}</span><h2>${d.count.toLocaleString()} <small>independent measurements</small></h2><p>Prepared state: n=${params.get('n')}, l=${params.get('l')}, m/index=${params.get('m')}; ${esc(params.get('basis'))} basis. Seed ${d.seed}.</p></div>${plot([{label:'Theoretical bin-average P(r)',x:centers,y:theory,color:'#68cce7'},{label:'Measured frequency density',x:centers,y:sample,color:'#efad79',dashed:true}],'Radius / a₀','P(r) / a₀⁻¹',`Born rule / n=${params.get('n')} l=${params.get('l')} / ${d.count} samples`)}<dl class="result-metrics"><div><dt>Theoretical ⟨r⟩</dt><dd>${d.mean_r_a0.toFixed(5)} a₀</dd></div><div><dt>Measured mean r</dt><dd>${d.sample_mean_r_a0.toFixed(5)} a₀</dd></div><div><dt>Radial standard deviation</dt><dd>${d.sigma_r_a0.toFixed(5)} a₀</dd></div></dl><p class="lab-explanation">Beyond plotted radius: ${d.tail_count} measurements; theory ${(100*d.theory_tail_probability).toFixed(3)}%. Curves connect histogram bin centers; theoretical values integrate each bin.</p><h3>Prepared-state uncertainty</h3><div class="lab-table-scroll"><table><thead><tr><th>Axis</th><th>σ position / a₀</th><th>σ momentum / (ℏ/a₀)</th><th>σx σp / ℏ ≥ ½</th></tr></thead><tbody>${['x','y','z'].map((axis,i)=>`<tr><th>${axis}</th><td>${d.sigma_position_xyz_a0[i].toFixed(6)}</td><td>${d.sigma_momentum_xyz_au[i].toFixed(6)}</td><td>${d.uncertainty_products_xyz_hbar[i].toFixed(6)}</td></tr>`).join('')}</tbody></table></div><p class="lab-explanation">⟨x⟩ = ⟨y⟩ = ⟨z⟩ = 0; ⟨p⟩ = 0. These are ensemble properties, not joint measurements. Radial standard deviation is not a Cartesian uncertainty.</p><div class="lab-actions"><button data-repeat>New independent batch</button><button data-csv>Export CSV</button><button data-png>Export graph PNG</button></div>${assumptions(d.assumptions)}`;
      session.result.querySelector('[data-repeat]')!.addEventListener('click',()=>{
        session.form.querySelector<HTMLInputElement>('[name="seed"]')!.value=String(crypto.getRandomValues(new Uint32Array(1))[0]);calculate();
      });
      session.result.querySelector('[data-csv]')!.addEventListener('click',()=>csv('quantum-measurements.csv',d.model,params.toString(),[['left_edge_a0','right_edge_a0','count','theory_probability'],...d.counts.map((v,i)=>[d.edges_a0[i],d.edges_a0[i+1],v,d.theory_bin_probability[i]]),['outside_plot_tail','',d.tail_count,d.theory_tail_probability]]));
      session.result.querySelector('[data-png]')!.addEventListener('click',()=>{void plotPng(session.result.querySelector('svg')!,'quantum-measurements.png').catch(e=>session.status.textContent=String(e));});
    });
  };
  session.form.onsubmit=e=>{e.preventDefault();calculate();};calculate();return session.dispose;
}
