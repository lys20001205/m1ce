// Original procedural audio. Audio time is independent of simulation time and DEV speed.
// No downloaded samples, microphone, streaming, or remote resources.
const CUES=Object.freeze({
  wrench:[360,.13,.10,'triangle',100],knife:[850,.065,.075,'triangle',190],axe:[190,.21,.12,'sawtooth',65],
  handgun:[150,.12,.13,'square',40],smg:[230,.065,.095,'square',50],rifle:[90,.24,.15,'sawtooth',35],
  enemy_hit:[300,.08,.07,'triangle',95],enemy_death:[180,.22,.075,'sawtooth',40],
  cargo_pickup:[420,.14,.10,'sine',680],cargo_drop:[280,.15,.10,'triangle',140],scrap_gain:[880,.17,.09,'sine',1320],
  repair:[540,.09,.06,'triangle',750],engine_warning:[430,.24,.09,'square',330],engine_restart:[140,.6,.12,'triangle',580],
  crane_alarm:[700,.34,.09,'square',450],tunnel_enter:[170,.5,.065,'sine',65],turntable:[95,.55,.08,'sawtooth',140],
  route_select:[470,.18,.09,'sine',710],armory_buy:[640,.25,.10,'triangle',1080],
  cashout:[520,.6,.10,'triangle',1040],one_more_round:[330,.35,.09,'triangle',660],round_complete:[392,.45,.09,'sine',784],
  player_death:[250,.5,.10,'triangle',55],train_lost:[390,.6,.12,'sawtooth',60],respawn:[220,.65,.10,'sine',880],test:[660,.35,.12,'sine',990]
});
const EVENTS=Object.freeze({enemy_hit:'enemy_hit',enemy_kill:'enemy_death',cargo_pickup:'cargo_pickup',cargo_drop:'cargo_drop',
  scrap_gain:'scrap_gain',repair_complete:'repair',repair_started:'repair',engine_stalled:'engine_warning',engine_critical:'engine_warning',
  engine_recovered:'engine_restart',critical_enter:'engine_warning',engine_fault_warning:'engine_warning',route_select:'route_select',depart:'turntable',
  armory_purchase:'armory_buy',cashout:'cashout',one_more_round:'one_more_round',round_complete:'round_complete',
  player_death:'player_death',train_lost:'train_lost',respawn_complete:'respawn'});
export class AudioCues {
  constructor({emit=()=>{},enabled=true,contextFactory=null,hidden=()=>typeof document!=='undefined'&&document.hidden}={}){
    this.emit=emit;this.enabled=enabled;this.contextFactory=contextFactory;this.hidden=hidden;
    this.context=null;this.active=false;this.quiet=false;this.lastSfx=null;this.engineLoop='off';this.voices=new Set();this.pending=[];
    this.unlockAttempts=0;this.resumeRequested=0;this.firstSound=false;this.outputRMS=0;this.nextRail=0;this.nextRepair=0;this.nextAlarm=0;
  }
  createGraph(){
    if(this.context&&this.context.state!=='closed')return;
    const Factory=this.contextFactory||(()=>{const C=globalThis.AudioContext||globalThis.webkitAudioContext;return C?new C({latencyHint:'interactive'}):null;});
    const c=Factory();if(!c)return;this.context=c;
    this.master=c.createGain();this.master.gain.value=this.enabled?1:0;
    this.buses={};for(const [name,value] of [['music',.25],['ambience',.45],['sfx',.80]]){const node=c.createGain();node.gain.value=value;node.connect(this.master);this.buses[name]=node;}
    this.limiter=c.createDynamicsCompressor();this.limiter.threshold.value=-10;this.limiter.knee.value=12;this.limiter.ratio.value=8;
    this.analyser=c.createAnalyser();this.analyser.fftSize=1024;this.wave=new Float32Array(this.analyser.fftSize);
    this.master.connect(this.limiter);this.limiter.connect(this.analyser);this.analyser.connect(c.destination);
    const buffer=c.createBuffer(1,c.sampleRate,c.sampleRate),samples=buffer.getChannelData(0);let seed=0x52484f55;
    for(let i=0;i<samples.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;samples[i]=(seed/4294967296)*2-1;}this.noiseBuffer=buffer;
    this.engineGain=c.createGain();this.engineGain.gain.value=0;this.engineGain.connect(this.buses.ambience);
    this.engineFilter=c.createBiquadFilter();this.engineFilter.type='lowpass';this.engineFilter.frequency.value=700;this.engineFilter.connect(this.engineGain);
    this.engineOsc=c.createOscillator();this.engineOsc.type='sawtooth';this.engineOsc.frequency.value=90;this.engineOsc.connect(this.engineFilter);this.engineOsc.start();
    this.engineHarmonic=c.createOscillator();this.engineHarmonic.type='triangle';this.engineHarmonic.frequency.value=180;this.engineHarmonic.connect(this.engineFilter);this.engineHarmonic.start();
    this.tunnelGain=c.createGain();this.tunnelGain.gain.value=0;this.tunnelGain.connect(this.buses.ambience);
    const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=420;filter.connect(this.tunnelGain);
    this.tunnelNoise=c.createBufferSource();this.tunnelNoise.buffer=buffer;this.tunnelNoise.loop=true;this.tunnelNoise.connect(filter);this.tunnelNoise.start();
    this.musicGain=c.createGain();this.musicGain.gain.value=0;this.musicGain.connect(this.buses.music);
    for(const hz of [110,164.81]){const o=c.createOscillator();o.type='sine';o.frequency.value=hz;o.connect(this.musicGain);o.start();}
    c.onstatechange=()=>{this.emit('audio_context_state',{state:c.state});if(c.state==='running')this.drainPending();};
  }
  // Called synchronously from START / DEV START / sound button. Never await before resume().
  unlock(reason='gesture'){
    this.unlockAttempts++;this.quiet=false;
    try{
      this.createGraph();const c=this.context;
      this.emit('audio_unlock_attempt',{reason,context:c?.state||'unavailable',attempt:this.unlockAttempts});
      if(!c)return false;
      this.resumeRequested++;const promise=c.resume();
      Promise.resolve(promise).then(()=>{this.emit('audio_context_state',{state:c.state});this.drainPending();}).catch(()=>this.emit('audio_resume_error',{state:c.state}));
      return true;
    }catch{this.emit('audio_unlock_error',{context:this.context?.state||'unavailable'});return false;}
  }
  restore(reason='lifecycle'){if(this.context&&!this.hidden()&&this.context.state!=='running')this.unlock(reason);else if(!this.hidden())this.quiet=false;}
  setEnabled(value){this.enabled=!!value;if(this.master){this.master.gain.cancelScheduledValues(this.context.currentTime);this.master.gain.setValueAtTime(this.enabled?1:0,this.context.currentTime);}this.emit('mute_change',{muted:!this.enabled});return this.enabled;}
  toggle(){this.setEnabled(!this.enabled);if(this.enabled)this.unlock('mute_button');return this.enabled;}
  play(name,{bus='sfx',record=true,delay=0}={}){
    const spec=CUES[name];if(!spec||!this.enabled)return false;
    const c=this.context;if(!c||c.state!=='running'){
      if(record&&c){this.pending.push({name,bus,record,delay});if(this.pending.length>6)this.pending.shift();}return false;
    }
    if(this.hidden()||this.quiet||this.voices.size>=24)return false;
    const [hz,duration,volume,type,end]=spec,t=c.currentTime+delay,o=c.createOscillator(),gain=c.createGain();
    o.type=type;o.frequency.setValueAtTime(hz,t);o.frequency.exponentialRampToValueAtTime(end,t+duration);
    gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(volume,t+.006);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    o.connect(gain);gain.connect(this.buses[bus]);const voice={o,gain};this.voices.add(voice);
    o.onended=()=>{o.disconnect();gain.disconnect();this.voices.delete(voice);};o.start(t);o.stop(t+duration+.01);
    if(record)this.lastSfx=name;return true;
  }
  drainPending(){const pending=this.pending.splice(0);for(const cue of pending)this.play(cue.name,cue);}
  event(type,data={}){
    if(type==='route_segment_enter'&&data.segment==='tunnel')return this.play('tunnel_enter');
    if(type==='critical_enter'&&data.system!=='engine')return;
    if(type==='attack')return this.play(data.weapon);
    if(type==='player_death'&&data.reason==='train_lost')return; // TRAIN LOST is already a distinct death cue.
    if(type==='hazard_warning')return this.play(data.hazard==='tunnel'?'tunnel_enter':'crane_alarm');
    const cue=EVENTS[type];if(cue)this.play(cue);
  }
  silence(){this.quiet=true;this.active=false;this.engineLoop='off';if(!this.context)return;const t=this.context.currentTime;
    for(const n of [this.engineGain,this.tunnelGain,this.musicGain]){n.gain.cancelScheduledValues(t);n.gain.setValueAtTime(0,t);}
    for(const v of this.voices){try{v.o.stop();}catch{}}this.pending.length=0;
  }
  update(g){
    const c=this.context;this.active=!this.hidden()&&!this.quiet&&!g.paused&&['running','arriving','complete','cashed','ready','practice_complete'].includes(g.status);
    const running=this.active&&g.status==='running',moving=running&&g.engineState!=='stalled'&&g.speedMode!=='STOP'&&g.elapsed>=3;
    this.engineLoop=!this.active?'off':!moving?'idle':g.speedMode==='FAST'?'fast':'cruise';
    if(!c||c.state!=='running')return;
    const t=c.currentTime,frequency={off:90,idle:90,cruise:140,fast:205}[this.engineLoop];
    this.engineOsc.frequency.setTargetAtTime(frequency,t,.08);this.engineHarmonic.frequency.setTargetAtTime(frequency*2,t,.08);
    this.engineFilter.frequency.setTargetAtTime(moving?950:400,t,.08);
    this.engineGain.gain.setTargetAtTime(this.active?moving?.08:.035:0,t,.05);
    this.tunnelGain.gain.setTargetAtTime(running&&g.phase==='tunnel'?.13:0,t,.15);
    this.musicGain.gain.setTargetAtTime(this.active?.025:0,t,.1);
    if(moving&&t>=this.nextRail){this.play('cargo_drop',{bus:'ambience',record:false});this.nextRail=t+(.44/({SLOW:.35,CRUISE:1,FAST:1.5}[g.speedMode]||1));}
    if(running&&g.repairJob&&t>=this.nextRepair){this.play('repair',{record:false});this.nextRepair=t+.28;}
    if(running&&g.engineState==='stalled'&&t>=this.nextAlarm){this.play('engine_warning',{record:false});this.nextAlarm=t+1.25;}
    this.analyser.getFloatTimeDomainData(this.wave);let sum=0;for(const x of this.wave)sum+=x*x;this.outputRMS=Math.sqrt(sum/this.wave.length);
    if(!this.firstSound&&this.outputRMS>.00005){this.firstSound=true;this.emit('audio_first_sound',{context:c.state,rms:Number(this.outputRMS.toFixed(5))});}
  }
  snapshot(){return{context:this.context?.state||'not_created',master:this.master?.gain.value??(this.enabled?1:0),muted:!this.enabled,engineLoop:this.engineLoop,lastSfx:this.lastSfx,
    resumeRequested:this.resumeRequested,unlockAttempts:this.unlockAttempts,firstSound:this.firstSound,outputRMS:this.outputRMS,engineFrequency:this.engineOsc?.frequency.value||0,voices:this.voices.size,
    buses:this.buses?Object.fromEntries(Object.entries(this.buses).map(([k,v])=>[k,v.gain.value])):{}};}
}
export {CUES as AUDIO_CUES};
