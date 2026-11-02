"""Small closed-shell geometry optimization and analytic harmonic normal modes."""
from dataclasses import dataclass
import math
import time
import numpy as np
from scipy.optimize import minimize
from .models import ChemistryRequest
from .scf import build_method, solve, BOHR_ANGSTROM, Progress


@dataclass(frozen=True)
class GeometryOptions:
    max_steps: int = 40
    gradient_tolerance: float = 1e-5

    @classmethod
    def parse(cls, data):
        if not isinstance(data, dict) or set(data)-{'max_steps', 'gradient_tolerance'}:
            raise ValueError('Geometry options: max_steps, gradient_tolerance only')
        value = cls(**data)
        if type(value.max_steps) is not int or not 1 <= value.max_steps <= 60:
            raise ValueError('Geometry max_steps must be 1…60')
        if type(value.gradient_tolerance) not in (int, float) or not math.isfinite(value.gradient_tolerance) or not 1e-6 <= value.gradient_tolerance <= 1e-4:
            raise ValueError('Geometry gradient_tolerance must be 1e-6…1e-4 Eh/a0')
        return value


def validate(request):
    request.validate()
    if request.spin or request.method not in ('hf', 'rhf', 'pbe', 'b3lyp'):
        raise ValueError('Geometry and vibrations currently support closed-shell RHF/RKS only')
    mol, method, _ = build_method(request)
    if not 2 <= mol.natm <= 5 or mol.nao_nr() > 50:
        raise ValueError('Geometry and vibrations support 2…5 atoms and at most 50 basis functions')
    return mol, method


def internal_coordinates(centers, atomic_numbers):
    """Distance-based display connectivity; does not infer chemical bond order."""
    # Covalent radii Å, Cordero et al. 2008 values for the supported elements.
    radii = {1:.31, 2:.28, 3:1.28, 5:.84, 6:.76, 7:.71, 8:.66, 9:.57, 10:.58}
    xyz = np.asarray(centers)*BOHR_ANGSTROM
    bonds = []
    for a in range(len(xyz)):
        for b in range(a):
            length = float(np.linalg.norm(xyz[a]-xyz[b]))
            if length < 1.3*(radii[int(atomic_numbers[a])]+radii[int(atomic_numbers[b])]):
                bonds.append({'a':b, 'b':a, 'order':1, 'length_angstrom':length})
    angles = []
    for center in range(len(xyz)):
        neighbors = [b['b'] if b['a'] == center else b['a'] for b in bonds if center in (b['a'], b['b'])]
        for i, a in enumerate(neighbors):
            for b in neighbors[:i]:
                u, v = xyz[a]-xyz[center], xyz[b]-xyz[center]
                angle = np.degrees(np.arccos(np.clip(u@v/np.linalg.norm(u)/np.linalg.norm(v), -1, 1)))
                angles.append({'a':b, 'center':center, 'b':a, 'degrees':float(angle)})
    return bonds, angles


def optimize(request: ChemistryRequest, options: GeometryOptions, progress: Progress = lambda _: None, vibrations=False):
    started = time.perf_counter()
    mol, method = validate(request)
    initial = mol.atom_coords()
    scanner = method.nuc_grad_method().as_scanner()
    history, evaluations = [], 0
    cached = None

    def evaluate(vector):
        nonlocal cached, evaluations
        xyz = np.asarray(vector).reshape(initial.shape)
        if cached is not None and np.array_equal(xyz, cached[0]):
            return cached[1], cached[2].ravel()
        separations = np.linalg.norm(xyz[:, None]-xyz[None, :], axis=-1)+np.eye(len(xyz))*100
        if not np.all(np.isfinite(xyz)) or np.max(abs(xyz)) > 30 or separations.min() < .4:
            raise ValueError('Optimization left the bounded coordinate domain or approached coincident nuclei')
        energy, gradient = scanner(xyz)
        energy, gradient = float(energy), np.asarray(gradient)
        if not scanner.base.converged or not np.isfinite(energy) or not np.all(np.isfinite(gradient)):
            raise ValueError('SCF/gradient evaluation failed during optimization; no optimized result returned')
        cached = xyz.copy(), energy, gradient.copy()
        evaluations += 1
        progress({'stage':'Geometry gradient evaluation', 'evaluation':evaluations, 'total_energy_hartree':energy,
                  'gradient_max':float(np.max(abs(gradient)))})
        return energy, gradient.ravel()

    def record(vector):
        energy, gradient = evaluate(vector)
        history.append({'iteration':len(history), 'centers_a0':np.asarray(vector).reshape(initial.shape).copy(),
                        'total_energy_hartree':energy, 'gradient_max':float(np.max(abs(gradient))),
                        'gradient_rms':float(np.sqrt(np.mean(gradient**2)))})
        progress({'stage':'Geometry optimization', **{k:v for k,v in history[-1].items() if k != 'centers_a0'}})

    record(initial.ravel())
    fitted = minimize(evaluate, initial.ravel(), jac=True, method='BFGS', callback=record,
                      options={'gtol':options.gradient_tolerance, 'maxiter':options.max_steps})
    energy, gradient = evaluate(fitted.x)
    if not np.array_equal(history[-1]['centers_a0'].ravel(), fitted.x):
        record(fitted.x)
    gradient_max = float(np.max(abs(gradient)))
    if not fitted.success or gradient_max > options.gradient_tolerance:
        raise ValueError(f'Geometry optimization did not converge: {fitted.message}; maximum gradient {gradient_max:.3g} Eh/a0. No optimized state returned.')
    centers = fitted.x.reshape(initial.shape)
    result, solution = solve(request, progress, coordinates=centers)
    bonds, angles = internal_coordinates(centers, result['atomic_numbers'])
    result['geometry_note'] = 'Optimized local stationary geometry on the selected RHF/RKS potential surface; not proof of a global minimum.'
    result['optimization'] = {'optimizer':'SciPy BFGS / PySCF analytic nuclear gradients', 'converged':True,
                              'gradient_tolerance':options.gradient_tolerance, 'gradient_max':gradient_max,
                              'gradient_rms':float(np.sqrt(np.mean(gradient**2))), 'evaluations':evaluations,
                              'steps':int(fitted.nit), 'history':history, 'initial_centers_a0':initial,
                              'energy_lowering_hartree':history[0]['total_energy_hartree']-energy,
                              'final_bonds':bonds, 'final_angles':angles,
                              'connectivity_note':'Display bonds inferred from covalent radii; no calculated bond orders.'}
    result['assumptions'] += ' Geometry uses analytic gradients and local BFGS minimization; finite basis and functional errors remain. Molecular imports and open-shell geometry optimization are not supported in this workflow.'
    if vibrations:
        progress({'stage':'Analytic Hessian and normal-mode analysis'})
        # Rebuild at final geometry; never reuse the initial-geometry Hessian.
        final_mol, final_method, _ = build_method(request, centers)
        final_method.kernel()
        if not final_method.converged:
            raise ValueError('Final Hessian reference SCF failed')
        hessian = np.asarray(final_method.Hessian().kernel())
        matrix = hessian.transpose(0, 2, 1, 3).reshape(3*mol.natm, 3*mol.natm)
        symmetry_error = float(np.max(abs(matrix-matrix.T)))
        if symmetry_error > 1e-6 or not np.all(np.isfinite(matrix)):
            raise ValueError('Hessian symmetry/finiteness check failed')
        from pyscf.hessian.thermo import harmonic_analysis
        masses = final_mol.atom_mass_list(isotope_avg=True)
        analysis = harmonic_analysis(final_mol, hessian, imaginary_freq=False, mass=masses)
        frequencies, modes = analysis['freq_wavenumber'], analysis['norm_mode']
        linear = np.linalg.matrix_rank(centers-centers.mean(axis=0), tol=1e-6) <= 1
        expected = 3*mol.natm-(5 if linear else 6)
        if len(frequencies) != expected:
            raise ValueError('Normal-mode count inconsistent with molecular geometry')
        metric = np.einsum('a,iaj,kaj->ik', masses, modes, modes)
        orthogonality_error = float(np.max(abs(metric-np.eye(expected))))
        if orthogonality_error > 1e-7:
            raise ValueError('Mass-weighted mode normalization check failed')
        result['vibrations'] = {'method':'Analytic RHF/RKS Hessian / rigid translation and rotation projected out',
                                'frequencies_cm1':frequencies, 'modes':modes, 'reduced_masses_amu':analysis['reduced_mass'],
                                'force_constants_au':analysis['force_const_au'], 'atomic_masses_amu':masses,
                                'hessian_hartree_per_a0_squared':hessian, 'hessian_symmetry_error':symmetry_error,
                                'mode_orthogonality_error':orthogonality_error, 'linear':linear,
                                'imaginary_mode_count':int(np.count_nonzero(frequencies < -1)),
                                'stationary_point':'local minimum within harmonic numerical resolution' if np.all(frequencies >= -1) else 'unstable stationary point; imaginary mode(s)',
                                'intensities_note':'IR and Raman intensities unavailable: dipole and polarizability derivatives are not implemented. Chart shows frequency positions only.',
                                'reference':{'system':'h2', 'equilibrium_distance_angstrom':.74144, 'harmonic_cm1':4401.21, 'fundamental_cm1':4161.166,
                                             'source':'NIST Chemistry WebBook, H2 diatomic constants', 'url':'https://webbook.nist.gov/cgi/cbook.cgi?ID=C1333740&Mask=1000'} if request.system == 'h2' else None,
                                'assumptions':'Unscaled Born–Oppenheimer harmonic frequencies with average atomic masses; isotope selection is not implemented here. Negative frequencies denote imaginary modes and an instability, not absorption below zero frequency. Finite-basis harmonic calculations differ from measured anharmonic fundamentals. Visual displacements have arbitrary magnification and playback speed.'}
    result['wall_seconds'] = time.perf_counter()-started
    solution['result'] = result
    return result, solution
