"""Analytic nearest-neighbor tight-binding models, no periodic-DFT claims."""
import math
import numpy as np


def bands(model='honeycomb',hopping=2.7,onsite=0.,length=1.42,grid=81):
    if model not in ('chain','square','honeycomb'):raise ValueError('Select chain, square or honeycomb model')
    for name,value,lo,hi in (('hopping',hopping,.1,5),('onsite',onsite,-5,5),('length',length,.5,5)):
        if type(value) not in (int,float) or not math.isfinite(value) or not lo<=value<=hi:raise ValueError(f'{name} must be finite within {lo}…{hi}')
    if type(grid) is not int or grid not in (21,41,81,161):raise ValueError('BZ grid must be 21/41/81/161')
    if model=='honeycomb':
        lattice=length*np.array([[np.sqrt(3)/2,1.5],[-np.sqrt(3)/2,1.5]])
        path=np.array([[0,0],[4*np.pi/(3*np.sqrt(3)*length),0],[np.pi/(np.sqrt(3)*length),np.pi/(3*length)],[0,0]])
        names=['Γ','K','M','Γ'];basis=np.array([[0,0],[0,length]])
    else:
        lattice=length*np.eye(2);basis=np.zeros((1,2))
        path=np.array([[-np.pi/length,0],[np.pi/length,0]]) if model=='chain' else np.pi/length*np.array([[0,0],[1,0],[1,1],[0,0]])
        names=['−π/a','π/a'] if model=='chain' else ['Γ','X','M','Γ']
    reciprocal=2*np.pi*np.linalg.inv(lattice).T
    def energy(k):
        if model=='chain':return (onsite-2*hopping*np.cos(k[:,0]*length))[:,None]
        if model=='square':return (onsite-2*hopping*(np.cos(k[:,0]*length)+np.cos(k[:,1]*length)))[:,None]
        f=1+np.exp(1j*k@lattice[0])+np.exp(1j*k@lattice[1]);magnitude=hopping*abs(f)
        return np.column_stack([onsite-magnitude,onsite+magnitude])
    ks=[];axis=[];ticks=[0.];offset=0.
    for start,end in zip(path[:-1],path[1:]):
        fraction=np.linspace(0,1,81);ks.extend(start+(end-start)*fraction[:,None]);axis.extend(offset+fraction*np.linalg.norm(end-start));offset+=np.linalg.norm(end-start);ticks.append(offset)
    fractions=np.arange(grid)/grid-.5
    if model=='chain':sample=np.column_stack([2*np.pi*fractions/length,np.zeros(grid)])
    else:
        u,v=np.meshgrid(fractions,fractions,indexing='ij');sample=np.column_stack([u.ravel(),v.ravel()])@reciprocal
    all_energy=energy(sample);n_bands=all_energy.shape[1]
    bandwidth=2*hopping*(1 if model=='chain' else 2 if model=='square' else 1.5)
    counts,edges=np.histogram(all_energy,bins=121,range=(onsite-bandwidth,onsite+bandwidth))
    width=edges[1]-edges[0];dos=counts/(len(sample)*width)
    centers=[]
    for i in range(-1,2):
        for j in (range(-1,2) if model!='chain' else (0,)):
            centers.extend((i*lattice[0]+j*lattice[1]+basis).tolist())
    xyz=np.column_stack([np.asarray(centers),np.zeros(len(centers))]);bonds=[]
    for a in range(len(xyz)):
        for b in range(a):
            if abs(np.linalg.norm(xyz[a]-xyz[b])-length)<1e-6:bonds.append({'a':a,'b':b,'order':1})
    return {'model':f'{model} / nearest-neighbor orthogonal tight binding','kind':model,'hopping_ev':hopping,'onsite_ev':onsite,
            'length_angstrom':length,'lattice_vectors_angstrom':lattice,'reciprocal_vectors_per_angstrom':reciprocal,
            'reciprocal_identity_error':float(np.max(abs(lattice@reciprocal.T-2*np.pi*np.eye(2)))),
            'path_k_per_angstrom':np.array(ks),'path_distance_per_angstrom':axis,'path_labels':names,'path_ticks':ticks,
            'energies_ev':energy(np.array(ks)).T,'dos_energy_ev':(edges[:-1]+edges[1:])/2,'dos_states_per_ev_cell':dos,
            'dos_integral_states_per_cell':float(dos.sum()*width),'bz_points':len(sample),'bands_per_cell':n_bands,
            'mean_energy_ev':float(all_energy.mean()),'energy_variance_ev2':float(np.mean((all_energy-onsite)**2)),
            'coordinates_angstrom':xyz,'atomic_numbers':[6]*len(xyz),'bonds':bonds,
            'assumptions':'User-parameter nearest-neighbor, orthogonal one-orbital model without electron interactions, spin, overlap, disorder or periodic DFT. Honeycomb is graphene-like topology, not a fitted experimental band structure; default lengths/hopping are illustrative input parameters and carry no materials-database provenance. Energy zero is the common onsite term. DOS is a finite uniform Brillouin-zone histogram per unit cell per spin; rectangle-bin integration counts one state per band, with visible sampling/binning artifacts. The honeycomb cell has two sites; chain/square one. Lattice markers/sticks show a finite patch of the model; they do not imply a calculated real crystal structure. For the chain only the first lattice vector is physical; the second is a plotting embedding.'}
