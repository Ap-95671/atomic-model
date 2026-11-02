"""Offline, source-preserved PubChem3D conformers; no equilibrium accuracy claim."""
from functools import lru_cache
from itertools import combinations
import json
from pathlib import Path
import numpy as np

CATALOG={'water':(962,'H₂O','Bent'),'ammonia':(222,'NH₃','Trigonal pyramidal'),'methane':(297,'CH₄','Tetrahedral'),
         'carbon-dioxide':(280,'CO₂','Linear'),'carbon-monoxide':(281,'CO','Linear diatomic'),'benzene':(241,'C₆H₆','Planar aromatic ring')}
SYMBOLS={1:'H',6:'C',7:'N',8:'O'}


@lru_cache(maxsize=6)
def structure(name='water'):
    if name not in CATALOG:raise ValueError('Select a supported bundled molecule')
    cid,formula,shape=CATALOG[name]
    compound=json.loads((Path(__file__).resolve().parents[1]/f'data/molecules/{name}.json').read_text())['PC_Compounds'][0]
    coord=compound['coords'][0];conformer=coord['conformers'][0]
    points=np.array([conformer[axis] for axis in ('x','y','z')],float).T
    # PubChem atom IDs need not be indices in another record; map them explicitly.
    by_id={aid:i for i,aid in enumerate(coord['aid'])}
    elements=dict(zip(compound['atoms']['aid'],compound['atoms']['element']))
    zs=[elements[aid] for aid in coord['aid']]
    bonds=[];neighbors={i:[] for i in range(len(points))}
    for a,b,order in zip(compound['bonds']['aid1'],compound['bonds']['aid2'],compound['bonds']['order']):
        i,j=by_id[a],by_id[b];neighbors[i].append(j);neighbors[j].append(i)
        bonds.append({'a':i,'b':j,'order':order,'length_angstrom':float(np.linalg.norm(points[i]-points[j]))})
    angles=[]
    for center,adjacent in neighbors.items():
        for i,j in combinations(adjacent,2):
            u,v=points[i]-points[center],points[j]-points[center]
            angle=float(np.degrees(np.arccos(np.clip(np.dot(u,v)/(np.linalg.norm(u)*np.linalg.norm(v)),-1,1))))
            angles.append({'a':i,'center':center,'b':j,'degrees':angle})
    return {'name':name,'formula':formula,'geometry':shape,'atomic_numbers':zs,'symbols':[SYMBOLS[z] for z in zs],
        'coordinates_angstrom':points,'bonds':bonds,'angles':angles,'pubchem_cid':cid,
        'source_url':f'https://pubchem.ncbi.nlm.nih.gov/compound/{cid}',
        'model':'Bundled PubChem3D reference conformer (source coordinates, not optimized here)',
        'units':{'length':'angstrom','angle':'degrees'},
        'assumptions':'Coordinates are a PubChem3D computed reference conformer, not a measured equilibrium geometry or an optimization performed by this app. Bond lengths/angles are derived from those coordinates. Ball sizes and sticks are schematic; bond order follows the source connectivity. No orbital, electron-density or electrostatic-potential claim is made by the structure view.'}
