import {random} from './math';
type Complex=[number,number];
const mul=(a:Complex,b:Complex):Complex=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]];
const sum=(a:Complex,b:Complex):Complex=>[a[0]+b[0],a[1]+b[1]];
interface Gate{gate:string;target:number;control?:number;angle?:number;}
export function circuit(p:{qubits?:number;shots?:number;seed?:number;gates?:Gate[]}){
 const qubits=p.qubits??2,shots=p.shots??2000,seed=p.seed??42,gates=p.gates??[{gate:'H',target:0},{gate:'CX',control:0,target:1}];
 const int=(v:number,min:number,max:number)=>Number.isInteger(v)&&v>=min&&v<=max;
 if(!int(qubits,1,4)||!int(shots,0,5000)||!int(seed,0,4294967295)||!Array.isArray(gates)||gates.length>32)throw new Error('Circuits require 1…4 qubits, 0…5000 shots, uint32 seed and ≤32 gates.');
 const n=2**qubits,state=Array.from({length:n},(_,i):Complex=>[i===0?1:0,0]);
 for(const g of gates){if(!g||!int(g.target,0,qubits-1))throw new Error('Invalid gate target');const t=g.target,c=g.control;
  if(['CX','CZ','SWAP'].includes(g.gate)){
   if(c===undefined||!int(c,0,qubits-1)||c===t)throw new Error('Control and target must be distinct valid qubits');
   for(let i=0;i<n;i++){
    if(g.gate==='CX'&&(i>>c&1)&&!(i>>t&1)){const j=i^(1<<t);[state[i],state[j]]=[state[j],state[i]];}
    if(g.gate==='CZ'&&(i>>c&1)&&(i>>t&1))state[i]=state[i].map(v=>-v) as Complex;
    if(g.gate==='SWAP'&&(i>>c&1)&&!(i>>t&1)){const j=i^(1<<t)^(1<<c);[state[i],state[j]]=[state[j],state[i]];}
   }continue;
  }
  let matrix:Complex[][];
  if(['RX','RY','RZ'].includes(g.gate)){const angle=g.angle;if(angle===undefined||!Number.isFinite(angle)||Math.abs(angle)>100)throw new Error('Rotation angle must be finite and within ±100 radians');const co=Math.cos(angle/2),si=Math.sin(angle/2);
   matrix=g.gate==='RX'?[[[co,0],[0,-si]],[[0,-si],[co,0]]]:g.gate==='RY'?[[[co,0],[-si,0]],[[si,0],[co,0]]]:[[[co,-si],[0,0]],[[0,0],[co,si]]];
  }else{const matrices:Record<string,Complex[][]>={H:[[[Math.SQRT1_2,0],[Math.SQRT1_2,0]],[[Math.SQRT1_2,0],[-Math.SQRT1_2,0]]],X:[[[0,0],[1,0]],[[1,0],[0,0]]],Y:[[[0,0],[0,-1]],[[0,1],[0,0]]],Z:[[[1,0],[0,0]],[[0,0],[-1,0]]],S:[[[1,0],[0,0]],[[0,0],[0,1]]],T:[[[1,0],[0,0]],[[0,0],[Math.SQRT1_2,Math.SQRT1_2]]]};matrix=matrices[g.gate];if(!matrix)throw new Error('Unsupported quantum gate');}
  for(let i=0;i<n;i++)if(!(i>>t&1)){const j=i^(1<<t),a=state[i],b=state[j];state[i]=sum(mul(matrix[0][0],a),mul(matrix[0][1],b));state[j]=sum(mul(matrix[1][0],a),mul(matrix[1][1],b));}
 }
 const probabilities=state.map(([r,i])=>r*r+i*i),counts=Array<number>(n).fill(0),rng=random(seed);for(let k=0;k<shots;k++){let r=rng(),i=0;while(i<n-1&&r>=probabilities[i])r-=probabilities[i++];counts[i]++;}
 let a=0,b=0,re=0,im=0;for(let i=0;i<n;i+=2){const x=state[i],y=state[i+1];a+=x[0]**2+x[1]**2;b+=y[0]**2+y[1]**2;re+=x[0]*y[0]+x[1]*y[1];im+=x[1]*y[0]-x[0]*y[1];}
 const length=Math.hypot(2*re,2*im,a-b),eigen=[(1+length)/2,(1-length)/2];
 return{model:'BROWSER CALCULATION · ideal state-vector circuit',qubits,gates,shots,seed,basis_labels:state.map((_,i)=>i.toString(2).padStart(qubits,'0')),state_real:state.map(v=>v[0]),state_imag:state.map(v=>v[1]),probabilities,counts,norm_error:Math.abs(probabilities.reduce((a,b)=>a+b,0)-1),qubit0_bloch:[2*re,-2*im,a-b],qubit0_purity:a*a+b*b+2*(re*re+im*im),qubit0_entropy_bits:-eigen.reduce((v,x)=>v+(x>1e-15?x*Math.log2(x):0),0),assumptions:'Ideal pure-state simulation; |0…0〉 input, up to four qubits. q0 is rightmost/little endian. No noise, hardware, mid-circuit measurement or conditional gates. Final shots use Mulberry32, not NumPy. Qubit-0 entropy measures entanglement because the full state is pure.',_provenance:{kind:'interactive',prng:'Mulberry32'}};
}
