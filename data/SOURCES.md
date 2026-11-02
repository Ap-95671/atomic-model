# Offline scientific data provenance

Retrieved 2 November 2026. Runtime calculations never fetch remote data.
Rebuild `elements.json` and `isotopes.json` with:

```sh
.venv/bin/python scripts/build_data.py
```

| Snapshot | Primary source | Use and caveat |
| --- | --- | --- |
| `sources/pubchem-periodic-table.json` | [NIH PubChem PUG REST periodic table](https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON) | All 118 names, symbols, classifications, mass strings, and later neutral configuration assignments. Superheavy assignments are labeled predicted/unverified. |
| `sources/nist-configurations.html` | [NIST electronic configurations](https://math.nist.gov/DFTdata/atomdata/configuration.html) | Neutral H–U and first cations. NIST explains literature-based assignments and historical source dates. Reference compilation, not a new experimental measurement for every entry. |
| `sources/nist-isotopes.html` | [NIST isotope compositions](https://physics.nist.gov/cgi-bin/Compositions/stand_alone.pl?ele=&all=all&ascii=ascii2) | 354 tabulated selectable entries in this snapshot; fallback support exists if a future snapshot omits an element. Listed isotope masses and abundances are retained; stability and half-lives are not inferred. |
| `sources/nist-lawrencium.html` | [NIST lawrencium elemental entry](https://physics.nist.gov/cgi-bin/Elements/elInfo.pl?element=103) | Explicit correction to `[Rn]5f14 7s2 7p1`, superseding PubChem's older 6d assignment. |

The generated data expose the physical period separately from detached periodic-table display coordinates. The detached f-block layout is a presentation convention, not a resolution of group-3 placement debates.

For an element with abundance data, the default A is the isotope with the largest listed abundance. If the NIST table lists isotopes without abundances, the first tabulated isotope is used without a claim of natural abundance or stability. If no isotope is listed, A is rounded from PubChem's mass and explicitly called **schematic / existence unverified**. A rounded standard atomic weight is not evidence of isotope existence.

Atomic masses have uncertainty annotations in the retained source; the numeric JSON uses central values. Nuclear mass is estimated by subtracting Z electron rest masses from the atomic mass, neglecting electronic binding mass. Hydrogen-1 uses the measured proton mass. Custom/unverified compositions use A u as an explicitly approximate nuclear mass.

The small multiply charged cation table is separate from general filling logic. [NIST ASD](https://physics.nist.gov/asd) is the configuration reference. In particular, see [Fe III evaluated levels](https://srd.nist.gov/JPCRD/jpcrd64.pdf) and [NIST's Nd IV analysis](https://www.nist.gov/publications/analysis-free-ion-nd3-spectrum-nd-iv). The currently bundled table is enumerated in `quantum_engine/electron_configuration.py`; all other charges beyond one-/two-electron cases and NIST's first-cation table report an unknown configuration. No generic ion-removal heuristic is presented as verified data.

Public scientific facts and government source snapshots are retained for traceability. Third-party references linked from those sources retain their own rights. Remote scripts in saved HTML are never executed; the rebuild script parses the files as text.

Source snapshots retain their upstream formatting verbatim. `.gitattributes` exempts only those snapshots from whitespace linting; generated data and application code remain checked normally.
