/** Local playback is opt-in, bounded to ten redraws/s, and owns its RAF lifetime. */
export class Playback {
  private frame=0;
  private playing=false;
  private time=0;
  private last=0;
  private rendered=0;
  private onVisibility=()=>{if(document.hidden)this.pause();};
  readonly slider: HTMLInputElement;
  private button: HTMLButtonElement;
  constructor(private host: HTMLElement, private max:number, private perSecond:number, private draw:(time:number)=>void){
    host.innerHTML=`<div class="playback"><button type="button" data-play>Play</button><button type="button" data-rewind>Rewind</button><label>Time / atomic units<input data-time type="range" min="0" max="${max}" step="${max/1000}" value="0"><output data-time-value>0.000</output></label><label>Playback speed<select data-speed><option value=".25">¼×</option><option value=".5">½×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label></div>`;
    this.slider=host.querySelector('[data-time]')!;this.button=host.querySelector('[data-play]')!;
    this.button.onclick=()=>{if(this.playing)this.pause();else{if(this.time>=this.max)this.seek(0);this.playing=true;this.button.textContent='Pause';this.last=performance.now();this.frame=requestAnimationFrame(this.tick);}};
    host.querySelector<HTMLButtonElement>('[data-rewind]')!.onclick=()=>{this.pause();this.seek(0);};
    this.slider.oninput=()=>{this.pause();this.seek(Number(this.slider.value));};
    document.addEventListener('visibilitychange',this.onVisibility);
    this.seek(0);
  }
  private tick=(now:number)=>{
    if(!this.playing)return;
    const speed=Number(this.host.querySelector<HTMLSelectElement>('[data-speed]')!.value);
    this.time=Math.min(this.max,this.time+(now-this.last)/1000*this.perSecond*speed);this.last=now;
    if(now-this.rendered>=100 || this.time>=this.max){this.seek(this.time);this.rendered=now;}
    if(this.time>=this.max)this.pause();else this.frame=requestAnimationFrame(this.tick);
  };
  private seek(time:number){this.time=time;this.slider.value=String(time);this.host.querySelector('output')!.textContent=time.toFixed(3);this.draw(time);}
  pause=()=>{this.playing=false;cancelAnimationFrame(this.frame);this.button.textContent='Play';};
  dispose=()=>{this.pause();document.removeEventListener('visibilitychange',this.onVisibility);};
}
