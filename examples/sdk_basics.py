"""Run after `python -m pip install . --no-build-isolation`."""
from quantum_atom_lab import HydrogenicOrbital,well_superposition,open_system,simulate_circuit,tight_binding
orbital=HydrogenicOrbital(n=2,l=1,m=0)
print('2p density at (0,0,1) a0:',float(orbital.probability_density(x=0.,y=0.,z=1.)))
print('Well max norm error:',well_superposition()['max_norm_error'])
print('Lindblad trace error:',open_system()['max_trace_error'])
print('Bell entanglement / bits:',simulate_circuit()['qubit0_entropy_bits'])
print('Honeycomb states per cell/spin:',tight_binding()['dos_integral_states_per_cell'])
