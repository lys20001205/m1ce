import {BUILD} from './balance.js';
import {ROUTES,LIFE,LAYER,SPEED_MODES,ENEMIES,WEAPONS} from './content.js';

export const V11_FINAL_SNAPSHOT_FIELDS=Object.freeze(['route','speedMode','routeProgress','playerLayer','playerLifeState','respawnRemaining','cargoUsed','cargoCapacity','cargoValue','scrap','meleeTier','rangedTier','batteryCharge','threatCurrent','threatCap','dev']);
export const V11_TELEMETRY_EVENTS=Object.freeze([
  'route_select','route_repeat','car_select','speed_change','emergency_stop','depot_enter','depot_exit',
  'cargo_pickup','cargo_full_block','cargo_loaded','cargo_drop','cargo_lost','cargo_recovered','cargo_secured_at_dock',
  'train_lost','player_death','respawn_start','respawn_complete','respawn_cancel_engine_failure',
  'enemy_spawn','enemy_hit','enemy_kill','enemy_killed','scrap_gain','armory_open','armory_purchase',
  'combat_tier_unlock','ranged_unlock','engine_state','engine_stalled','engine_recovered','engine_failed',
  'repair_started','repair_complete','audio_unlock_attempt','audio_context_state','audio_first_sound',
  'audio_resume_error','audio_unlock_error','mute_change','round_complete','cashout','one_more_round',
  'prep_purchase','prep_equip','prep_use'
]);
const eventNames=new Set([...V11_TELEMETRY_EVENTS,
  'boot','attack','battery_state','car_damage','cargo_stolen','cash_out','clutch_save','critical_enter','critical_exit',
  'depart','depot_board_blocked','dev_action','enemy_windup','engine_fault_active','engine_fault_ended','engine_fault_warning',
  'fault_resolved','hazard_hit','hazard_warning','hidden','input_down','input_up','layer','models_loaded','pause','resume',
  'player_damage','player_health_band','player_near_death','practice_complete','projectile_spawn','recovery_started',
  'repair_interrupted','route_arrived','route_segment_enter','run_failed','runtime_error','spawn','success_feedback',
  'telemetry_consent','thief_escaping','thief_pickup','viewport','visible','workshop_fault_repaired','workshop_heal'
]);
const tokens=new Set([
  ...Object.keys(ROUTES),...Object.values(LIFE),...Object.values(LAYER),...SPEED_MODES,...Object.keys(ENEMIES),
  ...Object.values(WEAPONS).flat().map(w=>w.id),'melee','ranged','engine','battery','workshop','cargo','player','system',
  'reroll','repairKit','intel','running','suspended','interrupted','closed','not_created','unavailable',
  'ready','arriving','complete','lost','cashed','practice_complete','run','practice','normal','damaged','critical','stalled',
  'absent','offline','emergency','flicker','warning','idle','cruise','fast','off','crane','tunnel',
  'dock','depart','yard','approach','return','hp_zero','train_lost','engine_timeout','thief_escape','player_death_depot',
  'death','repair','workshop_local_service','gesture','start','route_gesture','recovery_gesture','pageshow','visible',
  'mute_button','console','battery_empty','emergency_stop','dev_console_override'
]);
const stateNumbers=['routeProgress','respawnRemaining','cargoUsed','cargoCapacity','cargoValue','scrap','meleeTier','rangedTier',
  'batteryCharge','threatCurrent','threatCap','round','elapsed','px','playerHp','engineHp','bank','money','repeatPressure',
  'enemyCount','batteryCapacity','deathCount','spawnProtection','drawCalls','triangles','activeMeshes',
  'routeSegmentsVisible','pooledEnemies','DPR','frameDeltaP50','frameDeltaP95'];
const eventNumbers=['seq','ms','round','time','amount','total','cost','tier','id','enemy','crate','car','value','used','capacity',
  'hp','x','y','z','damage','seconds','remaining','window','travel','repairTime','bank','money','cars','load','cap','attempt','rms'];
const eventStrings=['enemy_type','weapon','slot','route','from','to','speed','reason','source','layer','target','system','context','state','item','hazard','segment'];
const number=v=>typeof v==='number'&&Number.isFinite(v)?Math.round(v*1000)/1000:undefined;
function numbers(source,keys,target){for(const key of keys){const value=number(source[key]);if(value!==undefined)target[key]=value;}}
function enums(source,keys,target){for(const key of keys)if(tokens.has(source[key]))target[key]=source[key];}

// Full renderer snapshots and diagnostic strings stay local. Transport has an explicit,
// bounded allowlist, so adding a new debug field cannot silently leak it or break upload.
export function networkSnapshot(source={}){
  const out={build:BUILD,dev:source.dev===true};
  numbers(source,stateNumbers,out);
  enums(source,['route','speedMode','playerLayer','playerLifeState','engineState','status','mode'],out);
  if(source.route===null)out.route=null;
  for(const key of ['paused','terminalDestroyed','test','standalone'])if(typeof source[key]==='boolean')out[key]=source[key];
  if(source.audio){const a={};numbers(source.audio,['master','outputRMS','engineFrequency'],a);enums(source.audio,['context','engineLoop'],a);if(typeof source.audio.muted==='boolean')a.muted=source.audio.muted;out.audio=a;}
  return out;
}
export function networkEvent(source={}){
  const out={type:eventNames.has(source.type)?source.type:'other',dev:source.dev===true,test:source.test===true};
  numbers(source,eventNumbers,out);enums(source,eventStrings,out);
  for(const key of ['roof','muted','enabled','reinforcement'])if(typeof source[key]==='boolean')out[key]=source[key];
  return out;
}
