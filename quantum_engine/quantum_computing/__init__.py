"""Small ideal state-vector circuits; no hardware credentials or noise claims."""
import math
import numpy as np

I=np.eye(2,dtype=complex)
X=np.array([[0,1],[1,0]],complex);Y=np.array([[0,-1j],[1j,0]],complex);Z=np.diag([1.,-1.]).astype(complex)


def circuit(qubits=2,gates=None,shots=2000,seed=42):
    if type(qubits) is not int or not 1<=qubits<=5:raise ValueError('Circuit qubits must be 1…5')
    if type(shots) is not int or not 0<=shots<=10000 or type(seed) is not int or not 0<=seed<=2**32-1:raise ValueError('Shots 0…10000 and seed 0…2³²−1 required')
    gates=[{'gate':'H','target':0},{'gate':'CX','control':0,'target':1}] if gates is None and qubits>1 else [] if gates is None else gates
    if not isinstance(gates,list) or len(gates)>32:raise ValueError('Circuit must contain at most 32 gates')
    state=np.zeros(2**qubits,dtype=complex);state[0]=1;history=[]
    for i,gate in enumerate(gates):
        if not isinstance(gate,dict) or set(gate)-{'gate','target','control','angle'}:raise ValueError('Each gate needs gate, target, and optional control/angle')
        name=gate.get('gate');target=gate.get('target');control=gate.get('control')
        if type(target) is not int or not 0<=target<qubits:raise ValueError('Gate target is outside the circuit')
        if name in ('CX','CZ','SWAP'):
            if type(control) is not int or not 0<=control<qubits or control==target or 'angle' in gate:raise ValueError('Two-qubit gates require distinct valid control/target and no angle')
            for index in range(len(state)):
                if name=='SWAP':
                    if (index>>target)&1 and not (index>>control)&1:
                        other=index^(1<<target)^(1<<control);state[index],state[other]=state[other],state[index]
                elif (index>>control)&1:
                    if name=='CZ' and (index>>target)&1:state[index]*=-1
                    elif name=='CX' and not (index>>target)&1:
                        other=index^(1<<target);state[index],state[other]=state[other],state[index]
        else:
            if control is not None:raise ValueError('Single-qubit gates have no control')
            if name in ('RX','RY','RZ'):
                angle=gate.get('angle')
                if type(angle) not in (int,float) or not math.isfinite(angle) or abs(angle)>8*np.pi:raise ValueError('Rotation angle must be finite within ±8π rad')
                operator=np.cos(angle/2)*I-1j*np.sin(angle/2)*{'RX':X,'RY':Y,'RZ':Z}[name]
            else:
                if 'angle' in gate:raise ValueError('Angle applies only to RX/RY/RZ')
                operators={'H':(X+Z)/np.sqrt(2),'X':X,'Y':Y,'Z':Z,'S':np.diag([1,1j]),'T':np.diag([1,np.exp(1j*np.pi/4)])}
                if name not in operators:raise ValueError('Supported gates: H X Y Z S T RX RY RZ CX CZ SWAP')
                operator=operators[name]
            for index in range(len(state)):
                if not (index>>target)&1:
                    other=index^(1<<target);state[[index,other]]=operator@state[[index,other]]
        history.append({'step':i+1,'gate':gate,'norm_error':float(abs(np.vdot(state,state)-1))})
    probabilities=abs(state)**2;norm_error=float(abs(probabilities.sum()-1))
    if norm_error>1e-10:raise ValueError('Circuit norm check failed')
    sample=np.random.default_rng(seed).multinomial(shots,probabilities/probabilities.sum())
    array=state.reshape(-1,2);rho=array.T@array.conj();eigen=np.linalg.eigvalsh(rho);positive=eigen[eigen>1e-15]
    return {'model':'Ideal local state-vector circuit simulator','qubits':qubits,'gates':gates,'shots':shots,'seed':seed,
            'basis_labels':[format(i,f'0{qubits}b') for i in range(len(state))],'state_real':state.real,'state_imag':state.imag,
            'probabilities':probabilities,'counts':sample,'norm_error':norm_error,'history':history,
            'qubit0_density_real':rho.real,'qubit0_density_imag':rho.imag,'qubit0_bloch':[float(2*rho[0,1].real),float(-2*rho[0,1].imag),float((rho[0,0]-rho[1,1]).real)],
            'qubit0_purity':float(np.trace(rho@rho).real),'qubit0_entropy_bits':float(-np.sum(positive*np.log2(positive))),
            'assumptions':'Ideal pure-state simulation, |0…0> input, no noise or hardware execution. Bit strings are q[n−1]…q0 (q0 rightmost/little endian). Gate order follows the supplied list. Only final independent computational-basis measurements are sampled; no mid-circuit collapse/conditional gates. Entropy of qubit 0 quantifies entanglement with the rest only because the full simulated state is pure. An entangled qubit can have zero local Bloch vector.'}
