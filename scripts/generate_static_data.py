"""Reproduce static reference tables from the unchanged Python engine.
Run from repository root with optional PySCF installed. Never called by Pages.
"""
import hashlib
import json
import platform
from dataclasses import replace
from pathlib import Path
import numpy as np
from scipy.constants import m_e, m_p
from quantum_engine.constants import ATOMIC_MASS, RYDBERG_EV, BOHR_RADIUS, h, c, e
from quantum_engine.electron_configuration import ELEMENTS, configuration_for
from quantum_engine.atomic_structure import ISOTOPES
from quantum_engine.spectroscopy import radial_dipole, angular_dipole
from quantum_engine.molecular.diagrams import diagram
from quantum_engine.molecular.structures import structure
from quantum_engine.chemistry import catalog, ChemistryRequest
from quantum_engine.chemistry.scf import solve, field

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'frontend/static-data'
OUT.mkdir(exist_ok=True)
def encode(v):
    if isinstance(v,np.ndarray):return v.tolist()
    if isinstance(v,np.generic):return v.item()
    raise TypeError(type(v).__name__)
def write(name,value):
    target=OUT/name
    target.write_text(json.dumps(value,default=encode,allow_nan=False,separators=(',',':'))+'\n')
    return {'file':name,'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}

config={}
for z in range(1,119):
    for q in range(z-118,z+1):
        value=configuration_for(z,q)
        if value['configuration'] is not None:config[f'{z},{q}']=value
radial={f'{ni},{li},{nf},{lf}':radial_dipole(ni,li,nf,lf)
        for ni in range(1,9) for li in range(min(4,ni))
        for nf in range(1,9) for lf in range(min(4,nf)) if abs(lf-li)==1}
angular={f'{li},{mi},{lf},{mf},{q}':abs(angular_dipole(li,mi,lf,mf,q))**2
         for li in range(4) for mi in range(-li,li+1)
         for lf in range(4) if abs(li-lf)==1 for mf in range(-lf,lf+1)
         for q in (-1,0,1) if mf-mi==q}
reference={'elements':ELEMENTS,'isotopes':ISOTOPES,'configurations':config,
           'constants':{'electron_mass_u':m_e/ATOMIC_MASS,'proton_mass_u':m_p/ATOMIC_MASS,'rydberg_ev':RYDBERG_EV,'bohr_nm':BOHR_RADIUS*1e9,'hc_ev_nm':h*c/e*1e9,'ev_hz':e/h},
           'radial_dipoles':radial,'angular_dipoles_squared':angular,
           'diagrams':{name:diagram(name) for name in ['h2plus','h2','he2','li2','b2','c2','n2','o2','f2','ne2']},
           'structures':{name:structure(name) for name in ['water','ammonia','methane','carbon-dioxide','carbon-monoxide','benzene']},
           'catalog':catalog()}
files=[write('reference.json',reference)]
records=[]
import pyscf
for name in ['h2','n2','o2','water']:
    system=next(s for s in catalog()['systems'] if s['id']==name)
    request=ChemistryRequest(system=name,distance=system['distance'],spin=system['spin'],quality='preview')
    result,solution=solve(request)
    fields={}
    for channel in ['alpha','beta']:
        for view in ['homo','lumo','density','spin-density']:
            ch=result['channels'][0 if channel=='alpha' else 1]
            index=ch[view] if view in ('homo','lumo') else -1
            if index is None:continue
            selected=replace(request,channel=channel,view='orbital' if view in ('homo','lumo') else view,orbital=index)
            fields[f'{channel}:{view}']=field(solution,selected)
    result['field']=fields['alpha:homo']
    result['model']='PRECOMPUTED DATASET · '+result['model']
    result['_provenance']={'kind':'precomputed','engine':f'PySCF {pyscf.__version__}','request':request.to_dict(),'source':'scripts/generate_static_data.py','limitations':'Fixed geometry, HF/STO-3G, preview 41³ isosurfaces at 0.08 of grid peak. No browser SCF/DFT or geometry optimization. Recorded process timing is generation-time, not browser performance.'}
    filename=f'chemistry-{name}.json'
    files.append(write(filename,{'result':result,'fields':fields}))
    records.append({'system':name,'label':system['label'],'file':filename,'energy_hartree':result['total_energy_hartree'],'request':request.to_dict()})
    print(name,result['total_energy_hartree'],flush=True)
files.append(write('manifest.json',{'schema':1,'generator':'scripts/generate_static_data.py','python':platform.python_version(),'pyscf':pyscf.__version__,'records':records,'reference_sources':'quantum_engine/data/SOURCES.md; NIST configurations/isotopes; PubChem3D conformers','files':files}))
print('Static tables:',sum(f['bytes'] for f in files),'bytes')
