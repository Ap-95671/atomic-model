"""One fixed-protocol, CPU-limited public calculation, with no arbitrary code."""
import json
import math
import os
import resource
import sys


def calculate(path,q):
    from quantum_engine import QuantumState
    from quantum_engine.atomic_structure import species
    from quantum_engine.electron_configuration import ELEMENTS
    from quantum_engine.energy_levels import energy_ev,transition
    def number(name,default,kind=float):return kind(q.get(name,[str(default)])[0])
    def atom():return species(number('z',1,int),number('a',None,int) if 'a' in q else None,number('charge',0,int))
    if path=='/api/elements':return ELEMENTS
    if path=='/api/species':return atom()
    if path=='/api/chemistry/catalog':
        from quantum_engine.chemistry import catalog
        return catalog()
    if path=='/api/orbital':
        from quantum_engine.geometry import orbital_payload
        state=QuantumState(number('n',1,int),number('l',0,int),number('m',0,int),number('spin',.5),q.get('basis',['real'])[0])
        return orbital_payload(state,atom(),mode=q.get('mode',['cloud'])[0],quality='preview',point_count=number('points',5000,int),threshold=number('threshold',.06),
                               show_nodes=q.get('nodes',['false'])[0]=='true',effective_z=number('zeff',1))
    if path=='/api/molecular':
        from .molecular_geometry import molecule_payload
        return molecule_payload(number('distance',2),q.get('orbital',['bonding'])[0],number('threshold',.12),number('exponent',1),q.get('optimize',['false'])[0]=='true','preview')
    if path=='/api/molecular/diagram':
        from quantum_engine.molecular.diagrams import diagram
        return diagram(q.get('name',['o2'])[0])
    if path=='/api/molecular/structure':
        from quantum_engine.molecular.structures import structure
        return structure(q.get('name',['water'])[0])
    if path=='/api/physics':
        from .api.physics import from_query
        return from_query(q)
    if path=='/api/energy':
        value=atom()
        if not value['one_electron']:raise ValueError('Hydrogenic energies require one electron')
        ni,nf=number('initial',3,int),number('final',2,int)
        if not 1<=ni<=30 or not 1<=nf<=30:raise ValueError('Transition levels must be 1…30')
        return {'levels':[energy_ev(n,value['z'],value['nuclear_mass_u']) for n in range(1,9)],**transition(ni,nf,value['z'],value['nuclear_mass_u'])}
    from .api.experiments import calculate as experiment
    return experiment(path,q,atom())


def encode(value):
    import numpy as np
    if isinstance(value,np.ndarray):return value.tolist()
    if isinstance(value,np.generic):return value.item()
    raise TypeError('Unsupported scientific result type')


def run(payload):
    # One process per request: CPU accounting cannot accumulate across visitors.
    seconds=max(1,math.ceil(float(os.getenv('QAL_COMPUTE_TIMEOUT','8'))))
    resource.setrlimit(resource.RLIMIT_CPU,(seconds,seconds+1))
    resource.setrlimit(resource.RLIMIT_NOFILE,(64,64))
    from .public_policy import normalize
    query=normalize(payload['path'],payload['query'])
    value=calculate(payload['path'],query)
    print(json.dumps({'data':value},default=encode,allow_nan=False,separators=(',',':')))

if __name__=='__main__':
    try:run(json.loads(sys.stdin.read(32769)))
    except (ValueError,TypeError,OverflowError) as error:print(json.dumps({'error':str(error),'status':400}))
    except (PermissionError,KeyError) as error:print(json.dumps({'error':str(error),'status':503 if isinstance(error,PermissionError) else 404}))
    except Exception:
        # Private trace to worker stderr; clients see no paths/stack/secrets.
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({'error':'Scientific calculation failed within the public resource limits. Try a smaller preview or advanced local mode.','status':503}))
