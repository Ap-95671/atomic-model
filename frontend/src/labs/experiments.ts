import { mountFields } from './fields';
import { mountMeasurement } from './measurement';
import { mountTunneling } from './tunneling';
/** Experiment-local navigation preserves a single mounted scientific lifetime. */
export function mountExperiments(host:HTMLElement){
  host.innerHTML='<nav class="experiment-nav" aria-label="Quantum experiments"><button aria-pressed="true" data-experiment="measurement">Measurement</button><button aria-pressed="false" data-experiment="tunneling">Tunneling</button><button aria-pressed="false" data-experiment="fields">Fields & Spin</button></nav><div data-experiment-host></div>';
  const target=host.querySelector<HTMLElement>('[data-experiment-host]')!;
  let cleanup=mountMeasurement(target);
  host.querySelectorAll<HTMLButtonElement>('[data-experiment]').forEach(button=>button.onclick=()=>{
    cleanup();host.querySelectorAll('[data-experiment]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    cleanup=button.dataset.experiment==='measurement'?mountMeasurement(target):button.dataset.experiment==='tunneling'?mountTunneling(target):mountFields(target);
  });
  return()=>cleanup();
}
