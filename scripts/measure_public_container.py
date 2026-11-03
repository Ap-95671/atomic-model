"""Read only the named Quantum Atom Lab test container's resource evidence."""
import argparse
import json
from pathlib import Path
import re
import subprocess
parser=argparse.ArgumentParser();parser.add_argument('--container',default='qal-railway-check');parser.add_argument('--output',type=Path,default=Path('docs/RAILWAY_CONTAINER_RESOURCES.json'));args=parser.parse_args()
if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*',args.container):parser.error('Use a container name, not CLI options')
def docker(*arguments):return subprocess.check_output(['docker',*arguments],text=True).strip()
config=json.loads(docker('inspect',args.container))[0];image=json.loads(docker('image','inspect',config['Image']))[0]
measurements={}
for field in ('memory.current','memory.peak','cpu.stat'):
    measurements[field]=docker('exec',args.container,'cat','/sys/fs/cgroup/'+field)
usage=json.loads(docker('stats','--no-stream','--format','{{json .}}',args.container))
limits=config['HostConfig'];env=dict(value.split('=',1) for value in config['Config']['Env'])
data={'container':args.container,'source_commit':env.get('RAILWAY_GIT_COMMIT_SHA'),'image_id':config['Image'],'image_bytes':image['Size'],
      'hard_memory_limit_bytes':limits['Memory'],'cpu_nanocpus':limits['NanoCpus'],'pid_limit':limits['PidsLimit'],'read_only_filesystem':limits['ReadonlyRootfs'],
      'user':config['Config']['User'],'health':config['State'].get('Health',{}).get('Status'),'docker_usage':usage,'cgroup':measurements,
      'scope':'Measured Linux/amd64 container on macOS/arm64 Docker emulation, not native Railway performance or a deployed public service. Representative workload, not a universal peak/traffic guarantee.'}
args.output.write_text(json.dumps(data,indent=2)+'\n');print(json.dumps({key:data[key] for key in ('image_bytes','hard_memory_limit_bytes','user','health')},indent=2))
