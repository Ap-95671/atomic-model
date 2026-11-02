# Atomic Explorer methodology

These details apply to the preserved atomic laboratory. Other laboratory models
are documented in [Scientific methods](SCIENTIFIC_METHODS.md).

## Scientific basis

Internal lengths are in Bohr radii a₀. The effective length is
`a = a₀ / (Z μ/mₑ)`, with μ the electron–nucleus reduced mass. The normalized
radial solution is

```text
ρ = 2r / (n a)
Rₙₗ(r) = (2/(n a))^(3/2) √[(n−l−1)! / (2n (n+l)!)]
          × exp(−ρ/2) ρˡ L^(2l+1)_(n−l−1)(ρ)
ψₙₗₘ(r,θ,φ) = Rₙₗ(r) Yₗᵐ(θ,φ)
```

For an infinitely heavy hydrogen nucleus,
`ψ₁₀₀ = exp(−r/a₀) / √(π a₀³)`. Ordinary hydrogen's reduced-mass correction
slightly changes this length and gives a nonrelativistic 1s energy near
−13.5983 eV. CODATA constants come from SciPy.

Spherical harmonics use SciPy's `sph_harm_y(l, m, theta, phi)` convention:
θ is polar angle, φ azimuth, including the Condon–Shortley phase. Real
harmonics use `√2 (−1)^|m| Re(Y_l^|m|)` for positive basis index and the
corresponding imaginary part for negative index. The m = 0 harmonic is real.
The common real pₓ, pᵧ, d, and f functions are **superpositions of ±mₗ**;
they are generally not L_z eigenstates. The interface labels m as a real-basis
index, or as definite mₗ when the complex basis is selected.

Real hydrogenic orbitals have `n−l−1` radial nodes, `l` angular nodes, and
`n−1` total nodes. Complex states need a more careful geometric interpretation:
there are `l−|m|` polar nodal cones and polar-axis zeros, rather than the
azimuthal nodal planes of a real combination. The interface explains this.

Clouds use inverse-CDF radial samples of `r² |R|² dr` and rejection-sampled
angular density with uniform cosθ and φ proposals. The spherical volume
factor is included. Samples represent outcomes from repeated measurements in
an identically prepared state, not known simultaneous electron positions.

Surfaces use scikit-image marching cubes on a vectorized wavefunction grid.
The grid is concentrated near the origin; vertices are mapped back to physical
coordinates after extraction. Positive and negative real amplitude surfaces
are extracted separately. Complex surfaces use |ψ| and color arg(ψ).
**Thresholds are fractions of the grid's peak amplitude**, not enclosed
probabilities. Angular nodes are extracted from the corresponding solid harmonic;
radial node radii come from associated Laguerre roots. The graph extends to
99.9% radial probability; cloud sampling retains the far tail.

### Exact, approximate, schematic

| Component | Interpretation |
| --- | --- |
| Hydrogenic ψ, nodes, Coulomb energy | Analytic within the nonrelativistic point-nucleus one-electron model; finite numerical evaluation and discretization |
| Reduced mass | Measured proton for H-1; otherwise nuclear mass estimated from atomic isotope mass minus electron masses, neglecting binding mass |
| Multi-electron shapes | Hydrogenic demonstrations with an explicit illustrative Z_eff; no self-consistent screening or electron correlation |
| Neutral configurations / selected ions | Bundled reference assignments; not predictions from a many-electron solver; unsupported charge states show unknown |
| Superheavy neutral assignments | Explicitly predicted/unverified; not experimentally established claims |
| Orbital box diagrams | Hund/Pauli occupancy conventions; not a resolved atomic term or measured orbital orientation |
| Multiple-orbital overlays | Separately normalized orbital distributions; no exact many-electron wavefunction claim |
| Nucleus | Enlarged schematic individual nucleons; positions are not a nuclear many-body calculation |
| Legacy Bohr view | Educational circular-orbit comparison only |

The Atomic Explorer omits relativity, spin–orbit/fine/hyperfine structure, Lamb shifts, finite nuclear size, external fields and time-dependent superpositions. Separate laboratories implement the explicitly labeled models described in SCIENTIFIC_METHODS.md. High-Z
one-electron ions especially require relativistic corrections for accuracy.
Spin changes the displayed quantum state label/occupancy, not the spatial
hydrogenic density in this spin-independent Hamiltonian.

