"""Bounded marching-cubes fields evaluated from the molecular wavefunction."""
from functools import lru_cache
import math
import numpy as np
from skimage.measure import marching_cubes
from quantum_engine.molecular import lcao, amplitude, bond_curve


@lru_cache(maxsize=12)
def molecule_payload(distance=2.,orbital='bonding',threshold=.12):
    d=lcao(distance)
    if orbital not in ('bonding','antibonding','atomic-a','atomic-b'):raise ValueError('Unknown molecular orbital')
    if not math.isfinite(threshold) or not .02<=threshold<=.4:raise ValueError('Amplitude threshold must be .02….4 of peak')
    extent=distance/2+5
    axis=np.linspace(-extent,extent,65)
    grid=np.stack(np.meshgrid(axis,axis,axis,indexing='ij'),axis=-1)
    field=amplitude(grid,distance,orbital)
    level=float(np.max(abs(field))*threshold)
    surfaces=[]
    for sign in (1,-1):
        values=field*sign
        if values.max()<=level:continue
        vertices,faces,_,_=marching_cubes(values,level,spacing=(axis[1]-axis[0],)*3)
        vertices-=extent
        surfaces.append({'vertices':vertices,'faces':faces,'phases':np.full(len(vertices),0 if sign==1 else np.pi)})
    return {**d,'orbital':orbital,'extent':extent,'surfaces':surfaces,
            'points':[],'phases':[],'centers_a0':[[-distance/2,0,0],[distance/2,0,0]],
            'threshold':threshold,'grid_size':65,'curve':bond_curve(),
            'surface_note':'ψ=±threshold×grid peak amplitude. Colors mark +ψ/−ψ, not charge. Threshold is not enclosed probability; nuclei are enlarged schematic markers.'}
