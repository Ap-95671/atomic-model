export interface ElementData {
  z: number;
  symbol: string;
  name: string;
  category: string;
  period: number;
  group: number | null;
  table_row: number;
  table_column: number;
  default_a: number;
  configuration: string;
  configuration_status: string;
}
export interface OrbitalBox {
  m: number;
  spins: number[];
}
export interface Occupancy {
  subshell: string;
  n: number;
  l: number;
  electrons: number;
  orbitals: OrbitalBox[];
}
export interface Isotope {
  a: number;
  mass_u: number | null;
  abundance: number | null;
  label: string;
  verified: boolean;
}
export interface Species extends ElementData {
  a: number;
  charge: number;
  protons: number;
  neutrons: number;
  electrons: number;
  one_electron: boolean;
  isotope: Isotope;
  isotopes: Isotope[];
  electronic: {
    electrons?:number;
    text: string;
    status: string;
    configuration: Record<string, number> | null;
    occupancy: Occupancy[];
    shells: Record<string, number>;
  };
}
export interface MeshData {
  vertices: number[][];
  faces: number[][];
  phases?: number[];
  sign?: number;
}
export interface OrbitalData {
  points: number[][];
  phases: number[];
  surfaces: MeshData[];
  node_mesh: MeshData | null;
  radial_nodes: number[];
  extent: number;
  extent_a0: number;
  extent_nm: number;
  length_scale_a0: number;
  label: string;
  nodes: { radial: number; angular: number; total: number };
  radial: { r: number[]; p: number[] };
  angular: { theta: number[]; probability: number[] };
  normalization: number;
  coulomb_charge: number;
  energy_ev: number | null;
  model: string;
  basis_note: string;
  surface_note: string;
  count?: number;
  grid_size?: number;
}
