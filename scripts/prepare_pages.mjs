/** Static-only artifact: no Worker/Functions, runtime Python, secret or local API. */
import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import crypto from 'node:crypto';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'frontend/dist-pages'),source=path.join(root,'frontend/pages');
await fs.cp(source,out,{recursive:true});
const indexPath=path.join(out,'index.html');let index=await fs.readFile(indexPath,'utf8');index=index.replace(/<title>.*?<\/title>/,'<title>Quantum Atom Lab · Interactive Browser Demo</title>').replace('Explore normalized Schrödinger wavefunctions in an interactive local 3D laboratory.','Explore atomic orbitals, molecular bonding and quantum experiments in a free interactive browser lab. Live calculations and recorded datasets are clearly labeled.');index=index.replace('</head>','<meta property="og:title" content="Quantum Atom Lab · Interactive Browser Demo"/><meta property="og:type" content="website"/><meta property="og:description" content="Explore s/p/d/f orbitals, molecular bonding and quantum experiments. Live browser calculations and reproducible recorded datasets."/></head>');await fs.writeFile(indexPath,index);

const manifest=JSON.parse(await fs.readFile(path.join(root,'frontend/static-data/manifest.json'),'utf8')),assets=await fs.readdir(path.join(out,'assets'));
for(const file of manifest.files){const basename=file.file.replace(/\.json$/,''),built=assets.find(name=>name.startsWith(basename+'-')&&name.endsWith('.json'));if(!built)throw new Error('Missing bundled dataset '+file.file);const bytes=await fs.readFile(path.join(out,'assets',built));if(crypto.createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw new Error('Dataset provenance mismatch '+file.file);file.public_asset='/assets/'+built;}
await fs.writeFile(path.join(out,'dataset-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const commit=process.env.CF_PAGES_COMMIT_SHA??execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const dirty=!process.env.CF_PAGES_COMMIT_SHA&&!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim();
await fs.writeFile(path.join(out,'build-info.json'),JSON.stringify({application:'Quantum Atom Lab',mode:'browser-static',source_commit:commit,source_dirty:dirty,built_at:new Date().toISOString(),python_runtime:false,api_backend:false},null,2)+'\n');
const files=await fs.readdir(out,{recursive:true});let total=0;for(const name of files){const info=await fs.stat(path.join(out,name));if(info.isFile()){if(info.size>25*1024*1024)throw new Error('Pages file exceeds 25 MiB: '+name);total+=info.size;}}
if(files.some(name=>/(^|\/)(_worker\.js|functions)(\/|$)/.test(name)))throw new Error('Pages build must not contain server functions.');
console.log(`Static Pages artifact: ${total} bytes; no backend, bindings or billable functions.`);
