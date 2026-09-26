"""Fail-closed release gate. Missing reports, skips, false checks or mutated source prohibit Pages."""
import hashlib,json,os,re,subprocess
from pathlib import Path

ROOT=Path('.');ART=ROOT/'artifacts'
SUITES={'':53,'v11':41,'audio':12,'combat':17,'depot':11,'dev':19,'enemies':11,'life':11,'prep':12,'release':21,'train':10,'ship':11,'qa':42,'muzzle':39,'lifecycle':44,'design':67,'mobile-art':49}

def inspect(art=ART):
    failures=[];totals={};reports={}
    for browser in ['chromium','webkit']:
        totals[browser]=0
        for suffix,minimum in SUITES.items():
            name=f'{browser}-'+(suffix+'-' if suffix else '')+'report.json'
            try:
                d=json.loads((art/name).read_text());checks=d['checks']
                if d.get('browser')!=browser or d.get('passed') is not True or len(checks)<minimum or any(v is not True for v in checks.values()) or d.get('errors') or d.get('exception'):
                    failures.append(name+': incomplete or failed assertions')
                totals[browser]+=len(checks);reports[name]=len(checks)
            except Exception as e:failures.append(name+': '+str(e))
    tap={}
    for name,minimum in [('unit.txt',325),('model-tests.txt',6)]:
        try:
            text=(art/name).read_text();stats={k:int(re.search(r'^# '+k+r' (\d+)\s*$',text,re.M).group(1)) for k in ['tests','pass','fail','cancelled','skipped','todo']}
            if stats['tests']<minimum or stats['pass']!=stats['tests'] or any(stats[k] for k in ['fail','cancelled','skipped','todo']):failures.append(name+': nonpassing TAP')
            tap[name]=stats
        except Exception as e:failures.append(name+': '+str(e))
    return {'passed':not failures,'failures':failures,'browserChecks':totals,'reports':reports,'unit':tap}

def main():
    result=inspect();sha=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip();result['commit']=sha
    if os.environ.get('GITHUB_SHA',sha)!=sha:result['failures'].append('checkout differs from triggering commit')
    for p in ['tools/v11_stage.py','tools/v11_followup.py']:
        if Path(p).exists():result['failures'].append('staging utility remains: '+p)
    dirty=subprocess.run(['git','diff','--exit-code','--','.'],capture_output=True,text=True)
    if dirty.returncode:result['failures'].append('tracked source changed during validation')
    build=json.loads(Path('dist/build.json').read_text());result['build']=build
    if build.get('commit')!=sha or build.get('version')!='11.0.0' or build.get('build')!='V11-RELEASE-20260917':result['failures'].append('built site provenance mismatch')
    result['distSHA256']={str(p.relative_to('dist')):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(Path('dist').rglob('*')) if p.is_file()}
    result['passed']=not result['failures'];(ART/'release-gate.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2));raise SystemExit(0 if result['passed'] else 1)
if __name__=='__main__':main()
