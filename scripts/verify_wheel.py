"""Exercise an extracted wheel outside the repository, without backend/PySCF imports."""
import argparse
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile
parser=argparse.ArgumentParser();parser.add_argument('directory',type=Path);args=parser.parse_args()
wheel=next(args.directory.glob('quantum_atom_lab-*.whl'))
with tempfile.TemporaryDirectory(prefix='qal-wheel-check-') as temporary:
    target=Path(temporary)
    with zipfile.ZipFile(wheel) as archive:archive.extractall(target)
    script='''import sys
sys.path.insert(0,sys.argv[1])
import quantum_atom_lab as q
assert q.__file__.startswith(sys.argv[1]),q.__file__
from quantum_engine.atomic_structure import species
from quantum_engine.molecular.structures import structure
assert species(8)['electrons']==8
assert structure('water')['pubchem_cid']==962
assert float(q.HydrogenicOrbital(1,0).probability_density(0,0,0))>0
assert q.HydrogenicOrbital(2,1).geometry(quality='preview')['points'].shape[1]==3
assert q.simulate_circuit()['qubit0_entropy_bits']>.99
from research_engine import recommend
assert recommend()['selected_method'] is not None
assert 'backend' not in sys.modules
assert 'pyscf' not in sys.modules
print('Standalone wheel/data/core imports verified:',q.__version__)
'''
    subprocess.run([sys.executable,'-c',script,str(target)],cwd=target,check=True)
