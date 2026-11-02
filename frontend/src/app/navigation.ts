import { $ } from "../components/dom";

export type Lab = "atomic" | "spectroscopy" | "experiments" | "dynamics";
type Mount = (host: HTMLElement) => (() => void);
const mounts = new Map<Lab, Mount>();
let cleanup: (() => void) | undefined;
export function registerLab(lab: Lab, mount: Mount) { mounts.set(lab, mount); }

export function initializeNavigation(actions: { guide: () => void }) {
  const nav = document.createElement("nav");
  nav.className = "lab-nav";
  nav.setAttribute("aria-label", "Scientific laboratories");
  const items = [
    ["atomic", "Atomic Explorer"], ["molecular", "Molecular Lab"],
    ["dynamics", "Quantum Dynamics"], ["spectroscopy", "Spectroscopy"],
    ["experiments", "Quantum Experiments"], ["computation", "Computational Chemistry"],
    ["guide", "Scientific Guide"],
  ];
  for (const [key, name] of items) {
    const button = document.createElement("button");
    button.textContent = name;
    button.dataset.lab = key;
    const enabled = key === "atomic" || key === "guide" || mounts.has(key as Lab);
    button.disabled = !enabled;
    if (!enabled) { button.textContent += " · planned"; button.title = "A later implementation milestone; no calculation is available yet."; }
    button.classList.toggle("active", key === "atomic");
    if (key !== "guide") button.setAttribute("aria-pressed", String(key === "atomic"));
    button.onclick = () => {
      if (key === "guide") { actions.guide(); return; }
      cleanup?.(); cleanup = undefined;
      $("atomic-workspace").hidden = key !== "atomic";
      $("lab-workspace").hidden = key === "atomic";
      nav.querySelectorAll<HTMLButtonElement>("[aria-pressed]").forEach(b => {
        b.classList.toggle("active", b === button);
        b.setAttribute("aria-pressed", String(b === button));
      });
      if (key !== "atomic") cleanup = mounts.get(key as Lab)?.($("lab-workspace"));
      else $("lab-workspace").replaceChildren();
    };
    nav.append(button);
  }
  $("atomic-workspace").before(nav);
}
