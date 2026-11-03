import type {MeshData} from '../types';
/** Piecewise-linear marching tetrahedra on a bounded nonuniform finite grid.
 * Vertices shared by grid edges; lower resolution than local marching cubes.
 */
export function extract(axis:number[],field:Float64Array,level:number,phase:(p:number[])=>number):MeshData{
 const n=axis.length,vertices:number[][]=[],faces:number[][]=[],phases:number[]=[],cache=new Map<string,number>();
 const coord=(id:number)=>[axis[Math.floor(id/n/n)],axis[Math.floor(id/n)%n],axis[id%n]];
 const edge=(a:number,b:number)=>{const key=a<b?`${a},${b}`:`${b},${a}`;const old=cache.get(key);if(old!==undefined)return old;
  const t=(level-field[a])/(field[b]-field[a]),pa=coord(a),pb=coord(b),p=pa.map((v,i)=>v+(pb[i]-v)*t),index=vertices.length;
  if(index>=160000)throw new Error('Browser mesh budget exceeded. Increase the threshold or use a cloud.');vertices.push(p);phases.push(phase(p));cache.set(key,index);return index;};
 const tetra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
 for(let i=0;i<n-1;i++)for(let j=0;j<n-1;j++)for(let k=0;k<n-1;k++){
  const id=(x:number,y:number,z:number)=>(x*n+y)*n+z;
  const cube=[id(i,j,k),id(i+1,j,k),id(i+1,j+1,k),id(i,j+1,k),id(i,j,k+1),id(i+1,j,k+1),id(i+1,j+1,k+1),id(i,j+1,k+1)];
  for(const t of tetra){const inside=t.map(v=>cube[v]).filter(v=>field[v]>level),outside=t.map(v=>cube[v]).filter(v=>field[v]<=level);
   if(!inside.length||!outside.length)continue;
   if(inside.length===1){faces.push(outside.map(b=>edge(inside[0],b)));}
   else if(outside.length===1){faces.push(inside.map(a=>edge(a,outside[0])).reverse());}
   else {const [a,b]=inside,[c,d]=outside,ac=edge(a,c),ad=edge(a,d),bc=edge(b,c),bd=edge(b,d);faces.push([ac,bc,ad],[ad,bc,bd]);}
  }
 }
 return{vertices,faces,phases};
}
export function sampleGrid(axis:number[],fn:(p:number[])=>number){const n=axis.length,field=new Float64Array(n**3);let index=0;for(const x of axis)for(const y of axis)for(const z of axis)field[index++]=fn([x,y,z]);return field;}
