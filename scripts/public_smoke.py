"""Run real scientific HTTP checks against a container or deployed public HTTPS URL."""
import argparse
import json
from pathlib import Path
import time
from urllib.error import HTTPError
from urllib.parse import urlencode,urlsplit
from urllib.request import Request,urlopen


def verify(base,require_https=False):
    if require_https and urlsplit(base).scheme!='https':raise ValueError('External verification requires the actual HTTPS deployment URL')
    records=[]
    def request(path,parameters=None,expected=200,method='GET'):
        start=time.perf_counter();url=base.rstrip('/')+path+('?' + urlencode(parameters) if parameters else '')
        try:
            with urlopen(Request(url,method=method),timeout=20) as response:status=response.status;headers=dict(response.headers);raw=response.read()
        except HTTPError as error:
            with error:status=error.code;headers=dict(error.headers);raw=error.read()
        if status!=expected:raise AssertionError(f'{path}: expected {expected}, got {status}: {raw[:300]!r}')
        record={'path':path,'method':method,'status':status,'wall_seconds':time.perf_counter()-start,'response_bytes':len(raw),'cache':headers.get('x-qal-cache',headers.get('X-QAL-Cache'))}
        records.append(record)
        return json.loads(raw) if 'application/json' in headers.get('Content-Type',headers.get('content-type','')) else raw
    health=request('/api/health');assert health['mode']=='public' and health['frontend_ready']
    index=request('/');assert b'Quantum Atom Lab' in index
    assert len(request('/api/elements'))==118
    assert request('/api/species',{'z':26})['protons']==26
    for n,l,m in ((1,0,0),(2,1,0),(3,2,2),(4,3,-2),(8,3,2)):
        params={'n':n,'l':l,'m':m,'quality':'preview','points':5000,'mode':'surface','nodes':'true'}
        value=request('/api/orbital',params);assert value['grid_size']==49 and value['surfaces']
        again=request('/api/orbital',params);assert value['label']==again['label']
    molecular=request('/api/molecular',{'quality':'preview','optimize':'true'});assert molecular['grid_size']==41
    assert request('/api/molecular/diagram',{'name':'o2'})['name']=='o2'
    request('/api/spectroscopy');request('/api/measurement',{'count':2000});request('/api/dynamics/superposition')
    request('/api/physics',{'operation':'lindblad'});request('/api/physics',{'operation':'bands'})
    request('/api/jobs',expected=503,method='POST');request('/api/computation/pyscf',expected=503)
    request('/api/orbital',{'n':0},expected=400)
    return {'base_url':base,'https_verified':urlsplit(base).scheme=='https','health':health,'records':records,
            'scope':'Real HTTP/scientific checks. Browser/WebGL and external reachability require their separate checks; localhost/container success is not a public deployment.'}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('url');parser.add_argument('--require-https',action='store_true');parser.add_argument('--output',type=Path);args=parser.parse_args()
    data=verify(args.url,args.require_https)
    if args.output:args.output.write_text(json.dumps(data,indent=2)+'\n')
    print(json.dumps({'base_url':data['base_url'],'checks':len(data['records']),'https_verified':data['https_verified'],'statuses':sorted(set(r['status'] for r in data['records']))},indent=2))
