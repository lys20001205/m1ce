"""V11-L Telemetry / Regression migration. Applied only on the work branch before validation."""
from pathlib import Path


def change(path, old, new, count=1):
    p=Path(path);s=p.read_text()
    if old not in s: raise SystemExit(f'MISSING PATTERN {path}: {old[:90]!r}')
    p.write_text(s.replace(old,new,count))

change('src/balance.js',"export const BUILD = 'V11-K-PREP-20260916';","export const BUILD = 'V11-L-REGRESSION-20260916';")

p=Path('src/sim.js');s=p.read_text()
old='lastMuzzle:this.lastMuzzle,threat:this.director.snapshot(this),stats:{...this.total}'
new='lastMuzzle:this.lastMuzzle,threatCurrent:this.director.snapshot(this).actual,threatCap:this.director.snapshot(this).cap,threat:this.director.snapshot(this),stats:{...this.total}'
if old not in s: raise SystemExit('V11-L snapshot insertion point missing')
p.write_text(s.replace(old,new,1))

p=Path('src/telemetry.js');s=p.read_text()
marker="import {BUILD} from './sim.js?v=11';\n"
contract="""export const V11_FINAL_SNAPSHOT_FIELDS=Object.freeze(['route','speedMode','routeProgress','playerLayer','playerLifeState','respawnRemaining','cargoUsed','cargoCapacity','cargoValue','scrap','meleeTier','rangedTier','batteryCharge','threatCurrent','threatCap','dev']);
export const V11_TELEMETRY_EVENTS=Object.freeze(['route_select','route_repeat','car_select','speed_change','emergency_stop','depot_enter','depot_exit','cargo_pickup','cargo_loaded','cargo_drop','cargo_lost','cargo_recovered','cargo_secured_at_dock','train_lost','player_death','respawn_start','respawn_complete','enemy_hit','enemy_kill','enemy_killed','scrap_gain','armory_open','armory_purchase','combat_tier_unlock','ranged_unlock','engine_state','engine_stalled','engine_recovered','engine_failed','repair_started','repair_complete','audio_unlock_attempt','audio_context_state','audio_first_sound','audio_resume_error','audio_unlock_error','mute_change','round_complete','cashout','one_more_round','prep_purchase','prep_equip','prep_use']);
"""
if 'V11_FINAL_SNAPSHOT_FIELDS' not in s:
    if marker not in s: raise SystemExit('telemetry import marker missing')
    s=s.replace(marker,marker+contract,1)
s=s.replace("report(){return{dev:this.dev,test:this.test,v:BUILD", "report(){return{contract:'V11-L',dev:this.dev,test:this.test,v:BUILD",1)
p.write_text(s)

p=Path('package.json');s=p.read_text().replace('"version": "10.0.0"','"version": "11.0.0"',1)
if 'tests/release_contract.test.mjs' not in s:s=s.replace('tests/prep.test.mjs','tests/prep.test.mjs tests/release_contract.test.mjs')
p.write_text(s)

p=Path('package-lock.json');s=p.read_text().replace('"version":"10.0.0"','"version":"11.0.0"')
p.write_text(s)

p=Path('docs/V11_MIGRATIONS.md');s=p.read_text()
section="""
## V11-L
Final telemetry exposes the frozen gameplay snapshot contract directly, including `threatCurrent` and `threatCap`. Release regression covers the three frozen landscape sizes, long-consist framing, orientation/lifecycle input recovery, and the stitched Freight -> Depot -> TRAIN LOST -> Respawn -> Scrap -> Armory -> FAST -> Roundhouse -> Cash Out -> Prep Shop loop in Chromium and WebKit. Final deployment still requires a clean no-staging validation pass.
"""
if '## V11-L' not in s:p.write_text(s+section)
print('V11-L Telemetry / Regression migration applied')
