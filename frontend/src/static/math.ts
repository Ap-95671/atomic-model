/** Browser Coulomb model. Conventions match quantum_engine; no Python runtime. */
export const linspace=(a:number,b:number,n:number)=>Array.from({length:n},(_,i)=>a+(b-a)*i/(n-1));
export function factorial(n:number){let v=1;for(let i=2;i<=n;i++)v*=i;return v;}
export function laguerre(k:number,alpha:number,x:number){if(!k)return 1;let a=1,b=1+alpha-x;for(let i=2;i<=k;i++){const c=((2*i-1+alpha-x)*b-(i-1+alpha)*a)/i;a=b;b=c;}return b;}
export function radial(n:number,l:number,r:number){const rho=2*r/n;return Math.sqrt((2/n)**3*factorial(n-l-1)/(2*n*factorial(n+l)))*Math.exp(-rho/2)*rho**l*laguerre(n-l-1,2*l+1,rho);}
export function harmonic(l:number,m:number,u:number,phi:number,basis='real'):[number,number]{
 const k=Math.abs(m);let p=1;for(let j=1;j<=k;j++)p*=-(2*j-1)*Math.sqrt(Math.max(0,1-u*u));
 if(l>k){let a=p,b=(2*k+1)*u*p;p=b;for(let j=k+2;j<=l;j++){p=((2*j-1)*u*b-(j+k-1)*a)/(j-k);a=b;b=p;}}
 const v=Math.sqrt((2*l+1)/(4*Math.PI)*factorial(l-k)/factorial(l+k))*p;
 if(basis==='real')return [m===0?v:Math.SQRT2*(-1)**k*v*(m>0?Math.cos(k*phi):Math.sin(k*phi)),0];
 return m>=0?[v*Math.cos(k*phi),v*Math.sin(k*phi)]:[(-1)**k*v*Math.cos(k*phi),-((-1)**k)*v*Math.sin(k*phi)];
}
export function wave(n:number,l:number,m:number,basis:string,p:number[]):[number,number]{const r=Math.hypot(...p),y=harmonic(l,m,r?p[2]/r:0,Math.atan2(p[1],p[0]),basis),v=radial(n,l,r);return [v*y[0],v*y[1]];}
export function random(seed:number){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
export function interpolate(x:number[],y:number[],value:number){if(value<=x[0])return y[0];if(value>=x[x.length-1])return y[y.length-1];let a=0,b=x.length-1;while(b-a>1){const mid=(a+b)>>1;if(x[mid]<value)a=mid;else b=mid;}return y[a]+(y[b]-y[a])*(value-x[a])/(x[b]-x[a]);}
export function distribution(n:number,l:number){
 const r=linspace(0,10*n*n+20,8193),p=r.map(x=>x*x*radial(n,l,x)**2),cdf=[0],nodes:number[]=[];
 for(let i=1;i<r.length;i++){cdf.push(cdf[i-1]+(p[i]+p[i-1])*(r[i]-r[i-1])/2);if(r[i-1]>0&&radial(n,l,r[i-1])*radial(n,l,r[i])<0){let a=r[i-1],b=r[i];for(let j=0;j<35;j++){const mid=(a+b)/2;if(radial(n,l,a)*radial(n,l,mid)<=0)b=mid;else a=mid;}nodes.push((a+b)/2);}}
 const normalization=cdf.at(-1)!;for(let i=0;i<cdf.length;i++)cdf[i]/=normalization;
 return {r,cdf,nodes,normalization,extent:interpolate(cdf,r,.999)};
}
export function minimize(fn:(x:number)=>number,a:number,b:number){const g=(Math.sqrt(5)-1)/2;let c=b-g*(b-a),d=a+g*(b-a);for(let i=0;i<60;i++){if(fn(c)<fn(d)){b=d;d=c;c=b-g*(b-a);}else{a=c;c=d;d=a+g*(b-a);}}return(a+b)/2;}
/** Gauss–Legendre nodes/weights, Newton roots of P_n; bounded n=32 usage. */
export function gaussLegendre(n=32){
 const nodes=Array<number>(n).fill(0),weights=Array<number>(n).fill(0);
 for(let i=0;i<Math.ceil(n/2);i++){
  let x=Math.cos(Math.PI*(i+.75)/(n+.5)),derivative=0;
  for(let step=0;step<30;step++){let a=1,b=x;for(let k=2;k<=n;k++){const c=((2*k-1)*x*b-(k-1)*a)/k;a=b;b=c;}derivative=n*(x*b-a)/(x*x-1);const dx=b/derivative;x-=dx;if(Math.abs(dx)<1e-15)break;}
  const w=2/((1-x*x)*derivative*derivative);nodes[i]=-x;nodes[n-1-i]=x;weights[i]=w;weights[n-1-i]=w;
 }
 return{nodes,weights};
}
