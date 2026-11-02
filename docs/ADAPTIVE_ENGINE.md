# Adaptive accuracy-aware engine · transparent baseline

`research_engine.recommend` is an independent evidence lookup, exposed through
the SDK's accompanying package and the Computational Chemistry UI. It chooses
the candidate with the lowest **measured median solver latency** among converged
HF/MP2/CCSD records meeting an observed finite-basis FCI error threshold and a
measured runtime budget. This transparent constrained selection is not arbitrary
rules disguised as intelligence, a learned router or a new research result.

Scope: exact system, basis, geometry, spin and total-energy matching. A new
molecule/geometry/property or no feasible candidate produces explicit abstention.
Reported timing is evidence from this Mac, not a hard or portable runtime bound.
FCI is a reference in the **same finite basis**, not exact physical energy or
experiment. The policy does not promise a complete-basis chemical accuracy.

```python
from research_engine import recommend
print(recommend(system="h2", basis="sto-3g", distance=1.4,
                tolerance_hartree=.01, budget_seconds=1.))
# Outside matching evidence, including held-out water: abstain.
```

## Reproducible experiments and leakage boundaries

```sh
.venv/bin/python scripts/benchmark_adaptive.py --repeats 3
```

Artifact: `research_engine/data/baseline.json`, generated locally using PySCF
2.14.0, pinned environment versions and source-preserved geometries. Three
repetitions per method record energy, reference error, wall/CPU timings and
convergence; electron count, basis size, RHF gap and spin provide difficulty
context. `scripts/benchmark3.py` separately records isolated peak RSS. No
external training dataset or uncertain license is used.

All H2 geometries stay in the training molecule group. He is calibration;
LiH/water are held-out evaluation molecules and **never route decisions**. The
baseline abstains on those unseen molecules. There is no hidden transfer of
reference errors from evaluation into method choice. A lookup on known records
uses their reference errors, so its in-domain choice is an evidence oracle,
not an estimate of generalization or a novel adaptive solver.

Representative absolute errors vs same-basis FCI, Eh:

| Case | Split | HF | MP2 | CCSD |
| --- | --- | ---: | ---: | ---: |
| H2/STO-3G, 1.4 a0 | training | .020562 | .007404 | <1e-8 |
| H2/STO-3G, 3 a0 | training | .099882 | .048298 | <1e-8 |
| H2/STO-3G, 6 a0 | training | .288325 | .035321 | <1e-8 |
| He/6-31G | calibration | .015002 | .003802 | <1e-8 |
| LiH/STO-3G, 3 a0 | held out | .020258 | .007451 | .000010 |
| Water/STO-3G source conformer | held out | .051083 | .014532 | .000121 |

At .01 Eh tolerance, fixed HF/MP2/CCSD succeed in 0/3/6 of these six deliberately
small cases. A latency-only ablation succeeds in 0/6. These tiny hand-selected
finite-basis results do not establish CCSD superiority, general chemical
accuracy, robustness on strongly correlated molecules or a learned-policy gain.
H2/He have only two electrons; exact CCSD agreement there is a limiting case,
not evidence for universal accuracy. Actual timings and all repetitions are in
the artifact; avoid fitting interpretation to noisy millisecond differences.

Failure analysis: missing calibration, unsupported property/spin, insufficient
budget and requested accuracy beyond observed candidates all cause abstention.
Closing orbital gaps and stretching motivate warnings; no one diagnostic is
an accuracy certificate. The current single-reference benchmark excludes many
challenging cases and deliberately makes no confidence intervals.

Remaining research: broader licensed/provenance-reviewed datasets, multiple
bases and properties, systematic strongly correlated/failure cases, independent
molecule/scaffold splits, generalizable cost/error prediction, held-out selection
regret and uncertainty calibration, realistic ablations, reproducible plots and
multiple-hardware validation. No ML routing, statistical calibration, publication
readiness, research novelty or superior-accuracy claim is made.
