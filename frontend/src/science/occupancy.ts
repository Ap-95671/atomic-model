import type {Species} from '../types';

export type OrbitalScope = 'ground' | 'explore' | 'prepared';
export interface OccupiedState {n:number;l:number;m:number;spins:number[]}

/** Reference Hund boxes, never inferred from the highest occupied shell. */
export function occupiedStates(atom:Species):OccupiedState[] {
 return atom.electronic.occupancy.flatMap(s=>s.orbitals.filter(o=>o.spins.length>0).map(o=>({n:s.n,l:s.l,m:o.m,spins:o.spins})));
}
export function occupancyAt(atom:Species,n:number,l:number,m:number){
 return occupiedStates(atom).find(s=>s.n===n&&s.l===l&&s.m===m);
}
export function groundSelection(atom:Species,n:number,l:number,m:number,spin:number){
 const states=occupiedStates(atom);
 const state=states.find(s=>s.n===n&&s.l===l&&s.m===m)??states.find(s=>s.n===n&&s.l===l)??states.find(s=>s.n===n)??states[0];
 if(!state)return undefined;
 return{...state,spin:state.spins.includes(spin)?spin:state.spins[0]};
}
