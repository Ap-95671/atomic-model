"""Explicit public-demo bounds. Advanced local methods remain in the source app."""
from dataclasses import dataclass
import json
import os

UNAVAILABLE='This calculation is available in advanced local mode. The public demo does not run PySCF, geometry/vibration optimization, post-HF, electronic-response jobs or expanded in-house HF. See the local installation instructions.'


@dataclass(frozen=True)
class PublicSettings:
    timeout_seconds:float=8.
    worker_memory_mib:int=192
    cache_bytes:int=16*1024**2
    cache_ttl_seconds:int=300
    per_ip_per_minute:int=60
    global_per_minute:int=120
    max_response_bytes:int=4*1024**2

    @classmethod
    def from_env(cls):
        timeout=float(os.getenv('QAL_COMPUTE_TIMEOUT','8'))
        memory=int(os.getenv('QAL_WORKER_MEMORY_MIB','192'))
        if not 1<=timeout<=15 or not 96<=memory<=256:
            raise ValueError('Public timeout must be 1…15 seconds and worker memory 96…256 MiB')
        return cls(timeout_seconds=timeout,worker_memory_mib=memory)


def capabilities(public=True):
    return {'mode':'public' if public else 'local','advanced_computation':not public,
            'atomic_max_points':8000 if public else 60000,'atomic_qualities':['preview'] if public else ['preview','balanced','high'],
            'molecular_qualities':['preview'] if public else ['preview','balanced','high'],
            'message':'Resource-bounded public demo: preview orbital grids, up to 8,000 points, one scientific worker. Advanced calculations are available locally.' if public else 'Full local scientific mode; optional backend requirements apply.',
            'public_supported':['Atomic Explorer / s p d f','Periodic table / isotopes / ions','H2+ LCAO / MO reference diagrams / source structures',
                                'Spectroscopy','Measurement','Well and n<=2 atomic dynamics','Tunneling','Fields','Lindblad','Ideal circuits','Tight-binding','Benchmark lookup'],
            'restricted':['PySCF jobs','In-house HF grids and curves','Geometry/vibrations','Post-HF','Electronic response','Molecular VQE'] if public else []}


def normalize(path,query):
    q={key:list(value) for key,value in query.items()}
    if len(q)>24 or any(len(v)!=1 or len(v[0])>8192 for v in q.values()):raise ValueError('Use one bounded value per scientific parameter')
    if path.startswith('/api/jobs') or path=='/api/computation/pyscf' or path=='/api/computation/hartree-fock':
        raise PermissionError(UNAVAILABLE)
    allowed={'/api/elements','/api/species','/api/orbital','/api/energy','/api/molecular','/api/molecular/diagram','/api/molecular/structure',
             '/api/spectroscopy','/api/spectroscopy/transition','/api/spectroscopy/series','/api/measurement','/api/dynamics/superposition','/api/tunneling','/api/fields','/api/physics','/api/chemistry/catalog'}
    if path not in allowed:raise KeyError('Unknown API endpoint')
    def integer(name,default):return int(q.get(name,[str(default)])[0])
    if path=='/api/orbital':
        if q.get('quality',['preview'])[0]!='preview':raise ValueError('Public orbital quality is preview (49³); use advanced local mode for larger grids')
        points=integer('points',5000) or 5000
        if not 1000<=points<=8000:raise ValueError('Public orbital point count must be 1000…8000')
        q.update(quality=['preview'],points=[str(points)])
    if path=='/api/molecular':
        if q.get('quality',['preview'])[0]!='preview':raise ValueError('Public H2+ grid quality is preview (41³)')
        q['quality']=['preview']
    if path=='/api/measurement' and integer('count',2000)>10000:raise ValueError('Public measurement batches are limited to 10000 outcomes')
    if path=='/api/tunneling':
        if integer('grid',1024)!=1024:raise ValueError('Public tunneling supports 1024 cells; larger grids are available locally')
        duration=float(q.get('duration',['60'])[0]);dt=float(q.get('dt',['.02'])[0])
        if dt<=0 or duration/dt>3000:raise ValueError('Public tunneling supports at most 3000 time steps')
    if path=='/api/physics':
        raw=q.get('parameters',['{}'])[0]
        def invalid(value):raise ValueError('Nonfinite JSON is not accepted')
        params=json.loads(raw,parse_constant=invalid)
        if not isinstance(params,dict):raise ValueError('Expected a physics parameter object')
        operation=q.get('operation',['well'])[0]
        if operation=='atomic' and params.get('points',6000)>6000:raise ValueError('Public atomic evolution supports at most 6000 display points')
        if operation=='bands' and params.get('grid',81)>81:raise ValueError('Public BZ grid is limited to 81×81')
        if operation=='circuit' and (params.get('qubits',2)>4 or params.get('shots',2000)>5000):raise ValueError('Public circuits support up to 4 qubits / 5000 shots')
        if operation=='well' and params.get('grid',257)>257:raise ValueError('Public well spatial samples are limited to 257')
    return q
