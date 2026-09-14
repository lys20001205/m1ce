import {runtimeMode} from './runtime.js';
import {V11} from './balance.js';
const nonnegative=v=>Number.isFinite(Number(v))?Math.max(0,Math.floor(Number(v))):0;
export function cleanSave(value={}){
  return{version:11,bank:nonnegative(value.bank),prep:Object.fromEntries(Object.entries(V11.prep).map(([id,spec])=>[id,Math.min(spec.max,nonnegative(value.prep?.[id]))]))};
}
// All preferences, local logs and Bank use this same mode namespace. DEV never reads or writes release keys.
export class SaveStore {
  constructor({mode=runtimeMode(),backend}={}){
    if(backend===undefined){try{backend=globalThis.localStorage;}catch{}}
    this.mode=mode;this.error=null;
    const key=name=>mode.isolated?'roundhouse_'+mode.namespace+'_'+name.replace(/^roundhouse_/,''):name;
    this.storage={getItem:name=>{try{return backend?.getItem(key(name))??null;}catch{return null;}},setItem:(name,value)=>{if(!backend)throw Error('storage_unavailable');backend.setItem(key(name),String(value));},removeItem:name=>backend?.removeItem(key(name))};
  }
  read(){
    try{const raw=this.storage.getItem('roundhouse_save_v11');if(raw!==null)return cleanSave(JSON.parse(raw));}catch{this.error='save_read_failed';}
    return cleanSave({bank:this.storage.getItem('roundhouse_bank')});
  }
  write(game){
    try{this.storage.setItem('roundhouse_save_v11',JSON.stringify(cleanSave(game)));this.error=null;return true;}
    catch{this.error='save_write_failed';return false;}
  }
}
