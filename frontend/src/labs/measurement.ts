import { LabSession, numberField, speciesField, speciesParams, assumptions } from './session';
import { esc } from '../components/dom';
import { plot } from '../components/plot';
import { csv, plotPng,download } from '../services/export';
interface Measurement {
  model:string;assumptions:string;count:number;seed:number;edges_a0:number[];counts:number[];theory_bin_probability:number[];
  tail_count:number;theory_tail_probability:number;mean_r_a0:number;sample_mean_r_a0:number;sigma_r_a0:number;
  sigma_position_xyz_a0:number[];sigma_momentum_xyz_au:number[];uncertainty_products_xyz_hbar:number[];
}
interface Batch{seed:number;count:number;mean_r_a0:number;tail_count:number;}
export function mountMeasurement(host:HTMLElement){
  const session=new LabSession(host,'measurement','Quantum Measurements','Compare repeated position measurements with the Born-rule probability distribution.',`${speciesField}<fieldset><legend>Prepared orbital</legend><div class="lab-field-grid">${numberField('n','Principal n',1,1,8)}${numberField('l','Angular l',0,0,3)}${numberField('m','Basis index / mₗ',0,-3,3)}</div><label>Angular basis<select name="basis"><option value="real">Real chemistry basis</option><option value="complex">Complex mₗ eigenstate</option></select></label></fieldset>${numberField('count','Measurements per batch',2000,1,60000)}${numberField('seed','Random seed (reproducible)',42,0,4294967295)}<p class="lab-explanation">Require l &lt; n and |m| ≤ l. Calculate replaces the sample. Add independent batches to accumulate; reset clears measurements without generating new ones.</p>`);
  let aggregate:Measurement|undefined,batches:Batch[]=[],physicsKey='';
  function render(d:Measurement,params:URLSearchParams){
    const centers=d.counts.map((_,i)=>(d.edges_a0[i]+d.edges_a0[i+1])/2);
    const widths=d.counts.map((_,i)=>d.edges_a0[i+1]-d.edges_a0[i]);
    const sample=d.counts.map((v,i)=>d.count?v/d.count/widths[i]:0);
    const theory=d.theory_bin_probability.map((v,i)=>v/widths[i]);
    session.result.innerHTML=`<div class="result-heading"><span class="method-badge">${esc(d.model)}</span><h2>${d.count.toLocaleString()} <small>independent measurements</small></h2><p>Prepared state: n=${params.get('n')}, l=${params.get('l')}, m/index=${params.get('m')}; ${esc(params.get('basis'))} basis. ${batches.length} batch${batches.length===1?'':'es'}.</p></div>${plot([{label:'Theoretical bin-average P(r)',x:centers,y:theory,color:'#68cce7'},{label:'Measured frequency density',x:centers,y:sample,color:'#efad79',dashed:true}],'Radius / a₀','P(r) / a₀⁻¹',`Born rule / n=${params.get('n')} l=${params.get('l')} / ${d.count} samples`)}<dl class="result-metrics"><div><dt>Theoretical ⟨r⟩</dt><dd>${d.mean_r_a0.toFixed(5)} a₀</dd></div><div><dt>Measured mean r</dt><dd>${d.count?d.sample_mean_r_a0.toFixed(5)+' a₀':'— no measurements'}</dd></div><div><dt>Radial standard deviation</dt><dd>${d.sigma_r_a0.toFixed(5)} a₀</dd></div></dl><p class="lab-explanation">Beyond plotted radius: ${d.tail_count} measurements; theory ${(100*d.theory_tail_probability).toFixed(3)}%. Curves connect histogram bin centers; theoretical values integrate each bin. ${d.count===0?'Measurements cleared. Theory remains visible; no new samples were generated.':''}</p><h3>Prepared-state uncertainty</h3><div class="lab-table-scroll"><table><thead><tr><th>Axis</th><th>σ position / a₀</th><th>σ momentum / (ℏ/a₀)</th><th>σx σp / ℏ ≥ ½</th></tr></thead><tbody>${['x','y','z'].map((axis,i)=>`<tr><th>${axis}</th><td>${d.sigma_position_xyz_a0[i].toFixed(6)}</td><td>${d.sigma_momentum_xyz_au[i].toFixed(6)}</td><td>${d.uncertainty_products_xyz_hbar[i].toFixed(6)}</td></tr>`).join('')}</tbody></table></div><p class="lab-explanation">⟨x⟩ = ⟨y⟩ = ⟨z⟩ = 0; ⟨p⟩ = 0. These are ensemble properties, not joint measurements. Radial standard deviation is not a Cartesian uncertainty.</p><div class="lab-actions"><button data-repeat>New independent batch</button><button data-add>Add independent batch</button><button data-clear>Reset measurements</button><button data-csv>Export CSV</button><button data-png>Export graph PNG</button><button data-history>Export batch history JSON</button></div>${assumptions(d.assumptions)}`;
    const newSeed=()=>{session.form.querySelector<HTMLInputElement>('[name="seed"]')!.value=String(crypto.getRandomValues(new Uint32Array(1))[0]);};
    session.result.querySelector('[data-repeat]')!.addEventListener('click',()=>{newSeed();calculate(false);});
    session.result.querySelector('[data-add]')!.addEventListener('click',()=>{newSeed();calculate(true);});
    session.result.querySelector('[data-clear]')!.addEventListener('click',()=>{
      aggregate={...d,count:0,counts:d.counts.map(()=>0),tail_count:0,sample_mean_r_a0:0};batches=[];
      render(aggregate,params);session.status.textContent='Measurements reset. No samples generated.';
    });
    session.result.querySelector('[data-csv]')!.addEventListener('click',()=>csv('quantum-measurements.csv',d.model,`${params}&aggregate_count=${d.count}&batches=${JSON.stringify(batches)}`,[['left_edge_a0','right_edge_a0','count','theory_probability'],...d.counts.map((v,i)=>[d.edges_a0[i],d.edges_a0[i+1],v,d.theory_bin_probability[i]]),['outside_plot_tail','',d.tail_count,d.theory_tail_probability]]));
    session.result.querySelector('[data-png]')!.addEventListener('click',()=>{void plotPng(session.result.querySelector('svg')!,'quantum-measurements.png').catch(e=>session.status.textContent=String(e));});
    session.result.querySelector('[data-history]')!.addEventListener('click',()=>download('measurement-batches.json',JSON.stringify({model:d.model,parameters:params.toString(),count:d.count,batches,counts:d.counts,edges_a0:d.edges_a0},null,2),'application/json'));
  }
  function calculate(append=false){
    if(!session.form.reportValidity())return;
    const params=speciesParams(session.params());const identity=new URLSearchParams(params);identity.delete('seed');identity.delete('count');
    const key=identity.toString();
    if(append&&aggregate&&(aggregate.count+Number(params.get('count'))>1_000_000||batches.length>=1000)){
      session.status.textContent='Accumulation limit reached (1,000,000 outcomes or 1000 batches). Reset measurements to start again.';return;
    }
    void session.run<Measurement>(`/api/measurement?${params}`,d=>{
      const batch={seed:d.seed,count:d.count,mean_r_a0:d.sample_mean_r_a0,tail_count:d.tail_count};
      if(append&&aggregate&&key===physicsKey){
        const total=aggregate.count+d.count;
        d={...d,count:total,counts:d.counts.map((v,i)=>v+aggregate!.counts[i]),tail_count:d.tail_count+aggregate.tail_count,
          sample_mean_r_a0:(aggregate.sample_mean_r_a0*aggregate.count+d.sample_mean_r_a0*d.count)/total};
        batches.push(batch);
      }else batches=[batch];
      aggregate=d;physicsKey=key;render(d,params);
    });
  }
  session.form.onsubmit=e=>{e.preventDefault();calculate();};calculate();return session.dispose;
}
