export interface RuntimeCapabilities{mode:'local'|'public';static_demo?:boolean;advanced_computation:boolean;atomic_max_points:number;atomic_qualities:string[];message:string;}
export let runtime:RuntimeCapabilities={mode:'local',advanced_computation:true,atomic_max_points:60000,atomic_qualities:['preview','balanced','high'],message:''};
export async function initializeRuntime(){
 if(import.meta.env.VITE_STATIC_DEMO==='true')runtime=(await import('../static/client')).staticCapabilities;
 else try{
  const response=await fetch('/api/capabilities',{signal:AbortSignal.timeout(5000)});
  if(response.ok)runtime=await response.json();
 }catch{/* Older local servers preserve their existing behavior. */}
 if(runtime.mode==='public'){
  const banner=document.createElement('aside');banner.className='public-demo-notice';banner.setAttribute('role','note');
  banner.textContent=runtime.message+(runtime.static_demo?' ':' No paid services or account are needed to use this demo.');
  if(runtime.static_demo){const footer=document.querySelector('footer > span:last-child');if(footer)footer.textContent='Browser calculations + recorded Python datasets / Three.js · WebGL';const link=document.createElement('a');link.href='/demo-guide.html';link.textContent='Models, datasets & local research guide ↗';link.target='_blank';link.rel='noreferrer';banner.append(link);}
  document.querySelector('.topbar')?.after(banner);
  const status=document.querySelector('.local-status');if(status)status.textContent=runtime.static_demo?'BROWSER DEMO':'PUBLIC DEMO';
  const tagline=document.querySelector('.brand small');if(tagline)tagline.textContent='A BOUNDED SCIENTIFIC DEMO';
 }
 return runtime;
}
export const advancedMessage='Available in advanced local mode. This public demo does not run expensive chemistry jobs. Install the full local application and optional computation dependencies to use this method.';
