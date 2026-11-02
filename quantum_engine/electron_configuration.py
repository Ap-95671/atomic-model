"""Reference configurations first; never silently assume universal Aufbau filling."""
import json
import re
from pathlib import Path

ELEMENTS = json.loads((Path(__file__).resolve().parents[1]/"data/elements.json").read_text())
BY_SYMBOL = {item["symbol"]: item for item in ELEMENTS}
FAMILIES = "spdf"
ORDER = sorted([(n, l) for n in range(1, 8) for l in range(min(n, 4))], key=lambda v: (sum(v), v[0]))


def parse_configuration(text):
    if not text or text.strip() == "-":
        return {}
    config = {}
    core = re.search(r"\[([A-Z][a-z]?)\]", text)
    if core:
        config.update(parse_configuration(BY_SYMBOL[core[1]]["configuration"]))
    for n, family, count in re.findall(r"([1-7])([spdf])(\d+)", text.replace("^", "")):
        key = f"{n}{family}"
        config[key] = int(count)
    return config


def aufbau(electrons):
    """Explicitly idealized Madelung model, separate from reference assignments."""
    if not isinstance(electrons, int) or not 0 <= electrons <= 118:
        raise ValueError("Electron count must be 0…118")
    result = {}
    for n, l in ORDER:
        count = min(electrons, 2*(2*l+1))
        if count:
            result[f"{n}{FAMILIES[l]}"] = count
        electrons -= count
    return result


def occupancy(configuration):
    """Hund/Pauli box diagram. This is a basis convention, not a resolved term."""
    result = []
    for key, electrons in sorted(configuration.items(), key=lambda v: (int(v[0][0]), FAMILIES.index(v[0][1]))):
        n, l = int(key[0]), FAMILIES.index(key[1])
        boxes = 2*l+1
        if not 0 <= electrons <= 2*boxes:
            raise ValueError(f"Invalid subshell occupancy for {key}")
        result.append({"subshell": key, "n": n, "l": l, "electrons": electrons,
            "orbitals": [{"m": i-l, "spins": ([0.5] if i < min(electrons, boxes) else []) +
                ([-0.5] if i < max(0, electrons-boxes) else [])} for i in range(boxes)]})
    return result


def configuration_for(z, charge=0):
    if not isinstance(z, int) or not 1 <= z <= 118 or not isinstance(charge, int) or not 0 <= z-charge <= 118:
        raise ValueError("Invalid atomic number or ion charge")
    element = ELEMENTS[z-1]
    count = z-charge
    status = element["configuration_status"]
    if charge == 0:
        config = parse_configuration(element["configuration"])
    elif count <= 2:
        config = {"1s": count} if count else {}
        status = "One-electron / helium-like / bare-ion occupancy"
    elif charge == 1 and element["first_cation"]:
        config = parse_configuration(element["first_cation"])
        status = "NIST first-cation reference compilation (includes rearrangements)"
    elif (z, charge) in COMMON_IONS:
        config = parse_configuration(COMMON_IONS[z, charge])
        status = "Curated common-cation assignment; NIST ASD reference"
    else:
        return {"configuration": None, "text": "Not verified for this ion", "status":
            "Particle counts are valid. No reference configuration is bundled for this charge; no Aufbau guess is substituted.",
            "occupancy": [], "shells": {}, "electrons": count}
    if sum(config.values()) != count:
        raise ValueError("Reference configuration electron-count mismatch")
    shells = {}
    for key, number in config.items():
        shells[key[0]] = shells.get(key[0], 0)+number
    return {"configuration": config, "text": " ".join(f"{key}{num}" for key, num in sorted(config.items(), key=lambda x: (int(x[0][0]), FAMILIES.index(x[0][1])))) or "Bare nucleus",
            "status": status, "occupancy": occupancy(config), "shells": shells, "electrons": count}


# Selected multiply charged cations only. Highest n electrons are removed first
# in these cases (4s before 3d). Unlisted charges deliberately remain unknown.
COMMON_IONS = {
    (12, 2): "[Ne]", (13, 3): "[Ne]", (20, 2): "[Ar]",
    (24, 2): "[Ar]3d4", (24, 3): "[Ar]3d3", (25, 2): "[Ar]3d5",
    (26, 2): "[Ar]3d6", (26, 3): "[Ar]3d5", (27, 2): "[Ar]3d7",
    (28, 2): "[Ar]3d8", (29, 2): "[Ar]3d9", (30, 2): "[Ar]3d10",
    (38, 2): "[Kr]", (56, 2): "[Xe]", (60, 3): "[Xe]4f3",
}
