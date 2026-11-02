import { api } from './api';
export interface ChemistrySystem{id:string;label:string;charge:number;spin:number;diatomic:boolean;distance:number;}
export interface ChemistryCatalog{systems:ChemistrySystem[];methods:string[];bases:string[];}
let stored:Promise<ChemistryCatalog>|undefined;
export function chemistryCatalog(){return stored??=(api<ChemistryCatalog>('/api/chemistry/catalog').catch(error=>{stored=undefined;throw error;}));}
export interface Channel{name:string;energies_hartree:number[];occupations:number[];homo:number|null;lumo:number|null;gap_hartree:number|null;}
export interface ScientificField{
  extent:number;centers_a0:number[][];points:number[][];phases:number[];surfaces:import('../types').MeshData[];
  field_kind:string;channel:string;orbital_index:number|null;grid_size:number;peak:number;threshold:number;finite_grid_integral:number|null;surface_note:string;
}
export interface ChemistryResult{
  model:string;request:Record<string,string|number|boolean>;converged:boolean;total_energy_hartree:number;
  energy_components_hartree:Record<string,number>;energy_decomposition_error:number;basis_size:number;electron_count:number;
  spin_electron_counts:number[];spin_squared:number;spin_squared_target:number;spin_contamination:number;channels:Channel[];
  orthonormality_error:number;spin_density_idempotency_error:number;scf_history:{iteration:number;total_energy_hartree:number;density_change?:number;orbital_gradient?:number}[];
  centers_a0:number[][];atomic_numbers:number[];geometry_note:string;assumptions:string;field:ScientificField;
  resources:{wall_seconds:number;cpu_seconds:number;peak_rss_mib:number};
}
