"""Reference-based elementary MO occupation schemes; no numerical energies."""
COUNTS={'h2plus':1,'h2':2,'he2':4,'li2':2,'b2':6,'c2':8,'n2':10,'o2':12,'f2':14,'ne2':16}
FORMULAS={'h2plus':'H₂⁺','h2':'H₂','he2':'He₂','li2':'Li₂','b2':'B₂','c2':'C₂','n2':'N₂','o2':'O₂','f2':'F₂','ne2':'Ne₂'}


def diagram(name='o2'):
    if name not in COUNTS:raise ValueError('Unsupported educational MO diagram')
    first=name in ('h2plus','h2','he2')
    levels=[('σ1s',1,True),('σ*1s',1,False)] if first else [('σ2s',1,True),('σ*2s',1,False)]
    if not first:
        p=[('π2p',2,True),('σ2p',1,True)] if name in ('li2','b2','c2','n2') else [('σ2p',1,True),('π2p',2,True)]
        levels+=p+[('π*2p',2,False),('σ*2p',1,False)]
    remaining=COUNTS[name];rows=[];bonding=antibonding=unpaired=0
    for label,deg,bond in levels:
        count=min(remaining,deg*2);remaining-=count
        occupancy=[[.5]*int(count>i)+[-.5]*int(count>deg+i) for i in range(deg)]
        unpaired+=sum(len(v)==1 for v in occupancy)
        if bond:bonding+=count
        else:antibonding+=count
        rows.append({'label':label,'bonding':bond,'orbitals':occupancy,'electrons':count})
    occupied=[r['label'] for r in rows if r['electrons']]
    empty=[r['label'] for r in rows if any(not spins for spins in r['orbitals'])]
    return {'formula':FORMULAS[name],'name':name,'levels_low_to_high':rows,'valence_electrons':COUNTS[name],
        'bond_order':(bonding-antibonding)/2,'unpaired_electrons':unpaired,
        'magnetism':'paramagnetic' if unpaired else 'diamagnetic','homo':occupied[-1],
        'lumo':empty[0] if empty else None,'model':'Reference-based elementary MO occupation scheme; ordinal levels only',
        'source_url':'https://ocw.mit.edu/courses/5-111sc-principles-of-chemical-science-fall-2014/bceb89367a2924eab97dcb476cec369e_MIT5_111F14_Lec13.pdf',
        'units':{'bond_order':'dimensionless','energy':'not calculated'},
        'assumptions':'Qualitative homonuclear MO ordering with Pauli/Hund filling, not a many-electron eigenproblem or calculated spatial orbital. Li through Ne diagrams omit filled 1s core pairs, which cancel in elementary bond order. B/C/N use π2p below σ2p; O/F/Ne reverse that order. HOMO means highest occupied spatial level; LUMO is the lowest entirely empty spatial orbital within this displayed basis. Open-shell singly occupied levels require spin-resolved frontier interpretation. He2 and Ne2 have zero elementary covalent bond order; this does not exclude weak dispersion-bound dimers.'}
