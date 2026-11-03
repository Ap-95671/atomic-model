import {mountTools} from '../app/route';
import {mountQuantumComputing} from "./quantum-computing";
import {mountOpenSystems} from "./open-systems";
import { mountFields } from './fields';
import { mountMeasurement } from './measurement';
import { mountTunneling } from './tunneling';
/** Experiment-local navigation preserves a single mounted scientific lifetime. */
export function mountExperiments(host:HTMLElement){
  host.innerHTML='<nav class="experiment-nav" aria-label="Quantum experiments"><button aria-pressed="true" data-experiment="measurement">Measurement</button><button aria-pressed="false" data-experiment="tunneling">Tunneling</button><button aria-pressed="false" data-experiment="quantum">Quantum computing</button><button aria-pressed="false" data-experiment="open">Decoherence</button><button aria-pressed="false" data-experiment="fields">Fields & Spin</button></nav><div data-experiment-host></div>';
  const target=host.querySelector<HTMLElement>('[data-experiment-host]')!;
  return mountTools(host,'experiment',target,key=>key==='measurement'?mountMeasurement(target):key==='tunneling'?mountTunneling(target):key==='open'?mountOpenSystems(target):key==='quantum'?mountQuantumComputing(target):mountFields(target),'measurement');
}
