"""Bounded read-only JSON adapters for core physics, independent of PySCF."""
import json
from quantum_engine.dynamics.atomic import atomic
from quantum_engine.dynamics.general import well
from quantum_engine.dynamics.open_systems import lindblad


def calculate(operation,parameters):
    if not isinstance(parameters,dict):raise ValueError('Physics parameters must be a JSON object')
    functions={'well':well,'lindblad':lindblad,'atomic':atomic}
    if operation not in functions:raise ValueError('Unsupported core physics calculation')
    return functions[operation](**parameters)


def from_query(query):
    raw=query.get('parameters',['{}'])[0]
    if len(raw)>8192:raise ValueError('Physics parameter JSON is limited to 8192 characters')
    def invalid(value):raise ValueError('Nonfinite JSON is not accepted')
    return calculate(query.get('operation',['well'])[0],json.loads(raw,parse_constant=invalid))
