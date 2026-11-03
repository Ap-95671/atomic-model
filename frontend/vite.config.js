import { defineConfig } from "vite";
import {readFileSync} from 'node:fs';
const previewHeaders=Object.fromEntries(readFileSync(new URL('./pages/_headers',import.meta.url),'utf8').split('/assets/*')[0].split('\n').filter(line=>line.startsWith('  ')).map(line=>{const at=line.indexOf(':');return[line.slice(0,at).trim(),line.slice(at+1).trim()];}));
export default defineConfig({
  server: { proxy: { "/api": "http://127.0.0.1:8765" } },
  preview:{headers:previewHeaders},
});
