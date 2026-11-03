import snapshot from '../../../data/sources/pubchem-periodic-table.json';
export const propertyDefinitions={
 electronegativity:{column:'Electronegativity',label:'Electronegativity',unit:'Pauling scale'},
 radius:{column:'AtomicRadius',label:'Van der Waals radius',unit:'pm'},
 ionization:{column:'IonizationEnergy',label:'First ionization energy',unit:'eV'},
 affinity:{column:'ElectronAffinity',label:'Electron affinity',unit:'eV'},
 melting:{column:'MeltingPoint',label:'Melting temperature',unit:'K'},
 boiling:{column:'BoilingPoint',label:'Boiling temperature',unit:'K'},
 density:{column:'Density',label:'Density',unit:'g/cm³'},
} as const;
export type PropertyKey=keyof typeof propertyDefinitions;
const columns=snapshot.Table.Columns.Column;
export const propertyRecords=snapshot.Table.Row.map(row=>Object.fromEntries(columns.map((key,i)=>[key,row.Cell[i]])));
/** Empty source cells remain unknown; no zero fill or extrapolation. */
export function propertyValue(z:number,key:PropertyKey){
 const raw=propertyRecords[z-1]?.[propertyDefinitions[key].column];
 if(!raw?.trim())return null;const value=Number(raw);return Number.isFinite(value)?value:null;
}
