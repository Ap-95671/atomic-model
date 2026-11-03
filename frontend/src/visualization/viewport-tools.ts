import {readRoute,writeRoute} from '../app/route';

export interface CameraState {position:number[];target:number[]}
export interface ViewportActions {
 preset:(view:string)=>void;quality:(value:string)=>void;
 camera:()=>CameraState;restore:(value:unknown)=>boolean;
 rotate:(active:boolean,speed:number)=>void;screenshot:(scale:number)=>string;
}
let presentation:{container:HTMLElement;button:HTMLElement;focus:HTMLElement|null}|undefined;
function leavePresentation(){
 const current=presentation;if(!current)return;presentation=undefined;
 current.container.classList.remove('viewport-presenting');document.body.classList.remove('lab-presenting');current.button.setAttribute('aria-pressed','false');current.focus?.focus();
}
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)leavePresentation();});
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&presentation){leavePresentation();if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});}});

export function viewportTools(container:HTMLElement,actions:ViewportActions){
 const tools=document.createElement('div');tools.className='universal-viewport-tools';tools.setAttribute('aria-label','3D viewport controls');
 tools.innerHTML='<label>Camera<select data-v-camera aria-label="Viewport camera"><option value="default">Perspective</option><option value="x">Along x</option><option value="y">Along y</option><option value="z">Along z</option></select></label><label>Display<select data-v-quality aria-label="Viewport display quality"><option value="preview">Low power</option><option value="balanced">Balanced</option><option value="high">High detail</option></select></label><button data-v-rotate aria-pressed="false">Rotate camera</button><label>Speed<select data-v-speed aria-label="Camera rotation speed"><option value="0.25">Slow</option><option value="0.55" selected>Normal</option><option value="1.5">Fast</option></select></label><button data-v-presentation aria-label="Present this 3D viewport" aria-pressed="false">⛶</button><button data-v-export aria-label="Export this viewport as PNG">PNG</button><button data-v-export2 aria-label="Export this viewport as high resolution PNG">2× PNG</button><span data-v-status role="status"></span>';
 container.append(tools);
 const get=<T extends HTMLElement>(key:string)=>tools.querySelector<T>(`[data-v-${key}]`)!;
 const quality=get<HTMLSelectElement>('quality'),speed=get<HTMLSelectElement>('speed'),rotate=get<HTMLButtonElement>('rotate');
 let cameraFrame=0;
 const remember=()=>{
  const p=readRoute();if(p.get('lab')==='home')return;
  p.set('view',JSON.stringify({camera:actions.camera(),quality:quality.value,rotate:rotate.getAttribute('aria-pressed')==='true',speed:speed.value}));writeRoute(p);
 };
 const changed=()=>{cancelAnimationFrame(cameraFrame);cameraFrame=requestAnimationFrame(remember);};
 container.addEventListener('qal-camera-change',changed);
 get<HTMLSelectElement>('camera').onchange=e=>{actions.preset((e.target as HTMLSelectElement).value);remember();};
 quality.onchange=()=>{actions.quality(quality.value);remember();};
 rotate.onclick=()=>{const active=rotate.getAttribute('aria-pressed')!=='true';rotate.setAttribute('aria-pressed',String(active));rotate.textContent=active?'Pause camera':'Rotate camera';actions.rotate(active,Number(speed.value));remember();};
 speed.onchange=()=>{actions.rotate(rotate.getAttribute('aria-pressed')==='true',Number(speed.value));remember();};
 const button=get<HTMLButtonElement>('presentation');button.onclick=async()=>{
  if(presentation?.container===container){if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});leavePresentation();return;}
  leavePresentation();presentation={container,button,focus:document.activeElement as HTMLElement};container.classList.add('viewport-presenting');document.body.classList.add('lab-presenting');button.setAttribute('aria-pressed','true');await container.requestFullscreen?.().catch(()=>{});
 };
 for(const [key,scale] of [['export',1],['export2',2]] as const)get<HTMLButtonElement>(key).onclick=()=>{
  try{const anchor=document.createElement('a');anchor.download=`quantum-viewport-${scale}x.png`;anchor.href=actions.screenshot(scale);anchor.click();get('status').textContent='PNG saved.';}catch(error){get('status').textContent=`Export failed: ${(error as Error).message}`;}
 };
 try{const state=JSON.parse(readRoute().get('view')??'null');if(state){actions.restore(state.camera);if(['preview','balanced','high'].includes(state.quality))quality.value=state.quality;if(['0.25','0.55','1.5'].includes(state.speed))speed.value=state.speed;if(state.rotate===true){rotate.setAttribute('aria-pressed','true');rotate.textContent='Pause camera';actions.rotate(true,Number(speed.value));}}}catch{/* Invalid camera URL has safe defaults. */}
 actions.quality(quality.value);
 return()=>{cancelAnimationFrame(cameraFrame);container.removeEventListener('qal-camera-change',changed);if(presentation?.container===container){leavePresentation();if(document.fullscreenElement===container)void document.exitFullscreen().catch(()=>{});}tools.remove();};
}
