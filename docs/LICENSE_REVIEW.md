# Project, dependency and data license review

No project LICENSE existed at the checked starting point. **No license has
been selected or added. Owner approval is required before a licensing decision.**
The SDK metadata intentionally omits a license expression. Local wheels are
validation artifacts; nothing has been published to PyPI or tagged as a stable
open-source release. This inventory is not a substitute for owner/legal review.

Installed package metadata inspected during this milestone:

| Dependency / installed version | Declared license information |
| --- | --- |
| NumPy 2.5.4 | BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0 |
| SciPy 1.18.1 | BSD-style project license plus bundled component notices |
| scikit-image 0.26.0 | BSD-3-Clause project, per-file/component notices |
| PySCF 2.14.0 (optional) | Apache-2.0 |
| h5py 3.16.0 (optional) | BSD-3-Clause; bundled/native HDF5 notices also matter |
| Pygame 2.6.1 (legacy optional) | LGPL metadata; review exact bundled notice |
| Three.js 0.181.2 | MIT |
| Vite 7.3.7 | MIT |
| TypeScript 5.9.3 | Apache-2.0 |
| Playwright 1.64.1 (development) | Apache-2.0 |
| axe-core/playwright 4.14.0 (development) | MPL-2.0 |
| setuptools 84.2.1 (build) | MIT |

Dependencies are installed as distributions, not vendored source. Preserve their
own notices in any redistribution; the production frontend bundles dependencies,
so a future distributable release needs a full transitive notice inventory
(including native BLAS/LAPACK/HDF5 artifacts), not only this top-level table.
No dependency license grants the owner a project-wide license automatically.

Reference data provenance remains in `data/SOURCES.md`. Packaged snapshots are
byte-identical copies; no license is invented for third-party data. NIST/PubChem
pages retain their own provenance/terms; source structures and calculated vs
experimental values remain distinguished. Newly generated benchmark numbers
are local finite-basis calculations, not an externally licensed training dataset.

Pending owner decision: approve a project license, then add its exact text,
metadata and applicable notices before public distribution. No option has been
silently chosen and no approval is implied by the implementation task.
