import { LabSession, numberField, speciesField, speciesParams, assumptions } from './session';
import { esc } from '../components/dom';
import { csv, plotPng } from '../services/export';
import { plot } from '../components/plot';
interface Transition {
  wavelength_nm:number; frequency_hz:number; delta_ev:number; kind:string;
  allowed:boolean; dipole_squared_a0:number; model:string; selection_note:string; assumptions:string;
}
interface Series { name:string; limit_nm:number; note:string; model:string; lines:{upper_n:number;lower_n:number;wavelength_nm:number;delta_ev:number}[]; }
const stateFields=(prefix:string,title:string,n:number,l:number)=>`<fieldset><legend>${title}</legend><div class="lab-field-grid">${numberField(prefix+'n','Principal n',n,1,8)}${numberField(prefix+'l','Angular l',l,0,3)}${numberField(prefix+'m','Magnetic mₗ',0,-3,3)}<label>Spin mₛ<select name="${prefix}spin"><option value="0.5">+½</option><option value="-0.5">−½</option></select></label></div></fieldset>`;
function visibleSpectrum(wavelength:number){
  const visible=wavelength>=380 && wavelength<=750;
  return `<div class="visible-spectrum" role="img" aria-label="Approximate visible band from 380 to 750 nanometers; selected photon ${wavelength.toFixed(3)} nanometers ${visible?'inside this display band':'outside this display band'}"><div class="spectrum-band">${visible?`<span style="left:${100*(wavelength-380)/370}%"></span>`:''}</div><div class="spectrum-labels"><span>380 nm</span><span>Visible band · schematic display colors</span><span>750 nm</span></div></div><p class="lab-explanation">Selected photon: ${visible?'marker in the visible band':wavelength<380?'ultraviolet, outside the shown band':'infrared, outside the shown band'}. Display colors are a qualitative guide, not colorimetric spectral radiance.</p>`;
}
export function mountSpectroscopy(host:HTMLElement){
  const session=new LabSession(host,'spectroscopy','Spectroscopy','Resolve photon energies and electric-dipole selection rules for hydrogen-like atoms.',`${speciesField}${stateFields('i_','Initial state',3,1)}${stateFields('f_','Final state',2,0)}<label>Dipole operator component<select name="polarization"><option value="all">All q components</option><option value="pi">π · q = 0</option><option value="sigma+">σ+ · q = +1</option><option value="sigma-">σ− · q = −1</option></select></label><label>Spectral series<select name="lower"><option value="1">Lyman · lower n = 1</option><option value="2" selected>Balmer · lower n = 2</option><option value="3">Paschen · lower n = 3</option></select></label>`);
  const calculate=()=>{
    if(!session.form.reportValidity())return;
    const params=speciesParams(session.params());
    // One request lifecycle owns both datasets, so neither can overwrite a newer form.
    void session.run<{transition:Transition;series:Series}>(`/api/spectroscopy?${params}`,({transition:d,series})=>{
      session.result.innerHTML=`<div class="result-heading"><span class="method-badge">${esc(d.model)}</span><h2>${d.wavelength_nm.toFixed(3)} <small>nm · vacuum</small></h2><p>${esc(d.kind)} · ${d.allowed?'Electric-dipole allowed':'Electric-dipole forbidden for these states/components'}</p></div><dl class="result-metrics"><div><dt>Photon energy |ΔE|</dt><dd>${Math.abs(d.delta_ev).toFixed(6)} eV</dd></div><div><dt>Frequency</dt><dd>${d.frequency_hz.toExponential(5)} Hz</dd></div><div><dt>Σq |⟨f|r_q|i⟩|²</dt><dd>${d.dipole_squared_a0.toPrecision(6)} a₀²</dd></div></dl><p class="lab-explanation">${esc(d.selection_note)}</p>${visibleSpectrum(d.wavelength_nm)}<h3>${esc(series.name)} series</h3><p class="lab-explanation">Line markers show shell energy differences at equal height; height represents no intensity. Limit: ${series.limit_nm.toFixed(3)} nm. ${esc(series.note)}</p>${plot([{label:series.name+' shell wavelengths',color:'#68cce7',x:series.lines.flatMap(v=>[v.wavelength_nm,v.wavelength_nm,v.wavelength_nm]),y:series.lines.flatMap(()=>[0,1,0])}],'Vacuum wavelength / nm','Shell difference marker',`${series.name} / ${params.get('z')==='2'?'He⁺':'H'} / nonrelativistic`)}<div class="lab-actions"><button data-csv>Export CSV</button><button data-png>Export graph PNG</button></div>${assumptions(d.assumptions+' Vacuum wavelengths must not be compared directly to tabulated air wavelengths. Fine-structure components are unresolved. Complex mₗ eigenstates are used; real-orbital indices are not magnetic quantum numbers.')}`;
      session.result.querySelector('[data-csv]')!.addEventListener('click',()=>csv('quantum-spectrum.csv',d.model,params.toString(),[['selected_transition_wavelength_nm_vacuum','frequency_Hz','delta_E_eV','E1_allowed','dipole_squared_a0^2'],[d.wavelength_nm,d.frequency_hz,d.delta_ev,String(d.allowed),d.dipole_squared_a0],[],['upper_n','lower_n','vacuum_wavelength_nm','delta_E_eV'],...series.lines.map(v=>[v.upper_n,v.lower_n,v.wavelength_nm,v.delta_ev])]));
      session.result.querySelector('[data-png]')!.addEventListener('click',()=>{void plotPng(session.result.querySelector('svg')!,'quantum-spectrum.png').catch(e=>session.status.textContent=String(e));});
    });
  };
  session.form.onsubmit=e=>{e.preventDefault();calculate();};
  calculate();return session.dispose;
}
