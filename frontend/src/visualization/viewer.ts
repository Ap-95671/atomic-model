import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { MeshData, OrbitalData, Species } from "../types";
import {viewportTools,type CameraState} from './viewport-tools';

const positive = new THREE.Color("#59c8e8");
const negative = new THREE.Color("#efad79");
const palette = [
  "#59c8e8",
  "#edb779",
  "#8ed5b0",
  "#b6c8ed",
  "#e39a96",
  "#ced99b",
  "#9cd5d5",
];
// Three r181's shared DFG LUT can retain per-renderer disposal listeners.
// Reuse at most one released renderer instead of creating unbounded contexts.
const idleRenderers:THREE.WebGLRenderer[]=[];
export function disposeIdleRenderers(){for(const renderer of idleRenderers.splice(0)){renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}}
export class OrbitalViewer {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, 0.01, 200);
  controls: OrbitControls;
  orbitals = new THREE.Group();
  nucleus = new THREE.Group();
  nodes = new THREE.Group();
  axes = new THREE.Group();
  data: OrbitalData | null = null;
  phase = true;
  complex = false;
  opacity = 0.6;
  rotation = false;
  rotationSpeed=.55;
  private customRender?:()=>void;
  private cleanupTools?:()=>void;
  private frame = 0;
  private disposed = false;
  private nucleusKey='';
  private onVisibility = () => { if (!document.hidden) this.invalidate(); };
  private intersectionObserver: IntersectionObserver;
  private displayExtent = 1;
  private blochArrow?:THREE.ArrowHelper;
  private structureFrame?: {center:THREE.Vector3;scale:number};
  private raycaster = new THREE.Raycaster();
  private resizeObserver: ResizeObserver;
  private dragStart = { x: 0, y: 0 };
  private onKey: (e: KeyboardEvent) => void;
  private onPointerDown:(e:PointerEvent)=>void;
  private onClick:(e:MouseEvent)=>void;
  constructor(
    private container: HTMLElement,
    private onParticle: (type: string) => void,
  ) {
    this.renderer = idleRenderers.pop()??new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x0a1018, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Interactive three-dimensional orbital. Drag to rotate, scroll to zoom, right-drag to pan.",
    );
    this.renderer.domElement.tabIndex = 0;
    container.prepend(this.renderer.domElement);
    this.camera.up.set(0, 0, 1);
    this.reset();
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.controls.listenToKeyEvents(this.renderer.domElement);
    this.controls.addEventListener("change", () => this.invalidate());
    this.controls.minDistance = 0.8;
    this.controls.maxDistance = 50;
    this.controls.addEventListener("start", () =>
      this.container.classList.add("interacting"),
    );
    this.controls.addEventListener("end", () =>
      {this.container.classList.remove("interacting");this.container.dispatchEvent(new Event('qal-camera-change'));},
    );
    this.scene.add(this.orbitals, this.nucleus, this.nodes, this.axes);
    this.scene.add(new THREE.HemisphereLight(0xd7eaff, 0x283543, 2.5));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(4, -7, 9);
    this.scene.add(light);
    const light2 = new THREE.DirectionalLight(0x9bd8ee, 1.5);
    light2.position.set(-5, 4, 2);
    this.scene.add(light2);
    this.makeAxes();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.intersectionObserver = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) this.invalidate();
    });
    this.intersectionObserver.observe(container);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.resize();
    this.onPointerDown=e=>{this.dragStart={x:e.clientX,y:e.clientY};};
    this.onClick=e=>{
      if(Math.hypot(e.clientX-this.dragStart.x,e.clientY-this.dragStart.y)>5)return;
      const rect=this.renderer.domElement.getBoundingClientRect();
      this.raycaster.setFromCamera(new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1,(-(e.clientY-rect.top)/rect.height)*2+1),this.camera);
      const hits=this.raycaster.intersectObjects(this.nucleus.children);
      if(this.nucleus.visible&&hits[0])this.onParticle(hits[0].object.userData.type);
    };
    this.renderer.domElement.addEventListener('pointerdown',this.onPointerDown);
    this.renderer.domElement.addEventListener('click',this.onClick);
    this.onKey = (e) => {
      if (
        e.key.toLowerCase() === "r" &&
        document.activeElement === this.renderer.domElement
      )
        this.reset();
    };
    window.addEventListener("keydown", this.onKey);
    if(container.id!=='viewport')this.cleanupTools=viewportTools(container,{
      preset:view=>this.cameraPreset(view),quality:value=>this.setQuality(value),camera:()=>this.cameraState(),restore:value=>this.restoreCamera(value),rotate:(active,speed)=>{this.rotation=active;this.rotationSpeed=speed;this.invalidate();},
      screenshot:scale=>{const root=container.closest('.lab-results')??container.parentElement;const title=root?.querySelector('h2')?.textContent??document.querySelector('#lab-workspace h1')?.textContent??'Quantum Atom Lab';const model=root?.querySelector('.method-badge')?.textContent??'Scientific visualization';return this.screenshot(`${title} · ${model}`,'Units and model assumptions: see the laboratory results · schematic marker/bond sizes','Laboratory annotations define atomic colors, amplitude phase, density, and physical units.',scale);},
    });
    this.invalidate();
  }
  reset() {
    this.camera.position.set(8, -12, 7);
    this.camera.lookAt(0, 0, 0);
    if (this.controls) {
      this.controls.target.set(0, 0, 0);
      this.controls.update();
      this.invalidate();
    }
  }
  cameraPreset(view:string) {
    const distance=this.camera.position.distanceTo(this.controls.target);
    const direction=view==='x'?new THREE.Vector3(1,0,0):view==='y'?new THREE.Vector3(0,-1,0):view==='z'?new THREE.Vector3(0,-.001,1):new THREE.Vector3(8,-12,7).normalize();
    this.camera.position.copy(this.controls.target).add(direction.multiplyScalar(distance));
    this.controls.update();this.invalidate();this.container.dispatchEvent(new Event('qal-camera-change'));
  }
  cameraState():CameraState {return{position:this.camera.position.toArray(),target:this.controls.target.toArray()};}
  restoreCamera(value:unknown){
    if(!value||typeof value!=='object')return false;
    const {position,target}=value as CameraState;
    if(![position,target].every(v=>Array.isArray(v)&&v.length===3&&v.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=10000)))return false;
    const distance=Math.hypot(...position.map((v,i)=>v-target[i]));if(distance<.8||distance>50)return false;
    this.camera.position.fromArray(position);this.controls.target.fromArray(target);this.controls.update();this.invalidate();return true;
  }
  setRenderOverride(draw?:()=>void){this.customRender=draw;this.invalidate();}
  private draw(){if(this.customRender)this.customRender();else this.renderer.render(this.scene,this.camera);}
  clearState(atom:Species) {
    this.clear(this.orbitals);this.clear(this.nodes);this.makeNucleus(atom);this.data=null;this.invalidate();
  }
  setQuality(quality:string) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='high'?2:quality==='balanced'?1.5:1.25));
    this.resize();
  }
  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.invalidate();
  }
  private clear(group: THREE.Group) {
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          for (const material of Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material])
            {
              const map = (material as THREE.SpriteMaterial).map;
              map?.dispose();
              material.dispose();
            }
        }
      });
    }
  }
  private makeAxes() {
    const axes = [
      { v: new THREE.Vector3(4.5, 0, 0), color: 0x915d62, label: "x" },
      { v: new THREE.Vector3(0, 4.5, 0), color: 0x699c87, label: "y" },
      { v: new THREE.Vector3(0, 0, 4.5), color: 0x629db9, label: "z" },
    ];
    for (const axis of axes) {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        axis.v.clone().multiplyScalar(-1),
        axis.v,
      ]);
      this.axes.add(
        new THREE.Line(
          geometry,
          new THREE.LineBasicMaterial({
            color: axis.color,
            transparent: true,
            opacity: 0.45,
          }),
        ),
      );
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      ctx.font = "32px monospace";
      ctx.fillStyle = "#9faebc";
      ctx.textAlign = "center";
      ctx.fillText(axis.label, 32, 43);
      const texture = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          depthTest: false,
        }),
      );
      sprite.position.copy(axis.v).multiplyScalar(1.07);
      sprite.scale.setScalar(0.38);
      this.axes.add(sprite);
    }
  }
  private colors(phases: number[], colorIndex?: number) {
    const colors = new Float32Array(phases.length * 3);
    phases.forEach((phase, i) => {
      let color: THREE.Color;
      if (colorIndex !== undefined)
        color = new THREE.Color(palette[colorIndex % palette.length]);
      else if (!this.phase) color = positive;
      else if (this.complex)
        color = new THREE.Color().setHSL(
          (phase / (2 * Math.PI) + 1) % 1,
          0.65,
          0.65,
        );
      else color = Math.cos(phase) > 0 ? positive : negative;
      color.toArray(colors, i * 3);
    });
    return colors;
  }
  private surface(mesh: MeshData, scale: number, colorIndex?: number) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        mesh.vertices.flat().map((v) => v * scale),
        3,
      ),
    );
    geometry.setIndex(mesh.faces.flat());
    geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(
        this.colors(mesh.phases || mesh.vertices.map(() => 0), colorIndex),
        3,
      ),
    );
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: this.opacity,
      roughness: 0.46,
      metalness: 0.06,
      depthWrite: false,
    });
    const obj = new THREE.Mesh(geometry, material);
    obj.userData.phases = mesh.phases;
    obj.userData.colorIndex = colorIndex;
    this.orbitals.add(obj);
  }
  show(
    data: OrbitalData,
    atom: Species,
    phase: boolean,
    complex: boolean,
    displayExtent = data.extent,
    includePrimary = true,
  ) {
    this.data = data;
    this.phase = phase;
    this.complex = complex;
    this.displayExtent = displayExtent;
    this.clear(this.orbitals);
    this.clear(this.nodes);
    if (includePrimary) this.addOrbital(data);
    const scale = 4 / displayExtent;
    for (const radius of data.radial_nodes) {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(radius * scale, 48, 28),
        new THREE.MeshBasicMaterial({
          color: 0xe3e9ed,
          wireframe: true,
          transparent: true,
          opacity: 0.1,
          depthWrite: false,
        }),
      );
      this.nodes.add(sphere);
    }
    if (data.node_mesh) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          data.node_mesh.vertices.flat().map((v) => v * scale),
          3,
        ),
      );
      geometry.setIndex(data.node_mesh.faces.flat());
      geometry.computeVertexNormals();
      this.nodes.add(
        new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({
            color: 0xc9d3dd,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.13,
            depthWrite: false,
          }),
        ),
      );
    }
    this.makeNucleus(atom);
    this.invalidate();
  }
  addOrbital(data: Pick<OrbitalData,"points"|"phases"|"surfaces">, colorIndex?: number) {
    const scale = 4 / this.displayExtent;
    if (data.points.length) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          data.points.flat().map((v) => v * scale),
          3,
        ),
      );
      geometry.setAttribute(
        "color",
        new THREE.BufferAttribute(this.colors(data.phases, colorIndex), 3),
      );
      const material = new THREE.ShaderMaterial({
        uniforms: { opacity: { value: this.opacity } },
        vertexShader: `attribute vec3 color; varying vec3 vColor; void main(){vColor=color;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(34./(-p.z),1.,4.5);}`,
        fragmentShader: `uniform float opacity;varying vec3 vColor;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(vColor,opacity*exp(-3.*r*r));}`,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });
      const obj = new THREE.Points(geometry, material);
      obj.userData.phases = data.phases;
      obj.userData.colorIndex = colorIndex;
      this.orbitals.add(obj);
    }
    for (const mesh of data.surfaces) this.surface(mesh, scale, colorIndex);
    this.invalidate();
  }
  showStructure(data:{coordinates_angstrom:number[][];atomic_numbers:number[];bonds:{a:number;b:number;order:number}[]}) {
    this.clear(this.orbitals); this.clear(this.nodes); this.clear(this.nucleus);
    const points=data.coordinates_angstrom.map(p=>new THREE.Vector3(...p as [number,number,number]));
    const center=points.reduce((a,p)=>a.add(p),new THREE.Vector3()).divideScalar(points.length);
    const extent=Math.max(...points.map(p=>p.distanceTo(center)))+1;
    points.forEach(p=>p.sub(center).multiplyScalar(4/extent));
    const colors:Record<number,number>={1:0xe8e8e4,6:0x7c8b95,7:0x629cde,8:0xe57469};
    points.forEach((p,i)=>{
      const marker=new THREE.Mesh(new THREE.SphereGeometry(data.atomic_numbers[i]===1?.17:.26,22,16),new THREE.MeshStandardMaterial({color:colors[data.atomic_numbers[i]]||0xa5a5a5}));
      marker.position.copy(p);marker.userData.type=`atom ${i+1}`;this.nucleus.add(marker);
    });
    for(const bond of data.bonds){
      const a=points[bond.a],b=points[bond.b],direction=b.clone().sub(a);
      const stick=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,direction.length(),12),new THREE.MeshStandardMaterial({color:0x7e96a8}));
      stick.position.copy(a).add(b).multiplyScalar(.5);stick.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
      this.orbitals.add(stick);
    }
    this.invalidate();
  }
  /** A fixed frame lets mode playback update existing meshes only. */
  showBloch(vector:number[]){
    this.clear(this.orbitals);this.clear(this.nodes);this.clear(this.nucleus);
    const sphere=new THREE.Mesh(new THREE.SphereGeometry(3.2,24,16),new THREE.MeshBasicMaterial({color:0x6b91aa,wireframe:true,transparent:true,opacity:.16}));this.nodes.add(sphere);
    this.blochArrow=new THREE.ArrowHelper(new THREE.Vector3(0,0,1),new THREE.Vector3(),3.2,0x59c8e8,.3,.16);this.orbitals.add(this.blochArrow);this.updateBloch(vector);
  }
  updateBloch(vector:number[]){
    if(!this.blochArrow)return;const v=new THREE.Vector3(...vector as [number,number,number]),length=v.length();this.blochArrow.visible=length>1e-10;
    if(length>1e-10){this.blochArrow.setDirection(v.normalize());this.blochArrow.setLength(3.2*length,Math.min(.3,length),Math.min(.16,length));}this.invalidate();
  }
  showWeightedCloud(points:number[][],extent:number){
    this.clear(this.orbitals);this.clear(this.nodes);this.clear(this.nucleus);this.displayExtent=extent;this.phase=true;this.complex=true;
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flat().map(v=>v*4/extent),3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(points.length*3),3));geometry.setAttribute('weight',new THREE.Float32BufferAttribute(new Float32Array(points.length),1));
    const material=new THREE.ShaderMaterial({vertexShader:'attribute vec3 color; attribute float weight; varying vec3 tint; varying float alpha; void main(){tint=color;alpha=weight;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(40./(-p.z),2.,5.);}',fragmentShader:'varying vec3 tint; varying float alpha; void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(tint,alpha*.8*exp(-2.*r*r));}',transparent:true,depthWrite:false});
    this.orbitals.add(new THREE.Points(geometry,material));const marker=new THREE.Mesh(new THREE.SphereGeometry(.05,16,12),new THREE.MeshStandardMaterial({color:0xe57969}));marker.userData.type='proton';this.nucleus.add(marker);this.invalidate();
  }
  updateWeightedCloud(weights:number[],phases:number[]){
    const cloud=this.orbitals.children[0] as THREE.Points;if(!cloud)return;
    const weight=cloud.geometry.getAttribute('weight') as THREE.BufferAttribute,color=cloud.geometry.getAttribute('color') as THREE.BufferAttribute;
    weight.set(weights);weight.needsUpdate=true;color.set(this.colors(phases));color.needsUpdate=true;this.invalidate();
  }
  showNuclearGeometry(centers:number[][],numbers:number[],bonds:{a:number;b:number;order:number}[],reference?:number[][]){
    this.clear(this.orbitals);this.clear(this.nodes);this.clear(this.nucleus);
    const center=centers.reduce((v,p)=>v.add(new THREE.Vector3(...p as [number,number,number])),new THREE.Vector3()).divideScalar(centers.length);
    const extent=Math.max(...[...centers,...(reference??[])].map(p=>new THREE.Vector3(...p as [number,number,number]).distanceTo(center)))+1.5;
    this.structureFrame={center,scale:4/extent};
    const colors:Record<number,number>={1:0xe8e8e4,3:0xb1a1de,5:0xd6a99a,6:0x7c8b95,7:0x629cde,8:0xe57469,9:0x91c99e};
    const add=(xyz:number[][],ghost:boolean)=>{
      const target=ghost?this.nodes:this.nucleus;
      xyz.forEach((p,i)=>{
        const marker=new THREE.Mesh(new THREE.SphereGeometry(numbers[i]===1?.16:.25,22,16),new THREE.MeshStandardMaterial({color:ghost?0x59c8e8:colors[numbers[i]]??0xaaaaaa,transparent:ghost,opacity:ghost?.25:1,depthWrite:!ghost}));
        marker.position.copy(new THREE.Vector3(...p as [number,number,number]).sub(center).multiplyScalar(4/extent));marker.userData={atomIndex:i,type:`atom ${i+1}`};target.add(marker);
      });
      bonds.forEach(b=>{
        const stick=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,1,12),new THREE.MeshStandardMaterial({color:ghost?0x59c8e8:0xefad79,transparent:ghost,opacity:ghost?.25:1,depthWrite:!ghost}));
        stick.userData.bond=b;(ghost?this.nodes:this.orbitals).add(stick);this.placeStick(stick,xyz);
      });
    };
    if(reference)add(reference,true);add(centers,false);this.invalidate();
  }
  private placeStick(stick:THREE.Mesh,centers:number[][]){
    const {center,scale}=this.structureFrame!;const {a,b}=stick.userData.bond;
    const start=new THREE.Vector3(...centers[a] as [number,number,number]).sub(center).multiplyScalar(scale);
    const end=new THREE.Vector3(...centers[b] as [number,number,number]).sub(center).multiplyScalar(scale);
    const direction=end.clone().sub(start);stick.position.copy(start).add(end).multiplyScalar(.5);stick.scale.y=direction.length();
    if(direction.length()>1e-12)stick.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
  }
  updateNuclearGeometry(centers:number[][]){
    if(!this.structureFrame)return;const {center,scale}=this.structureFrame;
    this.nucleus.children.forEach(marker=>{const p=centers[marker.userData.atomIndex];if(p)marker.position.set(p[0],p[1],p[2]).sub(center).multiplyScalar(scale);});
    this.orbitals.children.forEach(stick=>{if(stick.userData.bond)this.placeStick(stick as THREE.Mesh,centers);});this.invalidate();
  }
  showMolecule(data: {extent:number;points:number[][];phases:number[];surfaces:MeshData[];centers_a0:number[][]}) {
    this.displayExtent = data.extent;
    this.phase = true; this.complex = false;
    this.clear(this.orbitals); this.clear(this.nodes); this.clear(this.nucleus);
    this.addOrbital(data);
    for (const center of data.centers_a0) {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(.09,20,16),new THREE.MeshStandardMaterial({color:0xe57969}));
      marker.position.set(center[0],center[1],center[2]).multiplyScalar(4/data.extent);
      marker.userData.type = "proton"; this.nucleus.add(marker);
    }
    this.invalidate();
  }
  setColor(phase: boolean) {
    this.phase = phase;
    for (const child of this.orbitals.children) {
      const obj = child as THREE.Mesh;
      const phases = obj.userData.phases;
      if (phases) {
        const attribute = obj.geometry.getAttribute("color") as THREE.BufferAttribute;
        attribute.set(this.colors(phases, obj.userData.colorIndex));
        attribute.needsUpdate = true;
      }
    }
    this.invalidate();
  }
  setOpacity(value: number) {
    this.opacity = value;
    for (const child of this.orbitals.children) {
      const material = (child as THREE.Mesh).material as THREE.Material;
      if (material instanceof THREE.ShaderMaterial)
        material.uniforms.opacity.value = value;
      else material.opacity = value;
    }
    this.invalidate();
  }
  makeNucleus(atom: Species) {
    const key=`${atom.z}:${atom.a}`;if(this.nucleusKey===key&&this.nucleus.children.length===atom.a)return;this.nucleusKey=key;
    this.clear(this.nucleus);
    // A compact lattice is deliberately schematic, and enlarged independently
    // of the orbital's a₀ scale. Every nucleon remains separately selectable.
    const count = atom.a;
    const candidates: number[][] = [];
    for (let x = -8; x <= 8; x++)
      for (let y = -8; y <= 8; y++)
        for (let z = -8; z <= 8; z++) {
          if ((x + y + z) % 2 === 0) candidates.push([x, y, z]);
        }
    candidates.sort(
      (a, b) =>
        a.reduce((s, v) => s + v * v, 0) - b.reduce((s, v) => s + v * v, 0),
    );
    let protonCount = 0;
    for (let i = 0; i < count; i++) {
      const isProton =
        Math.floor(((i + 1) * atom.protons) / count) > protonCount;
      if (isProton) protonCount++;
      const type = isProton ? "proton" : "neutron";
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(count === 1 ? 0.11 : 0.055, 18, 12),
        new THREE.MeshStandardMaterial({
          color: isProton ? 0xe57969 : 0x87929e,
          roughness: 0.45,
        }),
      );
      mesh.position
        .set(...(candidates[i] as [number, number, number]))
        .multiplyScalar(0.08);
      mesh.userData.type = type;
      this.nucleus.add(mesh);
    }
  }
  /** Schedule only when data, the camera, or visible presentation changes. */
  invalidate = () => {
    if (!this.disposed && !this.frame) this.frame = requestAnimationFrame(this.animate);
  };
  private animate = () => {
    this.frame = 0;
    if (this.disposed || document.hidden || !this.container.getClientRects().length) return;
    this.controls.autoRotate = this.rotation && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.controls.autoRotateSpeed = this.rotationSpeed;
    const changed = this.controls.update();
    if (this.container.classList.contains("interacting")) {
      for (const obj of this.orbitals.children)
        if (obj instanceof THREE.Points)
          obj.geometry.setDrawRange(
            0,
            Math.ceil(obj.geometry.attributes.position.count / 2),
          );
    } else {
      for (const obj of this.orbitals.children)
        if (obj instanceof THREE.Points) obj.geometry.setDrawRange(0, Infinity);
    }
    this.draw();
    if (changed || this.controls.autoRotate) this.invalidate();
  };
  screenshot(model = "Quantum Atom Lab", units = "Lengths in a₀; nucleus schematic", legend?:string,scale=1) {
    const size=this.renderer.getSize(new THREE.Vector2()),ratio=this.renderer.getPixelRatio();
    const factor=Math.max(1,Math.min(scale,8192/(size.x*ratio),8192/(size.y*ratio),Math.sqrt(8_000_000/(size.x*size.y*ratio*ratio))));
    try{
    if(factor>1){this.renderer.setPixelRatio(ratio*factor);this.renderer.setSize(size.x,size.y,false);}
    this.draw();
    const source = this.renderer.domElement;
    const canvas = document.createElement("canvas");
    canvas.width = source.width; canvas.height = source.height + Math.round(100*factor);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0a1017"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0,100*factor);ctx.scale(factor,factor);
    ctx.fillStyle = "#e3e9ef"; ctx.font = "16px sans-serif";
    ctx.fillText(model, 20, 32, canvas.width/factor - 40);
    ctx.fillStyle = "#a5b6c5"; ctx.font = "14px sans-serif";
    ctx.fillText(units, 20, 62, canvas.width/factor - 40);
    ctx.fillText(legend ?? (this.phase ? "Cyan: +ψ; amber: −ψ in real phase view. Complex view: cyclic phase hue." : "Density view: nonnegative density, without phase coloring."), 20, 84, canvas.width/factor - 40);
    return canvas.toDataURL("image/png");
    }finally{if(factor>1){this.renderer.setPixelRatio(ratio);this.renderer.setSize(size.x,size.y,false);this.draw();}}
  }
  dispose() {
    if(this.disposed)return;
    this.disposed = true;this.data=null;this.blochArrow=undefined;this.structureFrame=undefined;
    this.cleanupTools?.();this.customRender=undefined;
    cancelAnimationFrame(this.frame);
    this.intersectionObserver.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.resizeObserver.disconnect();
    window.removeEventListener("keydown", this.onKey);
    this.controls.dispose();
    this.clear(this.orbitals);
    this.clear(this.nucleus);
    this.clear(this.nodes);
    this.clear(this.axes);
    this.renderer.domElement.removeEventListener('pointerdown',this.onPointerDown);
    this.renderer.domElement.removeEventListener('click',this.onClick);
    this.renderer.domElement.remove();this.container.classList.remove('interacting');
    this.renderer.renderLists.dispose();this.renderer.info.reset();
    this.scene.clear();
    if(idleRenderers.length===0)idleRenderers.push(this.renderer);
    else{this.renderer.dispose();this.renderer.forceContextLoss();}
  }
}
