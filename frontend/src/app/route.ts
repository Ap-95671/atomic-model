/** Hash routes work on the local server and static hosts without rewrite rules. */
export const labNames=['atomic','molecular','dynamics','spectroscopy','experiments','computation','materials'] as const;
export type Lab=typeof labNames[number];
const visited=new Map<string,string>();
export function readRoute(){const p=new URLSearchParams(location.hash.slice(1));if(!labNames.includes(p.get('lab') as Lab))return new URLSearchParams({lab:'atomic'});return p;}
export function writeRoute(p:URLSearchParams,push=false){const hash='#'+p.toString();if(location.hash!==hash)history[push?'pushState':'replaceState'](null,'',location.pathname+location.search+hash);rememberRoute();}
export function rememberRoute(){const p=readRoute();visited.set(p.get('lab')!,p.toString());}
export function routeForLab(lab:Lab){return new URLSearchParams(visited.get(lab)??`lab=${lab}`);}
export function toolKey(scope:string){return scope==='qc'?'sub':'tool';}
export function selectTool(scope:string,value:string,push=true){const p=readRoute();p.set(toolKey(scope),value);if(scope!=='qc')p.delete('sub');p.delete('session');p.delete('params');writeRoute(p,push);}
function parameterKey(key:string){const p=readRoute();return `qal-session-v1:${p.get('lab')}:${p.get('tool')??''}:${p.get('sub')??''}:${key}`;}
export function savedParameters(key:string):Record<string,string>|undefined{
 try{const p=readRoute(),raw=p.get('session')===key?p.get('params'):sessionStorage.getItem(parameterKey(key));if(!raw||raw.length>8192)return;const value=JSON.parse(raw);if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length<=40&&Object.values(value).every(v=>typeof v==='string'&&v.length<=8192))return value;}catch{/* Invalid route/storage: use defaults. */}
}
export function rememberParameters(key:string,values:Record<string,string>){
 const text=JSON.stringify(values);if(text.length>8192)return;
 const p=readRoute();p.set('session',key);p.set('params',text);writeRoute(p);
 try{sessionStorage.setItem(parameterKey(key),text);}catch{/* Storage is optional. */}
}
/** Mount the selected tool once; avoid firing the default solver on a deep link. */
export function mountTools(host:HTMLElement,attribute:string,target:HTMLElement,mount:(key:string)=>()=>void,defaultTool:string,scope=attribute){
 const buttons=[...host.querySelectorAll<HTMLButtonElement>(`[data-${attribute}]`)];
 const keyOf=(b:HTMLButtonElement)=>b.getAttribute(`data-${attribute}`)!;
 const requested=readRoute().get(toolKey(scope)),initial=buttons.some(b=>keyOf(b)===requested)?requested!:defaultTool;
 const p=readRoute();p.set(toolKey(scope),initial);if(scope!=='qc'&&initial!=='quantum')p.delete('sub');writeRoute(p);
 let current=initial,cleanup:()=>void;
 const activate=(key:string)=>{buttons.forEach(b=>b.setAttribute('aria-pressed',String(keyOf(b)===key)));cleanup=mount(key);};activate(initial);
 for(const b of buttons)b.onclick=()=>{const key=keyOf(b);if(key===current)return;cleanup();current=key;selectTool(scope,key);activate(key);};
 return()=>cleanup();
}
