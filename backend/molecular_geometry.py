"""Bounded marching-cubes fields evaluated from the molecular wavefunction."""
from functools import lru_cache
import math
import numpy as np
from skimage.measure import marching_cubes
from quantum_engine.molecular import lcao, amplitude, bond_curve


@lru_cache(maxsize=12)
def molecule_payload(distance=2.,orbital='bonding',threshold=.12,exponent=1.,optimize=False,quality='balanced'):
    d=lcao(distance,exponent,optimize)
    if quality not in ('preview','balanced','high'):raise ValueError('Unsupported molecular grid quality')
    exponent=d['basis_exponent']
    size={'preview':41,'balanced':65,'high':97}[quality]
    if orbital not in ('bonding','antibonding','atomic-a','atomic-b'):raise ValueError('Unknown molecular orbital')
    if not math.isfinite(threshold) or not .02<=threshold<=.4:raise ValueError('Amplitude threshold must be .02….4 of peak')
    extent=distance/2+max(5,5/exponent)
    axis=np.linspace(-extent,extent,size)
    grid=np.stack(np.meshgrid(axis,axis,axis,indexing='ij'),axis=-1)
    field=amplitude(grid,distance,orbital,exponent)
    level=float(np.max(abs(field))*threshold)
    surfaces=[]
    residuals=[]
    for sign in (1,-1):
        values=field*sign
        if values.max()<=level:continue
        vertices,faces,_,_=marching_cubes(values,level,spacing=(axis[1]-axis[0],)*3)
        vertices-=extent
        residuals.append(float(np.max(abs(abs(amplitude(vertices,distance,orbital,exponent))-level))/level))
        surfaces.append({'vertices':vertices,'faces':faces,'phases':np.full(len(vertices),0 if sign==1 else np.pi)})
    return {**d,'orbital':orbital,'extent':extent,'surfaces':surfaces,
            'points':[],'phases':[],'centers_a0':[[-distance/2,0,0],[distance/2,0,0]],
            'threshold':threshold,'grid_size':size,'grid_spacing_a0':float(axis[1]-axis[0]),'surface_level_absolute':level,'max_relative_surface_residual':max(residuals,default=0.),'curve':bond_curve(1. if optimize else exponent,optimize),
            'surface_note':'ψ=±threshold×grid peak amplitude. Colors mark +ψ/−ψ, not charge. Threshold is not enclosed probability; nuclei are enlarged schematic markers.'}


@lru_cache(maxsize=8)
def hartree_fock_payload(system='h2',distance=1.4,basis='sto-3g',view='density'):
    from quantum_engine.hartree_fock import solve,evaluate,energy_curve
    d=solve(system,distance,basis)
    extent=(distance/2 if system=='h2' else 0)+5
    axis=np.linspace(-extent,extent,65)
    grid=np.stack(np.meshgrid(axis,axis,axis,indexing='ij'),axis=-1)
    field=evaluate(d,grid,view)
    level=float(np.max(abs(field))*.08)
    surfaces=[]
    for sign in (1,-1):
        values=field*sign
        if values.max()<=level:continue
        vertices,faces,_,_=marching_cubes(values,level,spacing=(axis[1]-axis[0],)*3)
        vertices-=extent
        surfaces.append({'vertices':vertices,'faces':faces,'phases':np.full(len(vertices),0 if sign==1 else np.pi)})
    density=evaluate(d,grid,'density')
    integrated=float(np.trapezoid(np.trapezoid(np.trapezoid(density,axis,axis=2),axis,axis=1),axis))
    return {**d,'view':view,'extent':extent,'points':[],'phases':[],'surfaces':surfaces,
            'density_integral_finite_grid':integrated,'surface_threshold_fraction':.08,
            'surface_note':'Surface is 8% of grid peak electron density for density view, or signed amplitude for HOMO/LUMO. It is not enclosed electron count.',
            'curve':energy_curve(basis) if system=='h2' else None}
