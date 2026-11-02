import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { MeshData, OrbitalData, Species } from "../types";

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
  private frame = 0;
  private disposed = false;
  private onVisibility = () => { if (!document.hidden) this.invalidate(); };
  private intersectionObserver: IntersectionObserver;
  private displayExtent = 1;
  private raycaster = new THREE.Raycaster();
  private resizeObserver: ResizeObserver;
  private dragStart = { x: 0, y: 0 };
  private onKey: (e: KeyboardEvent) => void;
  constructor(
    private container: HTMLElement,
    private onParticle: (type: string) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({
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
      this.container.classList.remove("interacting"),
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
    this.renderer.domElement.addEventListener(
      "pointerdown",
      (e) => (this.dragStart = { x: e.clientX, y: e.clientY }),
    );
    this.renderer.domElement.addEventListener("click", (e) => {
      if (
        Math.hypot(e.clientX - this.dragStart.x, e.clientY - this.dragStart.y) >
        5
      )
        return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.raycaster.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        this.camera,
      );
      const hits = this.raycaster.intersectObjects(this.nucleus.children);
      if (this.nucleus.visible && hits[0])
        this.onParticle(hits[0].object.userData.type);
    });
    this.onKey = (e) => {
      if (
        e.key.toLowerCase() === "r" &&
        document.activeElement === this.renderer.domElement
      )
        this.reset();
    };
    window.addEventListener("keydown", this.onKey);
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
    this.controls.autoRotateSpeed = 0.55;
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
    this.renderer.render(this.scene, this.camera);
    if (changed || this.controls.autoRotate) this.invalidate();
  };
  screenshot(model = "Quantum Atom Lab", units = "Lengths in a₀; nucleus schematic") {
    this.renderer.render(this.scene, this.camera);
    const source = this.renderer.domElement;
    const canvas = document.createElement("canvas");
    canvas.width = source.width; canvas.height = source.height + 100;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0a1017"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 100);
    ctx.fillStyle = "#e3e9ef"; ctx.font = "16px sans-serif";
    ctx.fillText(model, 20, 32, canvas.width - 40);
    ctx.fillStyle = "#a5b6c5"; ctx.font = "14px sans-serif";
    ctx.fillText(units, 20, 62, canvas.width - 40);
    ctx.fillText("Cyan: +ψ; amber: −ψ in real phase view. Complex view: cyclic phase hue.", 20, 84, canvas.width - 40);
    return canvas.toDataURL("image/png");
  }
  dispose() {
    this.disposed = true;
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
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
