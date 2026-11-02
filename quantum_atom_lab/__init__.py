"""Public scientific API v1; experimental 3.0 alpha package, core needs no PySCF."""
from dataclasses import dataclass
from typing import Any, Literal
import numpy as np
from quantum_engine import QuantumState, wavefunction, density
from quantum_engine.constants import length_scale
from quantum_engine.chemistry.models import ChemistryRequest

__version__='3.0.0a1'
API_VERSION=1


@dataclass(frozen=True)
class HydrogenicOrbital:
    """Normalized nonrelativistic Coulomb orbital in a0; infinite mass by default."""
    n:int
    l:int
    m:int=0
    basis:Literal['real','complex']='real'
    z:float=1.
    nuclear_mass_u:float|None=None

    def __post_init__(self):
        self.state
        length_scale(self.z,self.nuclear_mass_u)

    @property
    def state(self)->QuantumState:
        return QuantumState(self.n,self.l,self.m,basis=self.basis)

    def amplitude(self,x:Any,y:Any,z:Any)->np.ndarray:
        """Complex/real psi, in a0^-3/2; x/y/z broadcast like NumPy arrays."""
        xyz=np.stack(np.broadcast_arrays(x,y,z),axis=-1)
        return wavefunction(self.state,xyz,self.z,self.nuclear_mass_u)

    def probability_density(self,x:Any,y:Any,z:Any)->np.ndarray:
        """Nonnegative |psi|² in a0^-3 (not a radial probability distribution)."""
        xyz=np.stack(np.broadcast_arrays(x,y,z),axis=-1)
        return density(self.state,xyz,self.z,self.nuclear_mass_u)

    def geometry(self,mode:Literal['cloud','surface']='cloud',quality:Literal['preview','balanced','high']='balanced',**options:Any)->dict:
        """Renderer-independent fields/meshes, physical lengths in a0."""
        from quantum_engine.geometry import orbital_payload
        return orbital_payload(self.state,{'one_electron':True,'z':self.z,'nuclear_mass_u':self.nuclear_mass_u},mode=mode,quality=quality,**options)

    def validate(self)->dict:
        from quantum_engine.radial_wavefunctions import normalization
        return {'radial_probability_integral':normalization(self.n,self.l),'api_version':API_VERSION,
                'assumptions':'Normalized nonrelativistic point-nucleus Coulomb model; no many-electron interaction or relativistic correction.'}


def well_superposition(**parameters:Any)->dict:
    from quantum_engine.dynamics.general import well
    return well(**parameters)


def atomic_superposition(**parameters:Any)->dict:
    from quantum_engine.dynamics.atomic import atomic
    return atomic(**parameters)


def open_system(**parameters:Any)->dict:
    from quantum_engine.dynamics.open_systems import lindblad
    return lindblad(**parameters)


def simulate_circuit(**parameters:Any)->dict:
    from quantum_engine.quantum_computing import circuit
    return circuit(**parameters)


def tight_binding(**parameters:Any)->dict:
    from quantum_engine.materials import bands
    return bands(**parameters)


def spectroscopy_transition(initial:QuantumState,final:QuantumState,**parameters:Any)->dict:
    from quantum_engine.spectroscopy import electric_dipole
    return electric_dipole(initial,final,**parameters)


def molecular_calculation(request:ChemistryRequest|dict,operation:str='scf',options:dict|None=None)->dict:
    """Optional PySCF, direct synchronous execution; caller manages time/resources.

    Browser calculations use separately bounded/cancellable worker processes.
    This SDK function never starts a server or accepts arbitrary program code.
    """
    from quantum_engine.chemistry.scf import solve
    from quantum_engine.chemistry.geometry import optimize,GeometryOptions
    from quantum_engine.chemistry.correlated import correlation,excitations,bond_scan,CorrelationOptions,ExcitationOptions
    value=ChemistryRequest.parse(request.to_dict() if isinstance(request,ChemistryRequest) else request)
    if operation=='scf':
        if options:raise ValueError('SCF has no extra options')
        return solve(value)[0]
    if operation in ('optimize','vibrations'):return optimize(value,GeometryOptions.parse(options or {}),vibrations=operation=='vibrations')[0]
    if operation=='correlation':return correlation(value,CorrelationOptions.parse(options or {}))[0]
    if operation=='excitations':return excitations(value,ExcitationOptions.parse(options or {}))[0]
    if operation=='bond_scan':return bond_scan(value)[0]
    if operation=='vqe':
        from quantum_engine.quantum_computing.vqe import vqe
        return vqe(value)[0]
    raise ValueError('Unsupported molecular operation')

__all__=['API_VERSION','__version__','HydrogenicOrbital','QuantumState','ChemistryRequest','well_superposition',
         'atomic_superposition','open_system','simulate_circuit','tight_binding','spectroscopy_transition','molecular_calculation']
