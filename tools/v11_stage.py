"""V11-M bounded release closure. Source hashes bind the already validated L tree."""
from pathlib import Path
import hashlib
checks={'src/main.js':['20ace56f219d21595735e6732283507987f4069f9edcfe24074caa5e150eb542','1c3befa4312ae14234a9c7b7c76e457aca2080205929f717ed68244ef1e0d99f'],'src/balance.js':['c061c88215a92e29392fca9c3fb10c9a79f02e1807fea0c45a3ae29d1c5df857','1fb9d44491c31a65a7f6e384561f79729ba1bebd002e570fef47cf5c3ed5f22a'],'tools/build.mjs':['69a9dcaccacb6ef48c3e24996f158488114dcac52befac86a70b645adc949117','6a9e34a1b01943b810d8f7338f2cebed9f79814a5f771c85ddef89ca6141e0e5']}
for n,(a,b) in checks.items():assert hashlib.sha256(Path(n).read_bytes()).hexdigest()==a,'BASE '+n
p=Path('src/main.js');p.write_text(p.read_text().replace("if(new URLSearchParams(location.search).has('test'))window.__RH_TEST","if(mode.test)window.__RH_TEST"))
p=Path('src/balance.js');s=p.read_text().replace('// V10 playtest values, not measured completion-rate claims. One source for tuning.','// Prototype tuning, not measured completion-rate claims. One source for all gameplay numbers.').replace('V11-L-REGRESSION-20260916','V11-RELEASE-20260917').replace('// V11 contract tuning. Kept separate during the validated V10 -> V11 handover.','// V11 route / life / progression tuning.');p.write_text(s)
p=Path('tools/build.mjs');s=p.read_text().replace("import fs from 'node:fs';","import fs from 'node:fs';\nimport {execFileSync} from 'node:child_process';")
s=s.replace("['ASSET_LICENSES.md','AUDIT_V9R1.md','V10_CHANGELOG.md']","['ASSET_LICENSES.md','AUDIT_V9R1.md','V10_CHANGELOG.md','V11_CHANGELOG.md','V11_RELEASE.md']")
s=s.replace('const info={build:BUILD,',"let commit=process.env.GITHUB_SHA||'';try{if(!commit)commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{}\nconst info={build:BUILD,commit,version:'11.0.0',")
p.write_text(s)
for n,(a,b) in checks.items():assert hashlib.sha256(Path(n).read_bytes()).hexdigest()==b,'OUTPUT '+n
print('V11-M exact source closure applied. Clean, non-mutating final CI remains mandatory before master.')
