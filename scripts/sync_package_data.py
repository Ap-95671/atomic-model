"""Copy canonical provenance-tracked data into the standalone scientific package."""
from pathlib import Path
import shutil
ROOT=Path(__file__).resolve().parents[1]
for relative in ('elements.json','isotopes.json','sto-3g-h-he.json','SOURCES.md',*(f'molecules/{p.name}' for p in sorted((ROOT/'data/molecules').glob('*.json')))):
    target=ROOT/'quantum_engine/data'/relative;target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(ROOT/'data'/relative,target)
