/** Successful read-only responses only. No shared request cancellation or errors. */
export class ResultCache {
 private entries=new Map<string,{text:string;expires:number;bytes:number}>();private bytes=0;
 constructor(readonly maxBytes=16*1024*1024,readonly maxEntries=32,readonly ttlMs=300000){}
 get(key:string){const entry=this.entries.get(key);if(!entry)return;if(entry.expires<=Date.now()){this.remove(key);return;}this.entries.delete(key);this.entries.set(key,entry);return entry.text;}
 set(key:string,text:string){const bytes=text.length*2;if(bytes>this.maxBytes/2)return;this.remove(key);while(this.bytes+bytes>this.maxBytes||this.entries.size>=this.maxEntries)this.remove(this.entries.keys().next().value!);this.entries.set(key,{text,bytes,expires:Date.now()+this.ttlMs});this.bytes+=bytes;}
 private remove(key:string){const old=this.entries.get(key);if(old){this.bytes-=old.bytes;this.entries.delete(key);}}
 clear(){this.entries.clear();this.bytes=0;}
 get size(){return this.entries.size;}
 get retainedBytes(){return this.bytes;}
}
export const readCache=new ResultCache();
export function cacheKey(url:string){const u=new URL(url,location.origin);if(u.origin!==location.origin||!u.pathname.startsWith('/api/')||/^\/api\/(jobs|health|capabilities)(\/|$)/.test(u.pathname))return;u.searchParams.sort();return u.pathname+u.search;}
export function stableKey(value:unknown):string {if(Array.isArray(value))return '['+value.map(stableKey).join(',')+']';if(value&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stableKey(v)).join(',')+'}';return JSON.stringify(value)??'null';}
