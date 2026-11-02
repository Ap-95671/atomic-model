"""Requires the optional computation extra: pip install '.[computation]'."""
from quantum_atom_lab import ChemistryRequest,molecular_calculation
request=ChemistryRequest(system='h2',distance=1.4)
for method in ('mp2','ccsd','fci'):
    data=molecular_calculation(request,'correlation',{'method':method})
    print(method,data['correlation']['total_energy_hartree'],'Eh')
