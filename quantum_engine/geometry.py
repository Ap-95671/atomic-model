"""Bounded, cached scientific geometry. All extraction occurs off the UI thread."""
from functools import lru_cache
import numpy as np
from skimage.measure import marching_cubes
from quantum_engine import QuantumState, wavefunction
from quantum_engine.probability import sample_positions, radial_cdf
from quantum_engine.radial_wavefunctions import radial_probability, radial_nodes, normalization
from quantum_engine.angular_wavefunctions import angular
from quantum_engine.constants import length_scale, BOHR_RADIUS

QUALITY = {"preview": (5000, 49), "balanced": (18000, 73), "high": (45000, 105)}


def rounded(array, precision=5):
    # Keep cache entries as compact arrays. Python lists are materialized only
    # at the HTTP serialization boundary, not retained for every cached state.
    return np.round(np.asarray(array, dtype=np.float64), precision)


def extract(field, level, extent, mask=None, axis=None):
    if not float(np.min(field)) < level < float(np.max(field)):
        return None
    verts, faces, _, _ = marching_cubes(np.asarray(field, dtype=np.float32), level,
        allow_degenerate=False, mask=mask)
    if axis is None:
        verts = verts * (2*extent/(field.shape[0]-1)) - extent
    else:
        verts = np.column_stack([np.interp(verts[:, i], np.arange(len(axis)), axis) for i in range(3)])
    return verts, faces


@lru_cache(maxsize=16)
def orbital_geometry(n, l, m, basis, mode, quality, point_count, threshold, show_nodes):
    """Geometry in natural hydrogenic units a_eff, reusable across isotopes/Z."""
    state = QuantumState(n, l, m, basis=basis)
    if not 1 <= n <= 8 or l > 3:
        raise ValueError("Viewer supports n=1…8 and s/p/d/f")
    if quality not in QUALITY or mode not in ("cloud", "surface"):
        raise ValueError("Unknown quality or rendering mode")
    if not 0.005 <= threshold <= 0.4:
        raise ValueError("Amplitude threshold must be 0.005…0.4 of peak |ψ|")
    default_count, grid_size = QUALITY[quality]
    point_count = point_count or default_count
    if not 1000 <= point_count <= 60000:
        raise ValueError("Point count must be 1000…60000")
    radii, cdf = radial_cdf(n, l)
    extent = float(np.interp(0.999, cdf, radii))
    result = {"extent": extent, "surfaces": [], "node_mesh": None,
              "radial_nodes": rounded(radial_nodes(n, l)), "points": [], "phases": []}
    if mode == "cloud":
        xyz = sample_positions(state, point_count)
        phase = np.angle(wavefunction(state, xyz))
        result.update(points=rounded(xyz), phases=rounded(phase), count=point_count)
    if mode == "surface" or (show_nodes and l > 0 and basis == "real"):
        coordinate = np.linspace(-1, 1, grid_size)
        # Concentrate samples near the nuclear cusp and inner radial nodes.
        # Extract in grid-index space, then map vertices to physical coordinates.
        axis = np.sign(coordinate) * np.abs(coordinate)**1.5 * extent
        x, y, z = np.meshgrid(axis, axis, axis, indexing="ij")
        xyz = np.stack((x, y, z), axis=-1)
        values = wavefunction(state, xyz)
        if mode == "surface":
            peak = float(np.max(np.abs(values)))
            for sign in ((1, -1) if basis == "real" else (1,)):
                field = sign*values if basis == "real" else np.abs(values)
                mesh = extract(field.real, peak*threshold, extent, axis=axis)
                if mesh is not None:
                    vertices, faces = mesh
                    result["surfaces"].append({"vertices": rounded(vertices), "faces": faces.astype(np.int32, copy=False),
                        "phases": rounded(np.angle(wavefunction(state, vertices))), "sign": sign})
            result["grid_size"] = grid_size
            result["amplitude_level"] = peak*threshold
        if show_nodes and l > 0 and basis == "real":
            r = np.linalg.norm(xyz, axis=-1)
            theta = np.arccos(np.divide(z, r, out=np.zeros_like(r), where=r > 0))
            phi = np.mod(np.arctan2(y, x), 2*np.pi)
            solid_harmonic = angular(l, m, theta, phi) * r**l
            mesh = extract(solid_harmonic, 0, extent, mask=(r < extent*0.88), axis=axis)
            if mesh is not None:
                vertices, faces = mesh
                result["node_mesh"] = {"vertices": rounded(vertices), "faces": faces.astype(np.int32, copy=False)}
    return result


def orbital_payload(state, atom, mode="cloud", quality="balanced", point_count=0, threshold=0.06, show_nodes=False, effective_z=1.0):
    z = float(atom["z"]) if atom["one_electron"] else effective_z
    if not np.isfinite(z) or not 0.1 <= z <= 118:
        raise ValueError("Effective Coulomb charge must be 0.1…118")
    scale = length_scale(z, atom["nuclear_mass_u"])
    geom = orbital_geometry(state.n, state.l, state.m, state.basis, mode, quality, point_count, threshold, show_nodes)
    extent = geom["extent"]*scale
    r = np.linspace(0, extent, 400)
    p = radial_probability(state.n, state.l, r, z, atom["nuclear_mass_u"])
    theta = np.linspace(0, np.pi, 181)
    ang = np.abs(angular(state.l, state.m, theta, np.pi/4, state.basis))**2
    from quantum_engine.energy_levels import energy_ev
    return {**geom, "length_scale_a0": scale, "extent_a0": extent,
        "extent_nm": extent*BOHR_RADIUS*1e9, "label": state.label, "nodes": state.nodes,
        "radial": {"r": rounded(r), "p": rounded(p, 8)},
        "angular": {"theta": rounded(theta), "probability": rounded(ang, 8)},
        "normalization": normalization(state.n, state.l),
        "coulomb_charge": z, "energy_ev": energy_ev(state.n, z, atom["nuclear_mass_u"]) if atom["one_electron"] else None,
        "model": "Analytic nonrelativistic one-electron Coulomb model with reduced mass" if atom["one_electron"] else
            "Hydrogenic orbital demonstration with user-selected Z_eff; not a self-consistent many-electron solution",
        "basis_note": "Real tesseral basis: m is a basis index; m≠0 combines ±|mₗ| and has no definite L_z." if state.basis == "real" else
            "Complex Y_l^m: definite mₗ. Color represents arg(ψ), not positive/negative probability.",
        "surface_note": "Isosurfaces of |ψ| at a fraction of its grid peak; ± phases separated for real states. Not a fixed enclosed probability. Small lobes can disappear at high thresholds."}
