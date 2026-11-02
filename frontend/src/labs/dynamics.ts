import { LabSession, numberField, assumptions } from './session';
import { Playback } from '../components/playback';
import { plot } from '../components/plot';
import { csv, plotPng } from '../services/export';
import { esc } from '../components/dom';
interface Superposition {
  model:string;assumptions:string;states:number[];coefficients:{real:number;imag:number}[];
  energies_hartree:number[];x_a0:number[];basis:number[][];length_a0:number;x_ab_a0:number;
  period_au:number;times_au:number[];expectation_x_a0:number[];expectation_energy_hartree:number;normalization:number;
}
export function mountDynamics(host:HTMLElement){
  const session=new LabSession(host,'dynamics','Quantum Dynamics','Evolve a normalized complex superposition in a one-dimensional infinite square well.',`${numberField('length','Well length / a₀',10,2,30,.1)}<fieldset><legend>Basis state A</legend>${numberField('state_a','Stationary state n',1,1,8)}<div class="lab-field-grid">${numberField('ar','Real coefficient',1,-10,10,.1)}${numberField('ai','Imaginary coefficient',0,-10,10,.1)}</div></fieldset><fieldset><legend>Basis state B</legend>${numberField('state_b','Stationary state n',2,1,8)}<div class="lab-field-grid">${numberField('br','Real coefficient',1,-10,10,.1)}${numberField('bi','Imaginary coefficient',0,-10,10,.1)}</div></fieldset><p class="lab-explanation">Coefficients normalize automatically. Set B to 0 + 0i to verify a stationary eigenstate. The two basis indices must differ.</p>`);
  let playback:Playback|undefined;
  session.form.addEventListener('input',()=>playback?.pause());
  session.form.addEventListener('change',()=>playback?.pause());
  const calculate=()=>{
    playback?.dispose();
    if(!session.form.reportValidity())return;
    const params=session.params();
    void session.run<Superposition>(`/api/dynamics/superposition?${params}`,d=>{
      session.result.innerHTML=`<div class="result-heading"><span class="method-badge">${esc(d.model)}</span><h2>Time-dependent interference</h2><p>Ψ(x,t) = cA φA(x)e⁻ⁱᴱᴬᵗ + cB φB(x)e⁻ⁱᴱᴮᵗ</p></div><div data-playback></div><dl class="result-metrics"><div><dt>⟨x⟩ at current time</dt><dd data-x></dd></div><div><dt>Constant ⟨E⟩</dt><dd>${d.expectation_energy_hartree.toFixed(6)} Eₕ</dd></div><div><dt>∫|Ψ|² dx</dt><dd>${d.normalization.toFixed(10)}</dd></div></dl><p class="lab-explanation">Normalized coefficients: ${d.coefficients.map((v,i)=>`n=${d.states[i]}: ${v.real.toFixed(4)} ${v.imag<0?'−':'+'} ${Math.abs(v.imag).toFixed(4)}i`).join('; ')}. Relative phase: <output data-phase></output> rad.</p><div data-density></div><div data-amplitude></div>${plot([{label:'Exact position expectation',x:d.times_au,y:d.expectation_x_a0,color:'#9bd6b6'}],'Time / atomic units','⟨x⟩ / a₀','One interference period / infinite well')}<div class="lab-actions"><button data-csv>Export current state CSV</button><button data-png>Export density PNG</button></div>${assumptions(d.assumptions+' One atomic time unit is approximately 24.19 attoseconds. Playback speed is a viewing aid and is not real laboratory time.')}`;
      let currentTime=0, real:number[]=[],imag:number[]=[],density:number[]=[];
      const draw=(time:number)=>{
        currentTime=time;
        const evolved=d.coefficients.map((v,i)=>{
          const angle=-d.energies_hartree[i]*time;
          return {real:v.real*Math.cos(angle)-v.imag*Math.sin(angle),imag:v.real*Math.sin(angle)+v.imag*Math.cos(angle)};
        });
        real=d.x_a0.map((_,i)=>evolved.reduce((sum,v,j)=>sum+v.real*d.basis[j][i],0));
        imag=d.x_a0.map((_,i)=>evolved.reduce((sum,v,j)=>sum+v.imag*d.basis[j][i],0));
        density=real.map((v,i)=>v*v+imag[i]*imag[i]);
        const cross=evolved[0].real*evolved[1].real+evolved[0].imag*evolved[1].imag;
        session.result.querySelector('[data-x]')!.textContent=`${(d.length_a0/2+2*cross*d.x_ab_a0).toFixed(6)} a₀`;
        const relative=Math.atan2(evolved[1].imag,evolved[1].real)-Math.atan2(evolved[0].imag,evolved[0].real);
        session.result.querySelector('[data-phase]')!.textContent=(Math.atan2(Math.sin(relative),Math.cos(relative))).toFixed(4);
        session.result.querySelector('[data-density]')!.innerHTML=plot([{label:'Probability density |Ψ|²',x:d.x_a0,y:density,color:'#68cce7'}],'Position / a₀','|Ψ|² / a₀⁻¹',`Infinite well / n=${d.states.join(',')} / t=${time.toFixed(3)} a.u.`,[0,4/d.length_a0]);
        session.result.querySelector('[data-amplitude]')!.innerHTML=plot([{label:'Real Ψ',x:d.x_a0,y:real,color:'#68cce7'},{label:'Imaginary Ψ',x:d.x_a0,y:imag,color:'#efad79',dashed:true}],'Position / a₀','Amplitude / a₀⁻½','Complex wavefunction / global phase is not density',[-2/Math.sqrt(d.length_a0),2/Math.sqrt(d.length_a0)]);
      };
      playback=new Playback(session.result.querySelector('[data-playback]')!,d.period_au,d.period_au/8,draw);
      session.result.querySelector('[data-csv]')!.addEventListener('click',()=>csv('quantum-dynamics.csv',d.model,`${params}&time_au=${currentTime}`,[['position_a0','real_amplitude_a0^-1/2','imag_amplitude_a0^-1/2','density_a0^-1'],...d.x_a0.map((x,i)=>[x,real[i],imag[i],density[i]])]));
      session.result.querySelector('[data-png]')!.addEventListener('click',()=>{void plotPng(session.result.querySelector('[data-density] svg')!,'quantum-dynamics.png').catch(e=>session.status.textContent=String(e));});
    });
  };
  session.form.onsubmit=e=>{e.preventDefault();calculate();};calculate();
  return ()=>{playback?.dispose();session.dispose();};
}
