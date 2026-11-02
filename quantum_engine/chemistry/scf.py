"""Optional spin-aware PySCF calculations with independently checked invariants."""
import math
import time
from typing import Callable
import numpy as np
from scipy.constants import physical_constants
from .models import ChemistryRequest, DIATOMICS

Progress = Callable[[dict], None]
BOHR_ANGSTROM = physical_constants["Bohr radius"][0]*1e10


def geometry(request: ChemistryRequest) -> tuple[list[int], np.ndarray, int, dict | None]:
    if request.system in DIATOMICS:
        _, zs, charge, _ = DIATOMICS[request.system]
        return list(zs), np.array([[-request.distance/2, 0., 0.], [request.distance/2, 0., 0.]]), charge, None
    if request.system == "he":
        return [2], np.zeros((1, 3)), 0, None
    from quantum_engine.molecular.structures import structure
    source = structure(request.system)
    centers = source["coordinates_angstrom"]/BOHR_ANGSTROM
    return source["atomic_numbers"], centers-centers.mean(axis=0), 0, source


def build_method(request: ChemistryRequest, coordinates: np.ndarray | None = None):
    # Intentionally lazy: importing the core engine never imports PySCF.
    from pyscf import dft, gto, scf
    zs, centers, charge, source = geometry(request)
    if coordinates is not None:
        centers = np.asarray(coordinates, dtype=float)
        if centers.shape != (len(zs), 3) or not np.all(np.isfinite(centers)) or np.max(abs(centers)) > 30:
            raise ValueError("Invalid trusted calculation coordinates")
    mol = gto.M(atom=[(z, tuple(v)) for z, v in zip(zs, centers)], unit="Bohr",
                basis=request.basis, charge=charge, spin=request.spin, verbose=0, max_memory=384)
    if mol.nao_nr() > 160:
        raise ValueError("This local workflow supports at most 160 spatial basis functions")
    if request.method in ("pbe", "b3lyp"):
        method = dft.UKS(mol) if request.spin else dft.RKS(mol)
        method.xc = request.method
        method.grids.level = request.grid_level
    elif request.method == "uhf" or (request.method == "hf" and request.spin):
        method = scf.UHF(mol)
    elif request.method == "rohf":
        method = scf.ROHF(mol)
    else:
        method = scf.RHF(mol)
    method.chkfile = None
    temporary = getattr(method, "_chkfile", None)
    if temporary is not None:
        temporary.close()
        method._chkfile = None
    method.max_cycle = request.max_cycles
    method.conv_tol = 1e-10
    method.conv_tol_grad = 1e-6
    method.diis = request.diis
    method.diis_space = 8
    method.init_guess = request.guess if request.guess != "broken-symmetry" else "minao"
    return mol, method, source


def solve(request: ChemistryRequest, progress: Progress = lambda _: None, coordinates: np.ndarray | None = None) -> tuple[dict, dict]:
    request.validate()
    started = time.perf_counter()
    progress({"stage": "Building basis and integrals"})
    mol, method, source = build_method(request, coordinates)
    history = []

    def callback(env):
        entry = {"iteration": int(env.get("cycle", len(history)))+1,
                 "total_energy_hartree": float(env["e_tot"])}
        for key, name in (("norm_ddm", "density_change"), ("norm_gorb", "orbital_gradient")):
            if key in env and np.isfinite(env[key]):
                entry[name] = float(env[key])
        history.append(entry)
        progress({"stage": "SCF iterations", **entry})

    method.callback = callback
    dm0 = None
    if request.guess == "broken-symmetry":
        overlap = mol.intor("int1e_ovlp")
        a = np.zeros(mol.nao_nr()); b = a.copy()
        a[0] = 1.; b[mol.aoslice_by_atom()[1, 2]] = 1.
        dm0 = np.array([np.outer(a, a)/(a@overlap@a), np.outer(b, b)/(b@overlap@b)])
    energy = float(method.kernel(dm0=dm0))
    if not method.converged or not math.isfinite(energy):
        raise ValueError(f"SCF did not converge in {request.max_cycles} cycles; no converged result returned")
    if not history:
        history.append({"iteration": 0, "total_energy_hartree": energy})
    overlap = mol.intor("int1e_ovlp")
    raw_density = np.asarray(method.make_rdm1())
    unrestricted = raw_density.ndim == 3
    spin_dm = raw_density if unrestricted else np.array([raw_density/2, raw_density/2])
    total_density = spin_dm.sum(axis=0)
    coeff = np.asarray(method.mo_coeff)
    energies = np.asarray(method.mo_energy)
    occupations = np.asarray(method.mo_occ)
    if coeff.ndim == 2:
        # ROHF has a common spatial basis and spin-dependent occupations.
        coeff = np.array([coeff, coeff])
        energies = np.array([energies, energies])
        occupations = np.array([(occupations > 0).astype(float), (occupations > 1).astype(float)])
    counts = [float(np.trace(d@overlap)) for d in spin_dm]
    if max(abs(counts[0]-mol.nelec[0]), abs(counts[1]-mol.nelec[1])) > 1e-7:
        raise ValueError("SCF spin-resolved electron-count check failed")
    ortho = max(float(np.max(abs(c.T@overlap@c-np.eye(mol.nao_nr())))) for c in coeff)
    if ortho > 1e-7:
        raise ValueError("SCF orbital S-orthonormality check failed")
    density_purity_error = max(float(np.max(abs(d@overlap@d-d))) for d in spin_dm)
    kinetic = float(np.einsum("ij,ji", total_density, mol.intor("int1e_kin")))
    attraction = float(np.einsum("ij,ji", total_density, mol.intor("int1e_nuc")))
    components = {"kinetic": kinetic, "electron_nuclear": attraction, "nuclear_repulsion": float(mol.energy_nuc())}
    if request.method in ("pbe", "b3lyp"):
        vxc = method.get_veff(mol, raw_density)
        components.update(coulomb=float(vxc.ecoul), exchange_correlation=float(vxc.exc))
    else:
        if unrestricted:
            j, k = method.get_jk(mol, raw_density)
            components["coulomb"] = float(.5*np.einsum("ij,ji", total_density, j.sum(axis=0)))
            components["exchange"] = float(-.5*np.einsum("sij,sji", spin_dm, k))
        else:
            j, k = method.get_jk(mol, raw_density)
            components["coulomb"] = float(.5*np.einsum("ij,ji", total_density, j))
            components["exchange"] = float(-.25*np.einsum("ij,ji", total_density, k))
    decomposition_error = abs(sum(components.values())-energy)
    if decomposition_error > 1e-6:
        raise ValueError("SCF energy decomposition failed its numerical check")
    channels = []
    for name, c, values, occ in zip(("alpha", "beta"), coeff, energies, occupations):
        used = np.flatnonzero(occ > .5)
        unused = np.flatnonzero(occ < .5)
        channels.append({"name": name, "energies_hartree": values, "occupations": occ,
                         "homo": int(used[-1]) if len(used) else None,
                         "lumo": int(unused[0]) if len(unused) else None,
                         "gap_hartree": float(values[unused[0]]-values[used[-1]]) if len(used) and len(unused) else None})
    s2, multiplicity = method.spin_square()
    from pyscf import __version__
    result = {"model": f"PySCF {__version__} / {type(method).__name__} / {request.basis}",
              "request": request.to_dict(), "converged": True, "total_energy_hartree": energy,
              "energy_components_hartree": components, "energy_decomposition_error": decomposition_error,
              "basis_size": mol.nao_nr(), "electron_count": sum(counts), "spin_electron_counts": counts,
              "spin_squared": float(s2), "spin_squared_target": request.spin/2*(request.spin/2+1),
              "spin_contamination": float(s2-request.spin/2*(request.spin/2+1)),
              "spin_multiplicity_from_s2": float(multiplicity), "channels": channels,
              "orthonormality_error": ortho, "spin_density_idempotency_error": density_purity_error,
              "scf_history": history, "wall_seconds": time.perf_counter()-started,
              "centers_a0": mol.atom_coords(), "atomic_numbers": mol.atom_charges(), "source_geometry": source,
              "geometry_note": "User-controlled fixed separation; not an optimized equilibrium geometry." if request.system in DIATOMICS else "Fixed source conformer; not optimized here.",
              "units": {"energy": "Hartree", "length": "a0", "density": "electrons/a0^3", "spin_squared": "hbar^2"},
              "assumptions": "Spin-aware HF/KS-DFT at fixed point nuclei. UHF/UKS can be spin contaminated and are not exact correlated solutions. Selected spin is an input state, not proof of a global ground state. Finite orbital/DFT grids require convergence checks. Orbital energies are not excitation energies. Source conformers and user-set separations are not geometry optimizations."}
    solution = {"request": request.to_dict(), "centers_a0": mol.atom_coords(), "coefficients": coeff, "spin_density_matrices": spin_dm,
                "result": result}
    return result, solution


def field(solution: dict, request: ChemistryRequest, progress: Progress = lambda _: None) -> dict:
    """Evaluate a selected calculated MO/density without repeating SCF."""
    from skimage.measure import marching_cubes
    # Geometry/method comes from the stored solution, never from a field-edit request.
    original = ChemistryRequest.parse(solution["request"])
    mol, _, _ = build_method(original, solution.get("centers_a0"))
    channel = 0 if request.channel == "alpha" else 1
    result = solution["result"]
    index = request.orbital
    if index == -1:
        index = result["channels"][channel]["homo"]
    if request.view == "orbital" and (index is None or not 0 <= index < mol.nao_nr()):
        raise ValueError("No selected orbital exists in this spin channel/basis")
    coeff = np.asarray(solution["coefficients"])
    dm = np.asarray(solution["spin_density_matrices"])
    extent = float(np.max(abs(mol.atom_coords()))+6)
    size = {"preview": 41, "balanced": 65, "high": 97}[request.quality]
    axis = np.linspace(-extent, extent, size)
    points = np.stack(np.meshgrid(axis, axis, axis, indexing="ij"), axis=-1).reshape(-1, 3)
    values = np.empty(len(points))
    progress({"stage": "Evaluating calculated orbital field", "grid_size": size})
    matrix = dm.sum(axis=0) if request.view == "density" else dm[0]-dm[1]
    for begin in range(0, len(points), 8192):
        ao = mol.eval_gto("GTOval_sph", points[begin:begin+8192])
        values[begin:begin+len(ao)] = ao@coeff[channel, :, index] if request.view == "orbital" else np.einsum("pi,ij,pj->p", ao, matrix, ao)
    values = values.reshape((size,)*3)
    peak = float(np.max(abs(values)))
    surfaces = []
    if peak > 1e-14:
        for sign in (1, -1):
            if (values*sign).max() <= request.threshold*peak:
                continue
            vertices, faces, _, _ = marching_cubes(values*sign, request.threshold*peak, spacing=(axis[1]-axis[0],)*3)
            vertices -= extent
            surfaces.append({"vertices": vertices, "faces": faces,
                             "phases": np.full(len(vertices), 0 if sign == 1 else np.pi)})
    integral = float(np.trapezoid(np.trapezoid(np.trapezoid(values, axis, axis=2), axis, axis=1), axis)) if request.view != "orbital" else None
    return {"extent": extent, "centers_a0": mol.atom_coords(), "points": [], "phases": [],
            "surfaces": surfaces, "field_kind": request.view, "channel": request.channel,
            "orbital_index": int(index) if index is not None else None, "grid_size": size,
            "peak": peak, "threshold": request.threshold, "finite_grid_integral": integral,
            "surface_note": "Threshold is a fraction of sampled field peak, not enclosed probability. Density integrals on the display grid can under-resolve tight cores; exact basis-space counts are reported separately. Spin-density sign represents alpha-minus-beta density, not wavefunction phase."}
