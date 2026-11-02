"""H2/STO-3G Jordan–Wigner Hamiltonian and a doubles-unitary ideal VQE."""
from itertools import product
import numpy as np
from scipy.optimize import minimize
from quantum_engine.chemistry.scf import Progress
from quantum_engine.chemistry.correlated import reference
from . import I,X,Y,Z


def annihilation(qubit,n=4):
    operator=np.zeros((2**n,2**n),complex)
    for index in range(2**n):
        if (index>>qubit)&1:operator[index^(1<<qubit),index]=(-1)**((index&((1<<qubit)-1)).bit_count())
    return operator


def vqe(request,progress:Progress=lambda _:None):
    if request.system!='h2' or request.basis!='sto-3g' or request.spin or request.method not in ('hf','rhf'):
        raise ValueError('Molecular VQE supports closed-shell H2 / RHF / STO-3G only')
    result,solution,mol,mf=reference(request,progress)
    from pyscf import ao2mo
    coeff=mf.mo_coeff;one=coeff.T@mf.get_hcore()@coeff;two=ao2mo.restore(1,ao2mo.kernel(mol,coeff),2)
    operators=[annihilation(q) for q in range(4)]
    hamiltonian=np.eye(16,dtype=complex)*mol.energy_nuc()
    number=sum(a.conj().T@a for a in operators)
    for p,q in product(range(2),repeat=2):
        for spin in range(2):hamiltonian+=one[p,q]*operators[2*p+spin].conj().T@operators[2*q+spin]
    for p,q,r,s in product(range(2),repeat=4):
        for spin,tau in product(range(2),repeat=2):
            hamiltonian+=.5*two[p,q,r,s]*operators[2*p+spin].conj().T@operators[2*r+tau].conj().T@operators[2*s+tau]@operators[2*q+spin]
    hermitian_error=float(np.max(abs(hamiltonian-hamiltonian.conj().T)))
    number_error=float(np.max(abs(number@hamiltonian-hamiltonian@number)))
    if max(hermitian_error,number_error)>1e-10:raise ValueError('Jordan–Wigner Hamiltonian invariants failed')
    sector=[i for i in range(16) if (i&5).bit_count()==1 and (i&10).bit_count()==1]
    exact=float(np.linalg.eigvalsh(hamiltonian[np.ix_(sector,sector)])[0])
    reference_state=np.eye(16)[:,3];double=np.eye(16)[:,12];history=[]
    def evaluate(parameter):
        theta=float(parameter[0]);state=np.cos(theta)*reference_state+np.sin(theta)*double
        derivative=-np.sin(theta)*reference_state+np.cos(theta)*double
        energy=float(np.vdot(state,hamiltonian@state).real);gradient=float(2*np.vdot(derivative,hamiltonian@state).real)
        entry={'evaluation':len(history)+1,'theta_rad':theta,'energy_hartree':energy,'gradient_hartree':gradient}
        history.append(entry);progress({'stage':'Ideal VQE energy minimization',**entry})
        return energy,np.array([gradient])
    fitted=minimize(evaluate,np.array([0.]),jac=True,method='BFGS',options={'gtol':1e-9,'maxiter':60})
    energy,gradient=evaluate(fitted.x)
    if not fitted.success or abs(gradient[0])>1e-8:raise ValueError('VQE classical optimization did not converge')
    theta=float(fitted.x[0]);state=np.cos(theta)*reference_state+np.sin(theta)*double
    terms=[];reconstructed=np.zeros_like(hamiltonian);paulis={'I':I,'X':X,'Y':Y,'Z':Z}
    for names in product('IXYZ',repeat=4):
        operator=np.array([[1.]])
        for name in names:operator=np.kron(operator,paulis[name])
        weight=float(np.trace(operator@hamiltonian).real/16)
        if abs(weight)>1e-12:
            terms.append({'pauli_q3_to_q0':''.join(names),'coefficient_hartree':weight});reconstructed+=weight*operator
    pauli_error=float(np.max(abs(reconstructed-hamiltonian)))
    if abs(energy-exact)>1e-8 or pauli_error>1e-10:raise ValueError('VQE exact-sector or Pauli reconstruction check failed')
    result['vqe']={'mapping':'Jordan–Wigner / 4 spin orbitals, little endian','ansatz':'exp[theta (|1100><0011|−|0011><1100|)] |0011>',
                   'theta_rad':theta,'total_energy_hartree':energy,'exact_sector_energy_hartree':exact,'variational_error_hartree':energy-exact,
                   'reference_energy_hartree':float(mf.e_tot),'gradient_hartree':float(gradient[0]),'converged':True,'history':history,
                   'pauli_terms':terms,'hamiltonian_real':hamiltonian.real,'hamiltonian_imag':hamiltonian.imag,
                   'state_real':state.real,'state_imag':state.imag,'particle_count':float(np.vdot(state,number@state).real),
                   'hermiticity_error':hermitian_error,'number_commutator_error':number_error,'pauli_reconstruction_error':pauli_error,
                   'assumptions':'Ideal exact state-vector expectation values, no shot noise or hardware execution. Actual RHF molecular integrals in H2/STO-3G are mapped by Jordan–Wigner. Orbital order is (0alpha,0beta,1alpha,1beta), q0 rightmost. The doubles excitation is a parameterized four-qubit unitary; its two-determinant subspace contains the even-parity H2/STO-3G ground state, which is why this ansatz matches finite-basis exact diagonalization here. This does not establish quantum advantage or ansatz completeness for other molecules/bases. Exact comparison restricts to two electrons, one alpha and one beta. Displayed HOMO is the reference, not the correlated VQE state.'}
    solution['result']=result
    return result,solution
