"""Independent Python-engine expectations for the browser port; not a Pages build step."""
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import numpy as np
from quantum_engine import QuantumState
from quantum_engine.radial_wavefunctions import radial,radial_nodes
from quantum_engine.angular_wavefunctions import angular
from quantum_engine.atomic_structure import species
from quantum_engine.spectroscopy import electric_dipole,spectral_series
from quantum_engine.molecular import lcao
from quantum_engine.dynamics import superposition
from quantum_engine.quantum_computing import circuit
from quantum_engine.materials import bands
from quantum_engine.measurement import measurement
class ScientificJSONEncoder(json.JSONEncoder):
 def default(self,value):
  if isinstance(value,np.ndarray):return value.tolist()
  if isinstance(value,np.generic):return value.item()
  return super().default(value)

out={'generator':'scripts/browser_reference_cases.py','radial':[],'angular':[],'species':[],'spectroscopy':[],'molecular':[],'well':[],'circuit':[],'bands':[],'measurement':[]}
for n in range(1,9):
 for l in range(min(n,4)):
  r=[0,.05,.5,1,2,5,10,n*n/4,n*n,n*n*3]
  out['radial'].append({'n':n,'l':l,'r':r,'values':radial(n,l,r),'nodes':radial_nodes(n,l)})
for l in range(4):
 for m in range(-l,l+1):
  for basis in ['real','complex']:
   theta=np.array([0,.4,1.2,np.pi/2,np.pi]);phi=np.array([0,.7,2.1,.3,1.1]);v=angular(l,m,theta,phi,basis)
   out['angular'].append({'l':l,'m':m,'basis':basis,'theta':theta,'phi':phi,'real':v.real,'imag':v.imag})
for z,q,a in [(z,0,None) for z in range(1,119)]+[(26,2,None),(26,3,None),(8,-2,None),(2,1,4),(1,0,2),(118,117,300),(1,1,1)]:out['species'].append({'params':{'z':z,'charge':q,**({'a':a} if a else {})},'result':species(z,a,q)})
for z,a,q in [(1,1,0),(2,4,1)]:
 for ni,li,mi,nf,lf,mf,pol,sp in [(3,1,0,2,0,0,'all',.5),(2,0,0,1,0,0,'all',.5),(4,2,1,2,1,0,'sigma-',.5),(4,3,-1,3,2,0,'sigma+',.5),(3,1,1,2,0,0,'pi',.5),(3,1,0,2,0,0,'all',-.5)]:
  atom=species(z,a,q);p={'z':z,'a':a,'charge':q,'i_n':ni,'i_l':li,'i_m':mi,'f_n':nf,'f_l':lf,'f_m':mf,'polarization':pol,'f_spin':sp,'lower':2}
  out['spectroscopy'].append({'params':p,'transition':electric_dipole(QuantumState(ni,li,mi,basis='complex'),QuantumState(nf,lf,mf,spin=sp,basis='complex'),z,atom['nuclear_mass_u'],pol),'series':spectral_series(2,z,atom['nuclear_mass_u'])})
for r in [.5,1.4,2,3,10]:
 for exponent,optimize in [(1,False),(.3,False),(3,False),(1,True)]:out['molecular'].append({'distance':r,'exponent':exponent,'optimize':optimize,'result':lcao(r,exponent,optimize)})
for p in [{},{'state_a':2,'state_b':5,'ar':.4,'ai':.8,'br':-1,'bi':2,'length':15},{'ar':0,'br':1}]:out['well'].append({'params':p,'result':superposition(**p)})
circuits=[{}, {'qubits':1,'gates':[{'gate':'H','target':0},{'gate':'S','target':0}]}, {'qubits':3,'gates':[{'gate':'H','target':0},{'gate':'CX','control':0,'target':2},{'gate':'RY','target':1,'angle':.7},{'gate':'RZ','target':0,'angle':-.9},{'gate':'SWAP','control':1,'target':2},{'gate':'CZ','control':2,'target':1},{'gate':'RX','target':0,'angle':1.3},{'gate':'Y','target':1},{'gate':'T','target':0}]}]
for p in circuits:out['circuit'].append({'params':p,'result':circuit(**p)})
for model in ['chain','square','honeycomb']:
 p={'model':model,'grid':21,'hopping':2.1,'onsite':.3,'length':1.8};out['bands'].append({'params':p,'result':bands(**p)})
for n,l,m,basis in [(1,0,0,'real'),(2,1,1,'real'),(3,2,-2,'complex'),(4,3,0,'real')]:out['measurement'].append({'params':{'n':n,'l':l,'m':m,'basis':basis,'count':10000,'seed':42},'result':measurement(QuantumState(n,l,m,basis=basis),10000,42,1,species()['nuclear_mass_u'])})
path=Path(__file__).resolve().parents[1]/'frontend/tests/fixtures/browser-parity.json'
path.write_text(json.dumps(out,cls=ScientificJSONEncoder,allow_nan=False,separators=(',',':'))+'\n');print(path.stat().st_size,'reference bytes')
