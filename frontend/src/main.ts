import {readRoute,savedParameters,rememberParameters} from './app/route';
import {initializeRuntime,runtime} from "./services/runtime";
import {mountMaterials} from "./labs/materials";
import "./styles.css";
import { $, esc } from "./components/dom";
import { graph } from "./components/graph";
import { modal, closeModal, initializeDialog } from "./components/dialog";
import { api } from "./services/api";
import { mountSpectroscopy } from "./labs/spectroscopy";
import { mountExperiments } from "./labs/experiments";
import { mountComputation } from "./labs/computation";
import { mountMolecular } from "./labs/molecular";
import { mountDynamics } from "./labs/dynamics";
import { registerLab, initializeNavigation } from "./app/navigation";
import { OrbitalViewer,disposeIdleRenderers } from "./visualization/viewer";
import type { ElementData, Species, OrbitalData } from "./types";

const names: Record<number, Record<number, string>> = {
  0: { 0: "s" },
  1: { "-1": "pᵧ", 0: "p_z", 1: "pₓ" },
  2: { "-2": "d_xy", "-1": "d_yz", 0: "d_z²", 1: "d_xz", 2: "d_x²−y²" },
  3: {
    "-3": "f_y(3x²−y²)",
    "-2": "f_xyz",
    "-1": "f_y(4z²−x²−y²)",
    0: "f_z³",
    1: "f_x(4z²−x²−y²)",
    2: "f_z(x²−y²)",
    3: "f_x(x²−3y²)",
  },
};
const descriptions: Record<number, string> = {
  0: "Spherically symmetric. Radial nodes divide concentric regions of opposite wavefunction sign.",
  1: "Directional angular structure. Real p orbitals have two opposite-phase lobes separated by a nodal plane.",
  2: "Five independent angular states. The z² orbital has two axial lobes and an opposite-phase equatorial torus; the others have four lobes.",
  3: "Seven independent real angular states, with planar and conical nodal surfaces. Each geometry comes from a distinct normalized spherical harmonic.",
};
let elements: ElementData[] = [];
let atom: Species;
let orbital: OrbitalData;
let n = 1,
  l = 0,
  m = 0,
  spin = 0.5,
  basis = "real",
  mode = "cloud",
  quality = "preview",
  phase = true,
  showNodes = false;
let points = 5000,
  threshold = 0.06,
  effectiveZ = 1;
let activeZ = 1,
  activeA = 1,
  charge = 0;
let viewer: OrbitalViewer;
let requestId = 0,
  speciesId = 0;
let controller: AbortController | null = null;
let speciesController:AbortController|undefined;
let atomicReady=false;
let activeTab = "occupancy";
let overlayMode = "single";
let overlayChoices = new Set<string>();
let subshellChoices = new Set<string>();
let subshellKey = "";

let energyRevision = 0;
let renderedAtomicLabel = "No successful calculation yet";

const atomIcon = `<svg width="27" height="27" viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="2.2" fill="currentColor"/><ellipse cx="16" cy="16" rx="14" ry="5.5" stroke="currentColor"/><ellipse cx="16" cy="16" rx="14" ry="5.5" stroke="currentColor" transform="rotate(60 16 16)"/><ellipse cx="16" cy="16" rx="14" ry="5.5" stroke="currentColor" transform="rotate(120 16 16)"/></svg>`;
$("app").innerHTML = `
<header class="topbar"><a class="brand" href="/">${atomIcon}<div>QUANTUM <b>ATOM LAB</b><small>A LOCAL SCIENTIFIC WORKSPACE</small></div></a><nav class="main-nav" aria-label="Application mode"><button class="nav-item" id="classical" aria-label="Classical comparison" title="Classical comparison"><span class="classical-label">Classical comparison</span> <span>↗</span></button></nav><div class="local-status"><i></i> LOCAL COMPUTATION</div><button class="icon-button" id="help" title="Scientific guide and controls" aria-label="Scientific guide and controls">?</button></header>
<a class="skip-link" href="#viewport">Skip to visualization</a>
<main class="workspace" id="atomic-workspace" aria-label="Atomic Explorer">
<aside class="left-panel panel">
<div class="section-heading"><span>01 / ATOMIC SPECIES</span><button class="text-button" id="open-table">Periodic table ↗</button></div>
<button id="element-select" class="element-card" aria-label="Choose element"><div class="element-tile"><small id="atomic-z">1</small><strong id="symbol">H</strong><span id="atomic-a">1.008</span></div><div><h1 id="element-name">Hydrogen</h1><p id="category">Nonmetal</p><span class="subtle">Change element <span class="arrow">⌄</span></span></div></button>
<div class="two-fields"><label>Isotope<select id="isotope" aria-label="Select isotope"></select></label><label>Ion charge<input id="charge" type="number" value="0" min="-5" max="1" step="1"></label></div>
<details class="custom-mass"><summary>Custom mass number</summary><label>Composition only; stability unverified<input id="custom-a" type="number" min="1" max="350" value="1"></label><button id="apply-a" class="secondary">Apply mass number</button></details>
<div class="particle-counts"><button id="proton-info"><i class="particle proton"></i><strong id="p-count">1</strong><span>Proton</span></button><button id="neutron-info"><i class="particle neutron"></i><strong id="neutron-count">0</strong><span>Neutrons</span></button><button id="electron-info"><i class="particle electron"></i><strong id="e-count">1</strong><span>Electron</span></button></div>
<p class="isotope-note" id="isotope-note"></p>
<div class="divider"></div>
<div class="section-heading"><span>02 / ORBITAL STATE</span><button class="text-button" id="gallery">Gallery ↗</button></div>
<div class="family-tabs" role="group" aria-label="Orbital family">${["s", "p", "d", "f"].map((f, i) => `<button data-family="${i}" class="${i === 0 ? "selected" : ""}">${f}<small>${[1, 3, 5, 7][i]} orbital${i ? "s" : ""}</small></button>`).join("")}</div>
<div class="two-fields"><label>Principal shell · n<select id="n">${Array.from({ length: 8 }, (_, i) => `<option>${i + 1}</option>`).join("")}</select></label><label>Spin · mₛ<select id="spin"><option value="0.5">+½ ↑</option><option value="-0.5">−½ ↓</option></select></label></div>
<label class="field">Angular basis<select id="basis"><option value="real">Real orbitals · chemistry basis</option><option value="complex">Complex Yₗᵐ · definite mₗ</option></select></label>
<label class="field"><span id="orientation-label">Orientation · real basis index</span><select id="orientation"></select></label>
<div class="orbital-picker" id="orbital-shortcuts"></div>
<div class="state-note"><span class="tiny-icon">↗</span><p>Explore any valid state, including excited states outside this atom’s ground configuration.</p></div>
<div class="divider"></div>
<div class="section-heading"><span>03 / DISPLAY</span><span class="subtle">3D</span></div>
<label class="field">Composition<select id="overlay"><option value="single">One orbital</option><option value="subshell">All orbitals in this subshell</option><option value="occupied">Selected occupied orbitals</option></select></label>
<div id="overlay-list" class="overlay-list" hidden></div>
<div class="toggle-row"><label for="axes">Coordinate axes</label><input id="axes" type="checkbox" checked></div>
<div class="toggle-row"><label for="nucleus">Nucleus <small>schematic</small></label><input id="nucleus" type="checkbox" checked></div>
<div class="toggle-row"><label for="nodes">Nodal surfaces</label><input id="nodes" type="checkbox"></div>
<div class="toggle-row"><label for="rotate">Auto-rotate</label><input id="rotate" type="checkbox"></div>
<div class="scale-note">NUCLEUS ENLARGED · NOT TO SCALE</div>
</aside>
<section class="center-panel">
<div class="viewport" id="viewport"><div class="viewport-heading"><div><div class="eyebrow">WAVEFUNCTION EXPLORER</div><h2><span id="orbital-title">1s</span> <span class="title-divider">/</span> <span id="viewport-element">Hydrogen</span></h2><p id="state-subtitle">n = 1 · l = 0 · real basis</p></div><span class="model-badge" id="model-badge">ONE-ELECTRON MODEL</span></div>
<div class="view-toolbar"><div class="segmented" role="group" aria-label="Rendering mode"><button id="cloud" class="selected">⋮ Electron cloud</button><button id="surface">◇ Isosurface</button></div><div class="segmented" role="group" aria-label="Color view"><button id="phase" class="selected">Phase</button><button id="density">Density</button></div></div>
<div class="view-actions"><button class="icon-button" id="reset" title="Reset camera (R)" aria-label="Reset camera">⟲</button><button class="icon-button" id="export" title="Save viewport image" aria-label="Save viewport image">↓</button></div>
<div id="atomic-result-status" class="atomic-result-status" role="status" hidden></div><div id="loading" class="loading" role="status"><span class="spinner"></span><span>Computing wavefunction…</span></div>
<div class="viewport-bottom"><div class="legend" id="legend"><span><i class="positive"></i>+ψ</span><span><i class="negative"></i>−ψ</span><small>Wavefunction sign</small></div><div class="scale-readout" id="scale-readout"></div></div>
<div class="mouse-help">DRAG TO ROTATE <span>·</span> SCROLL TO ZOOM <span>·</span> RIGHT-DRAG TO PAN</div>
<div class="viewport-caption" id="viewport-caption">Points are possible position measurements, not electrons following paths.</div>
</div>
<div class="visual-controls"><label>QUALITY<select id="quality"><option value="preview">Preview</option><option value="balanced" selected>Balanced</option><option value="high">High detail</option></select></label><label class="slider-label">OPACITY <input id="opacity" type="range" min="0.1" max="1" step="0.05" value="0.6"><output id="opacity-value">60%</output></label><label class="slider-label" id="point-control">POINTS <input id="points" type="range" min="1000" max="60000" step="1000" value="18000"><output id="points-value">18k</output></label><label class="slider-label" id="threshold-control" hidden>AMPLITUDE LEVEL <input id="threshold" type="range" min="0.005" max="0.4" step="0.005" value="0.06"><output id="threshold-value">6%</output></label></div>
<section class="analysis-panel"><div class="analysis-tabs" role="tablist" aria-label="Scientific analysis"><button data-tab="occupancy" class="active" role="tab" aria-selected="true">Electron configuration</button><button data-tab="radial" role="tab" aria-selected="false">Radial probability</button><button data-tab="energy" role="tab" aria-selected="false">Energy levels</button><button data-tab="angular" role="tab" aria-selected="false">Angular probability</button></div><div id="analysis-content" class="analysis-content" role="tabpanel"></div></section>
</section>
<aside class="right-panel panel"><div class="section-heading"><span>STATE INSPECTOR</span><i class="status-dot"></i></div><div class="orbital-name"><span id="inspector-title">1s</span><small id="orbital-family">s ORBITAL</small></div><div class="quantum-grid"><div><span>Principal</span><strong id="qn-n">n = 1</strong></div><div><span>Angular</span><strong id="qn-l">l = 0</strong></div><div><span id="qn-m-label">Basis index</span><strong id="qn-m">m = 0</strong></div><div><span>Spin</span><strong id="qn-spin">mₛ = +½</strong></div></div><p class="basis-note" id="basis-note"></p><div class="divider"></div><div class="section-heading"><span>THE WAVEFUNCTION</span></div><div class="equation">ψₙₗₘ = Rₙₗ(r) Yₗᵐ(θ,φ)</div><p class="body-copy" id="shape-explanation"></p><p class="body-copy">The wavefunction has phase. Its squared magnitude, <b>|ψ|²</b>, is a nonnegative probability density.</p><div class="node-grid"><div><strong id="radial-nodes">0</strong><span>Radial nodes</span></div><div><strong id="angular-nodes">0</strong><span id="angular-node-caption">Angular nodes</span></div><div><strong id="total-nodes">0</strong><span>Total nodes</span></div></div><p class="node-formula">n − l − 1 <span>+</span> l <span>=</span> n − 1</p><div class="divider"></div><div class="section-heading"><span>MODEL & UNITS</span></div><div class="energy-readout"><span id="energy-value">−13.5983 <small>eV</small></span><small id="energy-label">NONRELATIVISTIC STATE ENERGY</small></div><label class="field" id="zeff-field" hidden>Demonstration Z_eff<input id="zeff" type="number" min="0.1" max="118" step="0.1" value="1"></label><div class="model-note" id="model-note"></div><div class="unit-key"><span>1 a₀</span><span>0.0529177 nm</span></div><div class="normalization"><i></i><span id="normalization">∫ |ψ|² dV = 1.000000</span></div><button class="guide-button" id="science-guide">Read the scientific guide ↗</button></aside>
</main>
<main id="lab-workspace" class="lab-workspace" aria-label="Active scientific laboratory" hidden></main>
<footer><span>QUANTUM ATOM LAB <span class="footer-line">/</span> An interactive study of matter</span><span>NumPy + SciPy <span class="footer-line">/</span> Three.js · WebGL</span></footer>
<div id="toast" class="toast" role="alert" hidden></div>
<dialog id="dialog" aria-labelledby="dialog-title" aria-describedby="dialog-kicker"><div class="dialog-header"><div><span class="eyebrow" id="dialog-kicker">EXPLORE</span><h2 id="dialog-title"></h2></div><button id="close-dialog" class="icon-button" aria-label="Close dialog">×</button></div><div id="dialog-body"></div></dialog>`;

function notify(message: string) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  setTimeout(() => ($("toast").hidden = true), 6500);
}
initializeDialog();

function quantumControls() {
  $<HTMLSelectElement>("n").value = String(n);
  document
    .querySelectorAll<HTMLButtonElement>("[data-family]")
    .forEach((button) => {
      const family = Number(button.dataset.family);
      button.classList.toggle("selected", family === l);
      button.setAttribute("aria-pressed",String(family===l));
      button.title = `${"spdf"[family]} orbitals require n ≥ ${family + 1}; selecting this family adjusts n if needed.`;
    });
  $("orientation-label").textContent =
    basis === "real"
      ? "Orientation · real basis index"
      : "Magnetic quantum number · mₗ";
  $("orientation").innerHTML = Array.from({ length: 2 * l + 1 }, (_, i) => {
    const value = i - l;
    return `<option value="${value}">${basis === "real" ? esc(names[l][value]) : `mₗ = ${value}`}</option>`;
  }).join("");
  $<HTMLSelectElement>("orientation").value = String(m);
  $("orbital-shortcuts").innerHTML = Array.from(
    { length: 2 * l + 1 },
    (_, i) => {
      const value = i - l;
      return `<button data-m="${value}" class="${value === m ? "selected" : ""}" aria-pressed="${value===m}">${basis === "real" ? esc(names[l][value]) : `m=${value}`}</button>`;
    },
  ).join("");
  document.querySelectorAll<HTMLButtonElement>("[data-m]").forEach(
    (button) =>
      (button.onclick = () => {
        m = Number(button.dataset.m);
        quantumControls();
        void loadOrbital();
      }),
  );
  if (atom) updateOverlayList();
}
function showSpecies() {
  $("atomic-z").textContent = String(atom.z);
  $("symbol").textContent = atom.symbol;
  $("atomic-a").textContent = String(atom.a);
  $("element-name").textContent = atom.name;
  $("category").textContent = atom.category;
  $("viewport-element").textContent =
    atom.name +
    (atom.charge ? ` (${atom.charge > 0 ? "+" : ""}${atom.charge})` : "");
  $("p-count").textContent = String(atom.protons);
  $("neutron-count").textContent = String(atom.neutrons);
  $("e-count").textContent = String(atom.electrons);
  $("isotope").innerHTML =
    atom.isotopes
      .map(
        (i) =>
          `<option value="${i.a}">${esc(atom.symbol)}-${i.a}${i.abundance ? " · natural" : ""}</option>`,
      )
      .join("") +
    (!atom.isotopes.some((i) => i.a === atom.a)
      ? `<option value="${atom.a}">${esc(atom.symbol)}-${atom.a} · custom</option>`
      : "");
  $<HTMLSelectElement>("isotope").value = String(atom.a);
  $<HTMLInputElement>("charge").value = String(atom.charge);
  $<HTMLInputElement>("charge").max = String(atom.z);
  $<HTMLInputElement>("charge").min = String(atom.z - 118);
  $<HTMLInputElement>("custom-a").min = String(atom.z);
  $<HTMLInputElement>("custom-a").value = String(atom.a);
  $("isotope-note").textContent =
    atom.isotope.label +
    (atom.isotope.abundance
      ? ` (${(atom.isotope.abundance * 100).toPrecision(4)}%).`
      : ".");
  $("model-badge").textContent = atom.one_electron
    ? "ONE-ELECTRON MODEL"
    : "HYDROGENIC APPROXIMATION";
  $("zeff-field").hidden = atom.one_electron;
  overlayChoices.clear();
  const occupied = atom.electronic.occupancy.flatMap((s) =>
    s.orbitals
      .filter((o) => o.spins.length)
      .map((o) => ({ n: s.n, l: s.l, m: o.m })),
  );
  occupied.slice(-4).forEach((s) => overlayChoices.add(`${s.n},${s.l},${s.m}`));
  updateOverlayList();
  renderAnalysis();
}
async function selectSpecies(z: number, a?: number, q = charge) {
  const id = ++speciesId;
  speciesController?.abort();speciesController=new AbortController();
  ++requestId;
  controller?.abort();
  $("loading").hidden = false;
  $("atomic-result-status").hidden=false;
  $("atomic-result-status").textContent=`Calculating current inputs. Displayed state: ${renderedAtomicLabel}.`;
  $<HTMLButtonElement>("export").disabled = true;
  try {
    const result = await api<Species>(
      `/api/species?z=${z}&charge=${q}${a === undefined ? "" : `&a=${a}`}`,speciesController.signal,
    );
    if (id !== speciesId) return;
    atom = result;
    activeZ = z;
    activeA = atom.a;
    charge = q;
    showSpecies();
    await loadOrbital();
  } catch (error) {
    if (id === speciesId && (error as Error).name!=='AbortError') {
      $("loading").hidden = true;
      notify((error as Error).message);
      $("atomic-result-status").hidden=false;
      $("atomic-result-status").textContent=`Species request failed. Displayed state: ${renderedAtomicLabel}.`;
      if (atom) showSpecies();
    }
  }
}
function queryFor(on = n, ol = l, om = m) {
  return new URLSearchParams({
    z: String(activeZ),
    a: String(activeA),
    charge: String(charge),
    n: String(on),
    l: String(ol),
    m: String(om),
    spin: String(spin),
    basis,
    mode,
    quality,
    points: String(points),
    threshold: String(threshold),
    nodes: String(showNodes),
    zeff: String(effectiveZ),
  });
}
async function loadOrbital() {
  if (!atom) return;
  rememberAtomic();
  const id = ++requestId;
  controller?.abort();
  controller = new AbortController();
  $("loading").hidden = false;
  $("atomic-result-status").hidden=false;
  $("atomic-result-status").textContent=`Calculating current inputs. Displayed state: ${renderedAtomicLabel}.`;
  $<HTMLButtonElement>("export").disabled = true;
  try {
    const data = await api<OrbitalData>(
      `/api/orbital?${queryFor()}`,
      controller.signal,
    );
    if (id !== requestId) return;
    orbital = data;
    renderedAtomicLabel=`${atom.symbol}-${atom.a}, charge ${atom.charge}, ${data.label}, ${mode}`;
    $<HTMLButtonElement>("export").disabled = false;
    viewer?.show(data, atom, phase, basis === "complex");
    if (viewer) viewer.nodes.visible = showNodes;
    updateInspector();
    renderAnalysis();
    if (viewer && overlayMode !== "single") await loadOverlay(id, controller.signal);
    if(id===requestId)$("atomic-result-status").hidden=true;
  } catch (error) {
    if ((error as Error).name !== "AbortError" && id === requestId) {
      notify((error as Error).message);
      $("atomic-result-status").hidden=false;
      $("atomic-result-status").textContent=`Requested result failed or is incomplete. Displayed state: ${renderedAtomicLabel}.`;
      $<HTMLButtonElement>("export").disabled=true;
    }
  } finally {
    if (id === requestId) $("loading").hidden = true;
  }
}
async function loadOverlay(id: number, signal: AbortSignal) {
  const states = [
    ...(overlayMode === "subshell" ? subshellChoices : overlayChoices),
  ].map((s) => s.split(",").map(Number));
  const layers: { data: OrbitalData; primary: boolean }[] = [];
  for (const state of states.slice(0, 8)) {
    const [sn, sl, sm] = state;
    if (sn === n && sl === l && sm === m) {
      layers.push({ data: orbital, primary: true });
      continue;
    }
    const params = queryFor(sn, sl, sm);
    params.set("points", String(Math.min(points, 9000)));
    params.set("nodes", "false");
    params.set("quality", "preview");
    const data = await api<OrbitalData>(`/api/orbital?${params}`, signal);
    if (id !== requestId) return;
    layers.push({ data, primary: false });
  }
  if (id !== requestId) return;
  const extent = Math.max(
    ...layers.map((layer) => layer.data.extent),
    orbital.extent,
  );
  viewer.show(orbital, atom, phase, basis === "complex", extent, false);
  viewer.nodes.visible = showNodes;
  layers.forEach((layer, index) =>
    viewer.addOrbital(layer.data, layer.primary ? undefined : index + 1),
  );
  $("viewport-caption").textContent = layers.length
    ? "Overlay of individually normalized orbital densities, not an exact many-electron wavefunction. Inspecting-state colors follow the legend; other layers use separate colors."
    : "No orbital layers selected. Use the visibility checkboxes in the display panel.";
  const extentA0 = extent * orbital.length_scale_a0;
  $("scale-readout").innerHTML =
    `Frame radius = ${extentA0.toFixed(2)} a₀ <small>Common scale for every orbital layer</small>`;
}
function updateInspector() {
  const displayName =
    basis === "real" ? `${n}${names[l][m]}` : `${n}${"spdf"[l]} · mₗ=${m}`;
  $("orbital-title").textContent = displayName;
  $("inspector-title").textContent = displayName;
  $("orbital-family").textContent =
    `${"spdf"[l]} ORBITAL · MAX. 2 ELECTRONS / SPATIAL ORBITAL`;
  $("state-subtitle").textContent =
    `n = ${n} · l = ${l} · ${basis === "real" ? "real tesseral basis" : `mₗ = ${m}`}`;
  $("qn-n").textContent = `n = ${n}`;
  $("qn-l").textContent = `l = ${l}`;
  $("qn-m").textContent = `${basis === "real" ? "index" : "mₗ"} = ${m}`;
  $("qn-m-label").textContent = basis === "real" ? "Basis index" : "Magnetic";
  $("qn-spin").textContent = `mₛ = ${spin > 0 ? "+½" : "−½"}`;
  $("basis-note").textContent =
    orbital.basis_note +
    " Spin does not change this spatial density." +
    (basis === "complex"
      ? " The node-count formula below is the real-basis convention. Complex states have l−|m| polar nodal cones and axis zeros, rather than |m| azimuthal nodal planes."
      : "");
  $("angular-node-caption").textContent =
    basis === "real" ? "Angular nodes" : "Angular degree l";
  $("shape-explanation").textContent =
    descriptions[l] +
    (basis === "complex"
      ? " Complex m≠0 states have different densities from the real chemistry basis."
      : "");
  $("radial-nodes").textContent = String(orbital.nodes.radial);
  $("angular-nodes").textContent = String(orbital.nodes.angular);
  $("total-nodes").textContent = String(orbital.nodes.total);
  $("energy-value").innerHTML =
    orbital.energy_ev === null
      ? "Qualitative model"
      : `${orbital.energy_ev.toFixed(4)} <small>eV</small>`;
  $("energy-label").textContent =
    orbital.energy_ev === null
      ? "NO MANY-ELECTRON ENERGY CLAIM"
      : "NONRELATIVISTIC STATE ENERGY";
  $("model-note").textContent =
    orbital.model +
    (atom.one_electron && atom.z > 20
      ? ". High Z: relativistic effects become significant."
      : "");
  $("normalization").textContent =
    `∫ |ψ|² dV = ${orbital.normalization.toFixed(6)}`;
  $("scale-readout").innerHTML =
    `r₉₉.₉ = ${orbital.extent_a0.toFixed(2)} a₀ <small>${orbital.extent_nm.toPrecision(3)} nm · from nucleus</small>`;
  $("viewport-caption").textContent =
    mode === "cloud"
      ? `${orbital.count?.toLocaleString()} probability samples · possible measurements, not simultaneous electron positions.`
      : `${orbital.grid_size}³ grid · |ψ| = ${(threshold * 100).toFixed(1)}% of grid peak · not an enclosed-probability boundary.`;
  if (showNodes && basis === "complex")
    $("viewport-caption").textContent +=
      " Angular node meshes are available in the real basis; radial node spheres remain visible.";
  updateLegend();
}
function updateLegend() {
  $("legend").innerHTML = phase
    ? basis === "real"
      ? '<span><i class="positive"></i>+ψ</span><span><i class="negative"></i>−ψ</span><small>Wavefunction sign</small>'
      : '<span class="phase-gradient"></span><small>arg(ψ): −π → +π</small>'
    : '<span><i class="positive"></i>|ψ|² ≥ 0</span><small>Density, without phase coloring</small>';
}
function updateOverlayList() {
  $("overlay-list").hidden = overlayMode === "single";
  if (subshellKey !== `${n},${l}`) {
    subshellKey = `${n},${l}`;
    subshellChoices = new Set(
      Array.from({ length: 2 * l + 1 }, (_, i) => `${n},${l},${i - l}`),
    );
  }
  const choices = overlayMode === "subshell" ? subshellChoices : overlayChoices;
  const subshells =
    overlayMode === "subshell"
      ? [
          {
            subshell: `${n}${"spdf"[l]}`,
            n,
            l,
            orbitals: Array.from({ length: 2 * l + 1 }, (_, i) => ({
              m: i - l,
              spins: [0.5],
            })),
          },
        ]
      : atom.electronic.occupancy;
  $("overlay-list").innerHTML =
    subshells
      .map(
        (s) =>
          `<div class="overlay-subshell"><small>${s.subshell}</small>${s.orbitals
            .filter((o) => o.spins.length)
            .map((o) => {
              const key = `${s.n},${s.l},${o.m}`;
              return `<label><input type="checkbox" data-overlay-state="${key}" ${choices.has(key) ? "checked" : ""}>${s.n}${basis === "real" ? esc(names[s.l][o.m]) : `${"spdf"[s.l]} m=${o.m}`}</label>`;
            })
            .join("")}</div>`,
      )
      .join("") || "<p>No verified occupied states for this ion.</p>";
  document.querySelectorAll<HTMLInputElement>("[data-overlay-state]").forEach(
    (input) =>
      (input.onchange = () => {
        if (input.checked && choices.size >= 8) {
          input.checked = false;
          notify("Select up to eight orbitals for a responsive overlay.");
          return;
        }
        if (input.checked) choices.add(input.dataset.overlayState!);
        else choices.delete(input.dataset.overlayState!);
        void loadOrbital();
      }),
  );
}
function renderAnalysis() {
  if (!atom) return;
  if (activeTab === "occupancy") {
    $("analysis-content").innerHTML =
      `<div class="config-heading"><div><span class="eyebrow">${atom.z > 103 ? "PREDICTED / UNVERIFIED CONFIGURATION" : "REFERENCE GROUND CONFIGURATION"} · ${atom.electrons} ELECTRONS</span><p class="configuration">${atom.electronic.text.replace(/([spdf])(\d+)/g, "$1<sup>$2</sup>")}</p></div><span class="config-status">${esc(atom.electronic.status)}</span></div><div class="occupancy-scroll">${atom.electronic.occupancy.map((s) => `<button class="subshell-diagram" data-occupied="${s.n},${s.l}" title="Inspect ${s.subshell}"><span>${s.subshell}</span><div>${s.orbitals.map((o) => `<span class="orbital-box ${o.spins.length ? "filled" : ""}">${o.spins.map((v) => (v > 0 ? "↑" : "↓")).join("")}</span>`).join("")}</div></button>`).join("")}</div><p class="analysis-note">${Object.entries(
        atom.electronic.shells,
      )
        .map(([shell, count]) => `n=${shell}: ${count}`)
        .join(
          " · ",
        )}${atom.electronic.configuration ? " · Hund / Pauli box diagram; individual orientations are a basis convention, not a measured microstate." : ""}</p>`;
    document.querySelectorAll<HTMLButtonElement>("[data-occupied]").forEach(
      (button) =>
        (button.onclick = () => {
          [n, l] = button.dataset.occupied!.split(",").map(Number);
          m = 0;
          quantumControls();
          void loadOrbital();
        }),
    );
  } else if (activeTab === "radial" && orbital) {
    $("analysis-content").innerHTML =
      `<div class="graph-heading"><span>Radial distribution <b>P(r) = r² |Rₙₗ(r)|²</b></span><small>Integrated over all angles · ∫ P(r) dr = 1</small></div>${graph(
        orbital.radial.r,
        orbital.radial.p,
        "Radius r / a₀",
        "P(r) / a₀⁻¹",
        orbital.radial_nodes.map((r) => r * orbital.length_scale_a0),
      )}<p class="analysis-note">Dashed lines: radial nodes. The r² volume factor makes P(r) different from the local density |ψ|². Display extends to 99.9% radial probability.</p>`;
  } else if (activeTab === "angular" && orbital) {
    $("analysis-content").innerHTML =
      `<div class="graph-heading"><span>Angular density <b>|Yₗᵐ(θ, φ)|²</b></span><small>Cross-section at φ = π/4</small></div>${graph(
        orbital.angular.theta.map((t) => (t * 180) / Math.PI),
        orbital.angular.probability,
        "Polar angle θ / degrees",
        "|Y|² / sr⁻¹",
      )}<p class="analysis-note">This is a slice of the angular density, not a normalized one-dimensional distribution. Angular probabilities integrate with sinθ dθ dφ.</p>`;
  } else if (activeTab === "energy") void renderEnergy();
}
async function renderEnergy() {
  const revision = ++energyRevision;
  if (!atom.one_electron) {
    $("analysis-content").innerHTML =
      '<div class="empty-state"><span>≈</span><div><h3>A many-electron atom needs a different energy model.</h3><p>The Madelung filling sequence is qualitative; −13.6 Z²/n² is not a many-electron spectrum. Select hydrogen or a one-electron ion, such as He⁺, for numerical levels and transitions.</p></div></div>';
    return;
  }
  const id = speciesId;
  try {
    const data = await api<{
      levels: number[];
      delta_ev: number;
      frequency_hz: number;
      wavelength_nm: number;
      kind: string;
      selection_rule: string;
    }>(
      `/api/energy?z=${activeZ}&a=${activeA}&charge=${charge}&initial=3&final=2`,
    );
    if (id !== speciesId || activeTab !== "energy" || revision !== energyRevision) return;
    const values = data.levels;
    const e0 = values[0];
    const diagram = `<svg class="energy-graph" viewBox="0 0 370 150" role="img" aria-label="Hydrogenic bound state energies">${values
      .map((energy, i) => {
        const y = 12 + (energy / e0) * 115;
        return `<line x1="47" x2="260" y1="${y}" y2="${y}" stroke="${i + 1 === n ? "#5ac7e5" : "#384b5b"}" stroke-width="${i + 1 === n ? 2 : 1}"/><text x="10" y="${y + 4}">${i < 4 ? `n=${i + 1}` : ""}</text><text x="270" y="${y + 4}">${i < 4 ? energy.toFixed(3) + " eV" : ""}</text>`;
      })
      .join(
        "",
      )}<text x="47" y="9">Ionization limit · E = 0</text><text x="47" y="147">Nonrelativistic Coulomb levels (reduced mass)</text></svg>`;
    $("analysis-content").innerHTML =
      `<div class="energy-layout">${diagram}<div class="transition"><span class="eyebrow">PHOTON TRANSITION</span><div class="transition-fields"><label>Initial n<input type="number" id="initial-n" min="1" max="30" value="3"></label><span>→</span><label>Final n<input type="number" id="final-n" min="1" max="30" value="2"></label></div><div id="transition-result"></div></div></div><p class="analysis-note">Electric-dipole rules also require Δl = ±1 and Δm = 0, ±1. Choosing n alone does not establish an allowed line.</p>`;
    const result = (v: typeof data) => {
      $("transition-result").innerHTML =
        `<b>${v.wavelength_nm.toFixed(2)} nm</b> <span class="subtle">${v.kind}</span><small>|ΔE| = ${Math.abs(v.delta_ev).toFixed(4)} eV · ν = ${v.frequency_hz.toExponential(3)} Hz</small>`;
    };
    result(data);
    let transitionRequest = 0;
    const update = async () => {
      const request = ++transitionRequest;
      try {
        const ni = $<HTMLInputElement>("initial-n").value,
          nf = $<HTMLInputElement>("final-n").value;
        const v = await api<typeof data>(
          `/api/energy?z=${activeZ}&a=${activeA}&charge=${charge}&initial=${ni}&final=${nf}`,
        );
        if (
          request === transitionRequest &&
          id === speciesId &&
          activeTab === "energy" && revision === energyRevision
        )
          result(v);
      } catch (error) {
        if (request === transitionRequest && id === speciesId && revision === energyRevision && activeTab === "energy" && $("transition-result"))
          $("transition-result").textContent = (error as Error).message;
      }
    };
    let transitionTimer: ReturnType<typeof setTimeout>;
    const commit = () => {
      clearTimeout(transitionTimer);
      void update();
    };
    for (const key of ["initial-n", "final-n"]) {
      $(key).onchange = commit;
      $(key).oninput = () => {
        clearTimeout(transitionTimer);
        transitionTimer = setTimeout(commit, 300);
      };
    }
  } catch (error) {
    if (id === speciesId && activeTab === "energy" && revision === energyRevision) notify((error as Error).message);
  }
}
function periodicTable() {
  modal(
    "The periodic table",
    `<div class="table-search"><span>⌕</span><input id="element-search" placeholder="Search name, symbol, or atomic number…" aria-label="Search elements" autofocus><span>118 ELEMENTS</span></div><div class="periodic-scroll"><div class="periodic-grid">${elements.map((e) => `<button class="periodic-cell category-${e.category.toLowerCase().replaceAll(" ", "-")} ${e.z === activeZ ? "current" : ""}" data-z="${e.z}" style="grid-column:${e.table_column};grid-row:${e.table_row}" title="${esc(e.name)} · ${e.category}"><small>${e.z}</small><strong>${e.symbol}</strong><span>${e.name}</span></button>`).join("")}<span class="periodic-placeholder" style="grid-row:6;grid-column:3">57–71</span><span class="periodic-placeholder" style="grid-row:7;grid-column:3">89–103</span></div></div><div class="table-legend"><span><i style="background:#6ca6bf"></i>Metals</span><span><i style="background:#91baa0"></i>Nonmetals</span><span><i style="background:#baad83"></i>Metalloids</span><span><i style="background:#9f9ebd"></i>Noble gases</span></div><p class="body-copy">Select any element. Isotope defaults use the largest listed natural abundance when available. Entries without verified isotope data are explicitly labeled schematic. Superheavy electron assignments carry uncertainty labels.</p>`,
    "01 / ATOMIC SPECIES",
  );
  document.querySelectorAll<HTMLButtonElement>("[data-z]").forEach(
    (button) =>
      (button.onclick = () => {
        closeModal();
        const z = Number(button.dataset.z);
        void selectSpecies(z, undefined, 0);
      }),
  );
  $("element-search").oninput = () => {
    const term = $<HTMLInputElement>("element-search")
      .value.toLowerCase()
      .trim();
    document
      .querySelectorAll<HTMLButtonElement>("[data-z]")
      .forEach((button) => {
        const e = elements[Number(button.dataset.z) - 1];
        const match =
          !term ||
          `${e.z} ${e.symbol} ${e.name} ${e.category}`
            .toLowerCase()
            .includes(term);
        button.classList.toggle("dimmed", !match);
        button.disabled = !match;
      });
  };
}
function gallery() {
  modal(
    "The orbital gallery",
    `<p class="body-copy">Choose a real spherical-harmonic basis function to compute and inspect in 3D. These are mathematical states, independent of the selected atom’s occupancy.</p><div class="gallery-filters">${["s", "p", "d", "f"].map((family, i) => `<button data-gallery-family="${i}" class="${i === l ? "selected" : ""}">${family} family · ${2 * i + 1} states</button>`).join("")}</div><div class="gallery-grid" id="gallery-grid"></div><p class="body-copy">Each spatial orbital can hold two opposite spins. A whole subshell can hold 2(2l+1) electrons. Real states with m ≠ 0 combine ±|mₗ|.</p>`,
    "02 / ORBITAL STATES",
  );
  const draw = (family: number) => {
    const shell = Math.max(n, family + 1);
    $("gallery-grid").innerHTML = Object.entries(names[family])
      .map(
        ([index, name]) =>
          `<button class="gallery-card" data-gallery-m="${index}"><small>${shell}${"spdf"[family]} · REAL BASIS INDEX ${index}</small><strong>${esc(name)}</strong><span>${shell - family - 1} radial · ${family} angular nodes</span><span class="gallery-open">Inspect in 3D ↗</span></button>`,
      )
      .join("");
    document.querySelectorAll<HTMLButtonElement>("[data-gallery-m]").forEach(
      (button) =>
        (button.onclick = () => {
          n = shell;
          l = family;
          m = Number(button.dataset.galleryM);
          basis = "real";
          $<HTMLSelectElement>("basis").value = "real";
          quantumControls();
          closeModal();
          void loadOrbital();
        }),
    );
    document
      .querySelectorAll<HTMLButtonElement>("[data-gallery-family]")
      .forEach((button) =>
        button.classList.toggle(
          "selected",
          Number(button.dataset.galleryFamily) === family,
        ),
      );
  };
  document
    .querySelectorAll<HTMLButtonElement>("[data-gallery-family]")
    .forEach(
      (button) =>
        (button.onclick = () => draw(Number(button.dataset.galleryFamily))),
    );
  draw(l);
}
function particleInfo(type: string) {
  const info: Record<string, [string, string, string, string]> = {
    proton: [
      "Proton",
      "+e = +1.602176634 × 10⁻¹⁹ C",
      "1.67262 × 10⁻²⁷ kg",
      "The proton count is the atomic number Z and determines the element. Isotopes retain the same proton count.",
    ],
    neutron: [
      "Neutron",
      "0 C",
      "1.67493 × 10⁻²⁷ kg",
      "Neutrons contribute nuclear mass and affect nuclear stability. An isotope has A − Z neutrons. This simulator does not calculate nuclear binding.",
    ],
    electron: [
      "Electron",
      "−e = −1.602176634 × 10⁻¹⁹ C",
      "9.10938 × 10⁻³¹ kg",
      "The electron count is Z minus ionic charge. Cloud dots are possible outcomes of separate position measurements, not a map of simultaneously known electron positions.",
    ],
  };
  const [name, q, mass, role] = info[type];
  modal(
    name,
    `<div class="particle-detail ${type}"><span class="particle ${type}"></span><div><span class="eyebrow">ELECTRIC CHARGE</span><h3>${q}</h3><span class="eyebrow">APPROXIMATE REST MASS</span><h3>${mass}</h3></div></div><p class="body-copy">${role}</p><div class="callout">Nuclear particles are individually drawn in a schematic arrangement. The nucleus is greatly enlarged relative to the orbital cloud; this is not a nuclear many-body solution.</div>`,
    "SUBATOMIC PARTICLES",
  );
}
function scienceGuide() {
  const tours = [
    ["1s","Explore hydrogen 1s"],["2p","Observe a 2p nodal plane"],
    ["molecular","Compare bonding and antibonding"],["bond","Find the H₂⁺ bond minimum"],
    ["spectroscopy","Calculate a Balmer wavelength"],["measurement","Repeat position measurements"],
    ["tunneling","Change a tunneling barrier"],["dynamics","Watch quantum interference"],
    ["scf","Compare contracted and expanded RHF"],["fields","Inspect Stark state mixing"],
  ];
  modal(
    "A guide to the quantum model",
    `
<section class="guided-experiments"><h3>Guided working experiments</h3><p>Each activity opens a live calculation with a validated starting configuration. Change its controls, inspect the assumptions, and export the results.</p><div class="lab-actions">${tours.map(([key,label])=>`<button data-tour="${key}">${label}</button>`).join("")}</div><p>The laboratories use different Hamiltonians: hydrogenic orbitals, fixed-center H₂⁺ LCAO, 1D dynamics, RHF and optional PySCF. Their model labels and units are part of every result; a visual resemblance does not establish physical equivalence.</p></section><div class="guide-grid"><section><h3>From amplitude to probability</h3><p>ψ = RₙₗYₗᵐ solves the nonrelativistic one-electron Coulomb problem. The radial part uses normalized associated Laguerre polynomials; the angular part uses normalized spherical harmonics.</p><p>For an infinitely heavy Z = 1 nucleus, ψ₁₀₀ = e⁻ʳ/√π in atomic units. This app includes reduced mass, so ordinary hydrogen has a slightly larger length scale.</p><h3>What the dots mean</h3><p>The radial distribution is sampled from r²|R|². Directions are sampled from |Y|² with a uniform cosθ proposal, which includes the sinθ volume factor. Each point represents a possible position measurement in the same prepared state.</p><h3>Reading a surface</h3><p>Marching cubes extracts ψ = ±t for real orbitals or |ψ| = t for complex states. The threshold is a fraction of the sampled grid peak amplitude, not a percentage of enclosed probability. Lower it to expose small radial lobes.</p></section><section><h3>Exact within a stated model</h3><p>Hydrogenic functions, nodes and energies are analytic solutions of the nonrelativistic point-nucleus Coulomb model. Numerical sampling, finite grids, and quadrature have finite precision. Relativity, fine structure, Lamb shifts and finite nuclear size are omitted; high-Z ions especially need corrections.</p><h3>Approximate many-electron orbitals</h3><p>For multi-electron species, Z_eff is an illustrative user parameter, not a calculated screening constant. Atomic Explorer does not calculate screening self-consistently. Computational Chemistry provides separate RHF and optional PySCF calculations; these do not change the illustrative atomic Z_eff model. An overlay combines separate orbital densities, not a many-electron wavefunction.</p><h3>A schematic nucleus</h3><p>A nucleus has a radius of order femtometers; electronic distances are commonly of order 10⁻¹¹–10⁻¹⁰ m. It is enlarged here so individual protons and neutrons remain visible. The lattice and particle spheres have no physical geometry claim.</p></section><section><h3>Real orbitals and quantum numbers</h3><p>n ≥ 1, 0 ≤ l &lt; n, −l ≤ mₗ ≤ l; spin is ±½. The real pₓ, pᵧ and related d/f states are superpositions of ±mₗ states. A real-basis index selects a function, not a definite L_z value. Choose the complex basis to inspect definite mₗ.</p><h3>Electron configurations</h3><p>NIST reference data are bundled for neutral H–U and their first cations, plus a small curated common-cation table. Later neutral assignments use PubChem and carry uncertainty labels. Unsupported ion configurations are not guessed. Hund diagrams illustrate occupancy; spin–orbit coupling and actual term structure are not resolved.</p><h3>Isotope data</h3><p>NIST mass/abundance records are bundled. Natural abundance does not itself imply stability. Custom compositions and defaults outside that table are explicitly unverified. Reduced nuclear mass subtracts electron rest masses from the atomic mass and neglects electronic binding mass.</p></section><section><h3>Controls</h3><p>Drag to rotate. Scroll to zoom. Right-drag or Shift-drag to pan. Focus the viewport and press R to reset. Click a nucleus particle for details. Use Tab and Enter for controls and Escape to close dialogs.</p><h3>Numerical scope</h3><p>Viewer: n = 1…8; s, p, d, f. Three bounded quality levels, 1,000–60,000 points, cached geometry, and at most two concurrent calculations. Density points are reduced during a drag. Overlay previews use a smaller mesh and at most eight occupied states.</p><h3>Primary references</h3><p><a href="https://dlmf.nist.gov/14.30" target="_blank" rel="noreferrer">NIST DLMF · Spherical harmonics ↗</a><br><a href="https://math.nist.gov/DFTdata/atomdata/configuration.html" target="_blank" rel="noreferrer">NIST · Electronic configurations ↗</a><br><a href="https://physics.nist.gov/PhysRefData/Compositions/" target="_blank" rel="noreferrer">NIST · Isotope masses and compositions ↗</a><br><a href="https://pubchem.ncbi.nlm.nih.gov/periodic-table/" target="_blank" rel="noreferrer">NIH PubChem · Elements ↗</a></p></section></div>`,
    "SCIENTIFIC BASIS & LIMITATIONS",
  );
  document.querySelectorAll<HTMLButtonElement>("[data-tour]").forEach(button => button.onclick = () => {
    const key = button.dataset.tour!; closeModal();
    if (key === "1s" || key === "2p") {
      document.querySelector<HTMLButtonElement>('[data-lab="atomic"]')!.click();
      n = key === "1s" ? 1 : 2; l = key === "1s" ? 0 : 1; m = 0;
      basis = "real"; showNodes = key === "2p"; mode = key === "2p" ? "surface" : "cloud";
      overlayMode = "single"; quality = runtime.mode==='public'?"preview":"balanced"; points = runtime.mode==='public'?5000:18000; threshold = .06;
      $<HTMLSelectElement>("basis").value = basis; $<HTMLSelectElement>("quality").value = quality;
      $<HTMLSelectElement>("overlay").value = overlayMode; $<HTMLInputElement>("nodes").checked = showNodes;
      $<HTMLInputElement>("points").value = String(points); $("points-value").textContent=`${points/1000}k`;
      $<HTMLInputElement>("threshold").value=String(threshold); $("threshold-value").textContent="6%";
      $("point-control").hidden=mode!=="cloud"; $("threshold-control").hidden=mode!=="surface";
      for(const value of ["cloud","surface"]) { $(value).classList.toggle("selected",mode===value); $(value).setAttribute("aria-pressed",String(mode===value)); }
      quantumControls(); void selectSpecies(1,1,0); return;
    }
    const lab = key === "bond" || key === "molecular" ? "molecular"
      : key === "scf" ? "computation" : key === "measurement" || key === "tunneling" || key === "fields" ? "experiments" : key;
    document.querySelector<HTMLButtonElement>(`[data-lab="${lab}"]`)!.click();
    if(key === "tunneling" || key === "fields") document.querySelector<HTMLButtonElement>(`[data-experiment="${key}"]`)!.click();
    const form = document.querySelector<HTMLFormElement>("#lab-workspace form");
    const values:Record<string,string> = key === "bond" ? {distance:"2.5"} : key === "molecular" ? {orbital:"antibonding"}
      : key === "fields" ? {electric:"0.000001"} : key === "scf" ? {basis:"uncontracted-sto-3g"} : {};
    for(const [name,value] of Object.entries(values)) {
      const input=form?.querySelector<HTMLInputElement|HTMLSelectElement>(`[name="${name}"]`);
      if(input) { input.value=value; input.dispatchEvent(new Event("input",{bubbles:true})); }
    }
    if(Object.keys(values).length)form?.requestSubmit();
  });
}

// Wire all controls once; dynamic panels install their own scoped handlers.
$("open-table").onclick = periodicTable;
// Keep the keyboard skip action separate from the fragment-based router.
document.querySelector<HTMLAnchorElement>('.skip-link')!.onclick=event=>{
  event.preventDefault();
  const root=$('atomic-workspace').hidden?$('lab-workspace'):$('viewport');
  const target=root.querySelector<HTMLElement>('canvas,.lab-results,h1')??root;
  if(!target.hasAttribute('tabindex'))target.tabIndex=-1;
  target.focus();target.scrollIntoView({block:'start'});
};
$("element-select").onclick = periodicTable;
$("gallery").onclick = gallery;
$("help").onclick = scienceGuide;
$("science-guide").onclick = scienceGuide;
$("proton-info").onclick = () => particleInfo("proton");
$("neutron-info").onclick = () => particleInfo("neutron");
$("electron-info").onclick = () => particleInfo("electron");
$("classical").onclick = () =>
  modal(
    "Classical comparison",
    `<div class="comparison"><div><span class="eyebrow">BOHR / LEGACY</span><h3>Fixed circular trajectories</h3><p>Your original Pygame program remains unchanged. It draws moving electrons on circular shells and provides hydrogen Bohr calculations.</p><pre>.venv/bin/python main.py</pre><p>Keys 1 / 2 / 3: H / He / Li · P: physics · Escape: exit.</p></div><div><span class="eyebrow">SCHRÖDINGER / PRIMARY</span><h3>A spatial probability distribution</h3><p>This browser application evaluates ψ(r, θ, φ). No electron trajectories are assigned. The probability cloud is stationary; camera movement changes only the viewpoint.</p><pre>.venv/bin/python run.py</pre><p>The original shell allocation is an educational simplification. It is not used for quantum occupancy.</p></div></div><div class="callout">The comparison is conceptual. Run the original Pygame command in a terminal to open the preserved live classical model.</div>`,
    "TWO MODELS OF THE ATOM",
  );
$("n").onchange = () => {
  n = Number($<HTMLSelectElement>("n").value);
  l = Math.min(l, n - 1);
  m = Math.min(l, Math.max(-l, m));
  quantumControls();
  void loadOrbital();
};
document.querySelectorAll<HTMLButtonElement>("[data-family]").forEach(
  (button) =>
    (button.onclick = () => {
      l = Number(button.dataset.family);
      n = Math.max(n, l + 1);
      m = 0;
      quantumControls();
      void loadOrbital();
    }),
);
$("orientation").onchange = () => {
  m = Number($<HTMLSelectElement>("orientation").value);
  quantumControls();
  void loadOrbital();
};
$("basis").onchange = () => {
  basis = $<HTMLSelectElement>("basis").value;
  quantumControls();
  void loadOrbital();
};
$("spin").onchange = () => {
  spin = Number($<HTMLSelectElement>("spin").value);
  if (orbital) updateInspector();
};
$("isotope").onchange = () =>
  void selectSpecies(activeZ, Number($<HTMLSelectElement>("isotope").value));
let chargeTimer: ReturnType<typeof setTimeout>;
function commitCharge() {
  clearTimeout(chargeTimer);
  void selectSpecies(
    activeZ,
    activeA,
    Number($<HTMLInputElement>("charge").value),
  );
}
$("charge").onchange = commitCharge;
$("charge").oninput = () => {
  clearTimeout(chargeTimer);
  chargeTimer = setTimeout(commitCharge, 300);
};
$("apply-a").onclick = () =>
  void selectSpecies(activeZ, Number($<HTMLInputElement>("custom-a").value));
let zeffTimer: ReturnType<typeof setTimeout>;
function commitZeff() {
  clearTimeout(zeffTimer);
  const v = Number($<HTMLInputElement>("zeff").value);
  if (!Number.isFinite(v) || v < 0.1 || v > 118) {
    notify("Z_eff must be between 0.1 and 118.");
    return;
  }
  effectiveZ = v;
  void loadOrbital();
}
$("zeff").onchange = commitZeff;
$("zeff").oninput = () => {
  clearTimeout(zeffTimer);
  zeffTimer = setTimeout(commitZeff, 300);
};
function changeMode(value: string) {
  mode = value;
  ["cloud", "surface"].forEach((v) =>
    { $(v).classList.toggle("selected", v === mode); $(v).setAttribute("aria-pressed",String(v===mode)); },
  );
  $("point-control").hidden = mode !== "cloud";
  $("threshold-control").hidden = mode !== "surface";
  void loadOrbital();
}
$("cloud").onclick = () => changeMode("cloud");
$("surface").onclick = () => changeMode("surface");
function changePhase(value: boolean) {
  phase = value;
  $("phase").classList.toggle("selected", phase);
  $("density").classList.toggle("selected", !phase);
  $("phase").setAttribute("aria-pressed",String(phase));
  $("density").setAttribute("aria-pressed",String(!phase));
  viewer?.setColor(phase);rememberAtomic();
  updateLegend();
}
$("phase").onclick = () => changePhase(true);
$("density").onclick = () => changePhase(false);
$("reset").onclick = () => viewer?.reset();
$("axes").onchange = () =>
  { if (viewer) { viewer.axes.visible = $<HTMLInputElement>("axes").checked; viewer.invalidate(); } };
$("nucleus").onchange = () =>
  { if (viewer) { viewer.nucleus.visible = $<HTMLInputElement>("nucleus").checked; viewer.invalidate(); } };
$("nodes").onchange = () => {
  showNodes = $<HTMLInputElement>("nodes").checked;
  void loadOrbital();
};
$("rotate").onchange = () =>
  { if (viewer) { viewer.rotation = $<HTMLInputElement>("rotate").checked; viewer.invalidate(); } };
$("opacity").oninput = () => {
  const value = Number($<HTMLInputElement>("opacity").value);
  $("opacity-value").textContent = `${Math.round(value * 100)}%`;
  viewer?.setOpacity(value);
};
$("points").oninput = () => {
  $("points-value").textContent =
    `${Number($<HTMLInputElement>("points").value) / 1000}k`;
};
$("points").onchange = () => {
  points = Number($<HTMLInputElement>("points").value);
  void loadOrbital();
};
$("threshold").oninput = () => {
  $("threshold-value").textContent =
    `${(Number($<HTMLInputElement>("threshold").value) * 100).toFixed(1)}%`;
};
$("threshold").onchange = () => {
  threshold = Number($<HTMLInputElement>("threshold").value);
  void loadOrbital();
};
$("quality").onchange = () => {
  quality = $<HTMLSelectElement>("quality").value;
  points = quality === "preview" ? 5000 : quality === "high" ? 45000 : 18000;
  $<HTMLInputElement>("points").value = String(points);
  $("points-value").textContent = `${points / 1000}k`;
  void loadOrbital();
};
$("overlay").onchange = () => {
  overlayMode = $<HTMLSelectElement>("overlay").value;
  updateOverlayList();
  void loadOrbital();
};
document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach(
  (button) =>
    (button.onclick = () => {
      activeTab = button.dataset.tab!;
      document.querySelectorAll("[data-tab]").forEach((b) => {
        b.classList.toggle("active", b === button);
        b.setAttribute("aria-selected", String(b === button));
      });
      renderAnalysis();rememberAtomic();
    }),
);
$("export").onclick = () => {
  if (!viewer || !orbital) { notify("No rendered orbital available to export."); return; }
  const link = document.createElement("a");
  link.download = `quantum-${n}${"spdf"[l]}-${m}.png`;
  link.href = viewer.screenshot(`${atom.symbol}-${atom.a} · ${orbital.label} · ${orbital.model}`, `Length: a₀ · ${mode} · ${basis} basis · nucleus schematic${mode === "surface" ? ` · amplitude threshold ${threshold}` : ""}`);
  link.click();
  notify(
    "Viewport image saved with model and unit labels.",
  );
};

function rememberAtomic(){
 if(readRoute().get('lab')!=='atomic'||!atom)return;
 rememberParameters('atomic',{...Object.fromEntries(queryFor()),phase:String(phase),tab:activeTab});
}
function navigateAtomic(active:boolean){
 if(!active){controller?.abort();speciesController?.abort();++requestId;++speciesId;++energyRevision;return;}
 if(!atomicReady)return;
 const saved=savedParameters('atomic');
 if(!saved){if(!atom)void selectSpecies(1,1,0);return;}
 const value=(key:string,fallback:number,min:number,max:number,integer=true)=>{const v=Number(saved[key]);return Number.isFinite(v)&&v>=min&&v<=max&&(!integer||Number.isInteger(v))?v:fallback;};
 n=value('n',1,1,8);l=value('l',0,0,Math.min(n-1,3));m=value('m',0,-l,l);spin=saved.spin==='-0.5'?-.5:.5;
 basis=saved.basis==='complex'?'complex':'real';mode=saved.mode==='surface'?'surface':'cloud';quality=runtime.mode==='public'?'preview':['preview','balanced','high'].includes(saved.quality)?saved.quality:'preview';
 points=value('points',5000,1000,runtime.atomic_max_points);threshold=value('threshold',.06,.005,.4,false);effectiveZ=value('zeff',1,.1,118,false);showNodes=saved.nodes==='true';phase=saved.phase!=='false';
 quantumControls();$<HTMLSelectElement>('quality').value=quality;$<HTMLInputElement>('points').value=String(points);$('points-value').textContent=`${points/1000}k`;
 $<HTMLInputElement>('threshold').value=String(threshold);$('threshold-value').textContent=`${(threshold*100).toFixed(1)}%`;$<HTMLInputElement>('nodes').checked=showNodes;$<HTMLInputElement>('zeff').value=String(effectiveZ);
 for(const key of ['cloud','surface'])$(key).setAttribute('aria-pressed',String(key===mode));for(const key of ['phase','density'])$(key).setAttribute('aria-pressed',String((key==='phase')===phase));
 const tab=document.querySelector<HTMLButtonElement>(`[data-tab="${['occupancy','radial','angular','energy'].includes(saved.tab)?saved.tab:'occupancy'}"]`);tab?.click();
 const z=value('z',1,1,118),a=value('a',z,z,350),q=value('charge',0,z-118,z);
 void selectSpecies(z,a,q);
}
async function start() {
  await initializeRuntime();
  if(runtime.mode==='public'){
    quality='preview';points=5000;
    const select=$<HTMLSelectElement>('quality');select.value='preview';
    [...select.options].forEach(option=>option.disabled=option.value!=='preview');
    $<HTMLInputElement>('points').max=String(runtime.atomic_max_points);$<HTMLInputElement>('points').value='5000';$('points-value').textContent='5k';
  }
  quantumControls();$<HTMLSelectElement>('quality').value=quality;$<HTMLInputElement>('points').value=String(points);$('points-value').textContent=`${points/1000}k`;
  try {
    viewer = new OrbitalViewer($("viewport"), particleInfo);
  } catch (error) {
    $("loading").hidden = true;
    notify(
      "WebGL could not initialize. Enable hardware acceleration and reload. " +
        (error as Error).message,
    );
  }
  try {
    elements = await api<ElementData[]>("/api/elements");
    atomicReady=true;initializeNavigation({guide:scienceGuide,atomic:navigateAtomic});
    if(readRoute().get('lab')!=='atomic')$('loading').hidden=true;
  } catch (error) {
    $("loading").hidden = true;
    notify(
      (runtime.mode==='public'?"The public demo is temporarily unavailable. Retry shortly. ":"Cannot reach the Python backend. Start .venv/bin/python run.py. ") +
        (error as Error).message,
    );
  }
}
registerLab("spectroscopy", mountSpectroscopy);
registerLab("experiments", mountExperiments);
registerLab("dynamics", mountDynamics);
registerLab("materials",mountMaterials);
registerLab("molecular", mountMolecular);
registerLab("computation", mountComputation);

for (const [key,selected] of [["phase",true],["density",false],["cloud",true],["surface",false]] as const) $(key).setAttribute("aria-pressed",String(selected));
// The tablist follows the keyboard interaction specified by its ARIA role.
const tabs = [...document.querySelectorAll<HTMLButtonElement>("[data-tab]")];
tabs.forEach((button, index) => {
  button.id = `analysis-${button.dataset.tab}`;
  button.setAttribute("aria-controls", "analysis-content");
  button.tabIndex = index === 0 ? 0 : -1;
  button.addEventListener("click", () => {
    tabs.forEach(tab => tab.tabIndex = tab === button ? 0 : -1);
    $("analysis-content").setAttribute("aria-labelledby", button.id);
  });
  button.addEventListener("keydown", event => {
    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length
      : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length
      : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault(); tabs[next].focus(); tabs[next].click();
  });
});
$("analysis-content").setAttribute("aria-labelledby", tabs[0].id);
window.addEventListener("pagehide", () => { controller?.abort(); speciesController?.abort(); viewer?.dispose(); queueMicrotask(disposeIdleRenderers); });
void start();
