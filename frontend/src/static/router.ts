import {energy,measurement,molecule,number,orbital,species,spectroscopy,transition,twoState,type Reference} from './science';
import {circuit} from './circuit';
export function calculate(input:string,data:Reference):unknown{
 const url=new URL(input,'https://static.invalid'),p=url.searchParams;
 if(input.length>16000)throw new Error('Browser parameters exceed the supported size.');
 switch(url.pathname){
  case '/api/elements':return data.elements;
  case '/api/species':return species(p,data);
  case '/api/orbital':return orbital(p,data);
  case '/api/chemistry/catalog':return data.catalog;
  case '/api/molecular':return molecule(p);
  case '/api/molecular/diagram':{const result=data.diagrams[p.get('name')??'o2'];if(!result)throw new Error('Unknown reference diagram');return {...result as object,_provenance:{kind:'reference',note:'Bundled qualitative occupation scheme; no numerical molecular energies.'}};}
  case '/api/molecular/structure':{const result=data.structures[p.get('name')??'water'];if(!result)throw new Error('Unknown source conformer');return {...result as object,_provenance:{kind:'precomputed',note:'Bundled PubChem3D source conformer; no live optimization.'}};}
  case '/api/energy':{const atom=species(p,data);if(!atom.one_electron)throw new Error('Hydrogenic energies require a one-electron species');return{levels:Array.from({length:8},(_,i)=>energy(i+1,atom.z,atom.nuclear_mass_u,data)),...transition(number(p,'initial',3,1,30,true),number(p,'final',2,1,30,true),atom,data)};}
  case '/api/spectroscopy':return spectroscopy(p,data);
  case '/api/measurement':return measurement(p,data);
  case '/api/dynamics/superposition':return twoState(p);
  case '/api/physics':if(p.get('operation')==='circuit')return circuit(JSON.parse(p.get('parameters')??'{}'));break;
 }
 throw new Error('Requires the advanced local Python environment. This static demo does not run this solver or fabricate a result. See the browser-demo feature guide for supported experiments and recorded datasets.');
}
