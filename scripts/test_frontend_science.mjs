/** Frontend preparation/periodic contracts against bundled source records. */
import assert from 'node:assert/strict';
import {build} from '../frontend/node_modules/esbuild/lib/main.js';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const scratch=await mkdtemp(join(tmpdir(),'qal-preparation-'));let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
try{
 const output=join(scratch,'science.mjs');await build({stdin:{contents:'export * from "./frontend/src/science/prepared-configuration.ts";export * from "./frontend/src/science/element-properties.ts";',resolveDir:process.cwd()},outfile:output,bundle:true,platform:'node',format:'esm'});
 const {referenceElectrons,preparedSpecies,moveElectron,validateConfiguration,validateSpinOrbital,propertyRecords,propertyDefinitions,propertyValue}=await import(pathToFileURL(output));
 const data=JSON.parse(await readFile('frontend/static-data/reference.json','utf8'));
 for(const element of data.elements){const atom={...element,electrons:element.z,electronic:data.configurations[`${element.z},0`]},states=referenceElectrons(atom),prepared=preparedSpecies(atom,states);check(states.length===element.z,`Z=${element.z}: electron count`);assert.deepEqual(prepared.electronic.configuration,atom.electronic.configuration);checks++;for(const s of prepared.electronic.occupancy)check(s.electrons<=2*(2*s.l+1),'Subshell capacity');}
 const hydrogen={...data.elements[0],electrons:1,electronic:data.configurations['1,0']};
 const excited=moveElectron(referenceElectrons(hydrogen),0,[2,1,0,.5]);check(preparedSpecies(hydrogen,excited).electronic.text==='2p1','Hydrogen prepared 2p occupancy');
 const helium={...data.elements[1],electrons:2,electronic:data.configurations['2,0']};assert.throws(()=>moveElectron(referenceElectrons(helium),0,[1,0,0,-.5]),/Pauli/);checks++;
 for(const state of [[0,0,0,.5],[2,2,0,.5],[2,1,2,.5],[2,1,0,0],[9,0,0,.5],[2.5,1,0,.5],[2,1,0,true]]){assert.throws(()=>validateSpinOrbital(state));checks++;}
 assert.throws(()=>validateConfiguration(excited,2),/exactly 2/);assert.throws(()=>validateConfiguration([[1,0,0,.5],[1,0,0,.5]],2),/Pauli/);checks+=2;
 const source=JSON.parse(await readFile('data/sources/pubchem-periodic-table.json','utf8')).Table;check(propertyRecords.length===118,'All source rows retained');
 for(let z=1;z<=118;z++)for(const [key,d] of Object.entries(propertyDefinitions)){const raw=source.Row[z-1].Cell[source.Columns.Column.indexOf(d.column)],expected=raw.trim()&&Number.isFinite(Number(raw))?Number(raw):null;assert.equal(propertyValue(z,key),expected);checks++;}
 check(propertyValue(1,'radius')===120,'Hydrogen source radius is van der Waals pm');check(propertyValue(2,'electronegativity')===null,'Unknown electronegativity stays unknown');
 console.log(`PASS: ${checks} frontend science checks: all 118 reference round trips, Pauli/electron/quantum validation, and source-preserved periodic properties.`);
}finally{await rm(scratch,{recursive:true,force:true});}
