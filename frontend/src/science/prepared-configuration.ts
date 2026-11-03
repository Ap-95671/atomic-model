import type {Species,Occupancy} from '../types';
export type SpinOrbital=[number,number,number,number];
export function validateSpinOrbital(value:unknown):asserts value is SpinOrbital {
 if(!Array.isArray(value)||value.length!==4)throw new Error('A spin orbital needs n, l, basis index and spin.');
 const [n,l,m,spin]=value;
 if(![n,l,m].every(Number.isInteger)||n<1||n>8||l<0||l>=n||l>3||Math.abs(m)>l)throw new Error('Require integer n = 1…8, 0 ≤ l < n (s/p/d/f), and −l ≤ index ≤ l.');
 if(spin!==.5&&spin!==-.5)throw new Error('Spin must be +½ or −½.');
}
export function validateConfiguration(value:unknown,electrons:number):SpinOrbital[]{
 if(!Array.isArray(value)||value.length!==electrons||value.length>118)throw new Error(`The configuration must contain exactly ${electrons} electrons.`);
 const seen=new Set<string>();
 for(const state of value){validateSpinOrbital(state);const key=state.join(',');if(seen.has(key))throw new Error('Pauli exclusion: that spin orbital is already occupied.');seen.add(key);}
 return value.map(state=>[...state] as SpinOrbital);
}
export function referenceElectrons(atom:Species):SpinOrbital[]{
 if(!atom.electronic.configuration)throw new Error('This ion has no bundled reference configuration to prepare from.');
 return atom.electronic.occupancy.flatMap(s=>s.orbitals.flatMap(o=>o.spins.map(spin=>[s.n,s.l,o.m,spin] as SpinOrbital)));
}
export function moveElectron(states:SpinOrbital[],index:number,target:SpinOrbital){
 validateConfiguration(states,states.length);validateSpinOrbital(target);
 if(!Number.isInteger(index)||index<0||index>=states.length)throw new Error('Choose an occupied source spin orbital.');
 if(states[index].join(',')===target.join(','))throw new Error('Choose a different destination spin orbital.');
 const result=states.map((state,i)=>i===index?[...target] as SpinOrbital:[...state] as SpinOrbital);
 return validateConfiguration(result,states.length);
}
export function preparedSpecies(atom:Species,states:SpinOrbital[]):Species{
 validateConfiguration(states,atom.electrons);
 const groups=new Map<string,Occupancy>();
 for(const [n,l,m,spin] of states){const key=`${n}${'spdf'[l]}`;let s=groups.get(key);if(!s){s={subshell:key,n,l,electrons:0,orbitals:Array.from({length:2*l+1},(_,i)=>({m:i-l,spins:[]}))};groups.set(key,s);}s.electrons++;s.orbitals[m+l].spins.push(spin);}
 const occupancy=[...groups.values()].sort((a,b)=>a.n-b.n||a.l-b.l),configuration=Object.fromEntries(occupancy.map(s=>[s.subshell,s.electrons])),shells:Record<string,number>={};
 for(const s of occupancy){shells[s.n]=(shells[s.n]??0)+s.electrons;for(const o of s.orbitals)o.spins.sort((a,b)=>b-a);}
 return{...atom,electronic:{configuration,occupancy,shells,electrons:atom.electrons,text:occupancy.map(s=>`${s.subshell}${s.electrons}`).join(' ')||'Bare nucleus',status:'Prepared real-basis occupancy; electron count and Pauli exclusion validated. No many-electron energy or optical-transition claim.'}};
}
