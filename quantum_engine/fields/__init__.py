"""Weak-field hydrogenic experiments and spin/fine-structure calculations."""
import math
import numpy as np
from scipy.constants import alpha,physical_constants,e
from quantum_engine.radial_wavefunctions import radial
from quantum_engine.angular_wavefunctions import angular

HARTREE_EV=physical_constants['Hartree energy in eV'][0]
MU_B_EV=physical_constants['Bohr magneton in eV/T'][0]
FIELD_AU=physical_constants['atomic unit of electric field'][0]


def field_experiment(magnetic_tesla=.01,electric_au=0.,l=1,j=1.5):
    if not math.isfinite(magnetic_tesla) or not 0<=magnetic_tesla<=.05:raise ValueError('Weak-field B must be 0…0.05 T')
    if not math.isfinite(electric_au) or not abs(electric_au)<=1e-5:raise ValueError('Electric field must be within ±1e-5 atomic units')
    if type(l) is not int or l not in (0,1):raise ValueError('For n=2 choose l=0 or 1')
    if j not in ({.5} if l==0 else {.5,1.5}):raise ValueError('Require j=l±1/2 (j=1/2 for l=0)')
    # Weak magnetic coupling relative to fine structure for this n=2 H example.
    magnetic_note='First-order weak-field Landé coupling; B≤0.05 T, μB B less than 7% of n=2 fine splitting. Hyperfine and higher-order magnetic mixing are omitted.'
    g=1+(j*(j+1)+.75-l*(l+1))/(2*j*(j+1))
    mj=np.arange(-j,j+1,1)
    # Electric-field perturbation restricted to the exactly degenerate n=2 space.
    # <2s|z|2p_z> = -3 a0; zero-field eigenvectors arbitrary, use basis identity.
    perturb=np.array([[0.,-3*electric_au],[-3*electric_au,0.]])
    shifts,mixing=np.linalg.eigh(perturb) if electric_au else (np.zeros(2),np.eye(2))
    z=np.linspace(-18,18,401)
    r=abs(z);theta=np.where(z>=0,0.,np.pi)
    s=radial(2,0,r)*angular(0,0,theta,np.zeros_like(z),'real')
    p=radial(2,1,r)*angular(1,0,theta,np.zeros_like(z),'real')
    amplitudes=np.stack([s,p],axis=-1)@mixing
    # Dirac Coulomb energies for n=2, infinite nuclear mass, point nucleus.
    rest_ev=physical_constants['electron mass energy equivalent in MeV'][0]*1e6
    def dirac(jj):
        denom=2-jj-.5+math.sqrt((jj+.5)**2-alpha**2)
        return rest_ev*math.expm1(-.5*math.log1p((alpha/denom)**2))
    fine=[{'j':jj,'energy_ev':dirac(jj)} for jj in (.5,1.5)]
    return {'model':'Separate weak-field n=2 hydrogen perturbations; infinite nuclear mass',
        'units':{'energy':'eV','magnetic_field':'tesla','electric_field':'atomic field','length':'a0','slice_density':'a0^-3'},
        'magnetic_tesla':magnetic_tesla,'electric_au':electric_au,'electric_v_per_m':electric_au*FIELD_AU,
        'l':l,'s':.5,'j':j,'orbital_L_squared_hbar2':l*(l+1),'spin_S_squared_hbar2':.75,'total_J_squared_hbar2':j*(j+1),
        'lande_g':g,'mj':mj,'lande_shifts_ev':g*mj*MU_B_EV*magnetic_tesla,
        'orbital_m':np.arange(-l,l+1),'orbital_only_shifts_ev':np.arange(-l,l+1)*MU_B_EV*magnetic_tesla,
        'magnetic_note':magnetic_note,'stark_shifts_ev':shifts*HARTREE_EV,'stark_matrix_hartree':perturb,
        'mixing_coefficients_2s_2pz':mixing,'z_a0':z,'mixed_density_z_axis_a0_minus3':(amplitudes**2).T,
        'unmixed_density_z_axis_a0_minus3':np.stack([s*s,p*p]),'fine_structure':fine,
        'fine_splitting_ev':fine[1]['energy_ev']-fine[0]['energy_ev'],
        'assumptions':'These are separate experiments, not a combined Stark+Zeeman Hamiltonian. Stark: first-order degenerate perturbation for n=2 hydrogen, 2s/2p_z mixing; m=±1 2p states have zero first-order shift. Field small relative to inter-shell gaps; ionization and higher-order shifts excluded. The plotted |ψ(0,0,z)|² is a spatial density slice, not a normalized 1D position probability. Zeeman: either orbital-only spinless model, or weak-field Landé g_J with intrinsic spin s=1/2, g_s=2; no intermediate/Paschen–Back mixing. Fine structure: Dirac point-Coulomb n=2 energies, infinite nuclear mass; no Lamb/QED/hyperfine/finite-nucleus terms. Spin is intrinsic angular momentum, not a spinning charged sphere. Hydrogen formulas are not applied to many-electron atoms.'}
