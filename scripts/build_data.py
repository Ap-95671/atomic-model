"""Rebuild offline data deterministically from the checked-in primary sources."""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
raw = json.loads((DATA / "sources/pubchem-periodic-table.json").read_text())["Table"]
columns = raw["Columns"]["Column"]
source = [dict(zip(columns, row["Cell"])) for row in raw["Row"]]
nist = html.unescape(re.sub(r"<[^>]*>", "", (DATA / "sources/nist-configurations.html").read_text()))
configs = {}
for line in nist.splitlines():
    match = re.match(r"^\s*(\d+)\s+([A-Z][a-z]?)\s{2,}(.+?)\s{2,}(.+?)\s*$", line)
    if match:
        z, symbol, neutral, ion = match.groups()
        configs[int(z)] = (neutral.replace("^", ""), ion.replace("^", ""))
assert len(configs) == 92
# Table coordinates are layout conventions, separate from occupancy.
rows = [list(range(1, 3)), list(range(3, 11)), list(range(11, 19)), list(range(19, 37)),
        list(range(37, 55)), [55, 56, *range(72, 87)], [87, 88, *range(104, 119)]]
coordinates = {}
for period, zs in enumerate(rows, 1):
    groups = [1, 18] if period == 1 else ([1, 2, 13, 14, 15, 16, 17, 18] if period < 4 else range(1, 19))
    if period in (6, 7):
        groups = [1, 2, *range(4, 19)]
    coordinates.update({z: (period, group) for z, group in zip(zs, groups)})
for start, period in [(57, 9), (89, 10)]:
    coordinates.update({z: (period, z-start+3) for z in range(start, start+15)})
elements = []
for item in source:
    z = int(item["AtomicNumber"])
    period, group = coordinates[z]
    elements.append({"z": z, "symbol": item["Symbol"], "name": item["Name"],
        "atomic_mass": item["AtomicMass"], "category": item["GroupBlock"],
        "configuration": configs.get(z, (item["ElectronConfiguration"], None))[0],
        "first_cation": configs.get(z, (None, None))[1],
        "configuration_status": "NIST reference compilation" if z <= 92 else (
            "PubChem compiled assignment; not independently verified here" if z <= 103 else
            "Predicted / unverified superheavy configuration (PubChem); not an experimental ground-state claim"),
        "period": period, "group": group})
# Store display coordinates separately from physical periods/groups.
for el in elements:
    el["table_row"], el["table_column"] = el["period"], el["group"]
    if el["period"] in (9, 10):
        el["period"] = 6 if el["period"] == 9 else 7
        el["group"] = None  # Detached f-block layout; group-3 placement is conventional.
# The current NIST elemental entry supersedes PubChem's obsolete Lr 6d assignment.
# Source snapshot: data/sources/nist-lawrencium.html.
elements[102]["configuration"] = "[Rn]5f14 7s2 7p1"
elements[102]["configuration_status"] = "Current NIST elemental entry; relativistic 7p assignment (supersedes older PubChem 6d assignment)"
# The NIST isotope table provides mass and abundance, not half-life/stability.
text = html.unescape((DATA / "sources/nist-isotopes.html").read_text())
pattern = re.compile(r"Atomic Number = (\d+)\s+Atomic Symbol = (\w+)\s+Mass Number = (\d+)\s+Relative Atomic Mass = ([^\n]+)\s+Isotopic Composition = ([^\n]*)")
isotopes = {str(z): [] for z in range(1, 119)}
for z, symbol, a, mass, abundance in pattern.findall(text):
    value = re.match(r"[\d.]+", mass.strip())
    ab = re.match(r"[\d.]+", abundance.strip())
    isotopes[z].append({"a": int(a), "mass_u": float(value[0]) if value else None,
        "abundance": float(ab[0]) if ab else None,
        "label": "NIST tabulated isotope" + ("; natural abundance listed" if ab else "; no natural abundance listed"),
        "verified": True})
assert len(isotopes["1"]) == 3
# For Z outside the older NIST isotope compilation, only provide a clearly labeled
# schematic default. This is not an isotope-existence or stability claim.
for el in elements:
    options = isotopes[str(el["z"])]
    if not options:
        a = round(float(el["atomic_mass"]))
        options.append({"a": a, "mass_u": None, "abundance": None,
            "label": "Schematic mass number from rounded PubChem mass; isotope existence/stability not verified",
            "verified": False})
    best = max(options, key=lambda i: i["abundance"] or 0)
    el["default_a"] = best["a"]
(DATA / "elements.json").write_text(json.dumps(elements, indent=2)+"\n")
(DATA / "isotopes.json").write_text(json.dumps(isotopes, indent=2)+"\n")
print(f"Built {len(elements)} elements and {sum(map(len, isotopes.values()))} isotope entries")
