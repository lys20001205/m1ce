"""Verify that the public Pages bytes are the exact site approved by this workflow."""
import hashlib,json,os,time
from datetime import datetime,timezone
from pathlib import Path
from urllib.request import Request,urlopen

FILES=['build.json','index.html','src/main.js','src/design_ui.js','src/design.css','src/control_ui.js','src/mobile_art.css','src/polish3d.js','src/telemetry_contract.js','assets/train-cutaway.json']

def verify(base,gate,fetch):
    if base.rstrip('/')!='https://lys20001205.github.io/m1ce':raise ValueError('unexpected Pages origin')
    if gate.get('passed') is not True:raise ValueError('no successful release gate')
    hashes={};build=None
    for name in FILES:
        data=fetch(base.rstrip('/')+'/'+name+'?verify='+gate['commit'])
        digest=hashlib.sha256(data).hexdigest()
        if digest!=gate['distSHA256'][name]:raise ValueError('public artifact mismatch: '+name)
        hashes[name]=digest
        if name=='build.json':build=json.loads(data)
    if build.get('commit')!=gate['commit']:raise ValueError('public build commit mismatch')
    return {'passed':True,'url':base,'commit':gate['commit'],'build':build,'verifiedSHA256':hashes}

def main():
    gate=json.loads(Path('proof/release-gate.json').read_text())
    if gate['commit']!=os.environ['GITHUB_SHA']:raise SystemExit('workflow/gate commit mismatch')
    def fetch(url):
        with urlopen(Request(url,headers={'Cache-Control':'no-cache','Accept-Encoding':'identity'}),timeout=15) as response:return response.read()
    result={'passed':False,'commit':gate['commit'],'attempts':[]}
    for attempt in range(1,21):
        try:
            result.update(verify(os.environ['PAGES_URL'],gate,fetch));result['attempt']=attempt;break
        except Exception as error:
            result['attempts'].append(str(error));print('Pages propagation check',attempt,str(error),flush=True)
            if attempt<20:time.sleep(6)
    result['verifiedAt']=datetime.now(timezone.utc).isoformat()
    Path('pages-verification.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2));raise SystemExit(0 if result['passed'] else 1)
if __name__=='__main__':main()
