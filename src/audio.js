// Original synthesized cues, no downloaded audio and no autoplay dependency.
export class AudioCues {
  constructor(){this.enabled=false;this.context=null;this.active=false;this.lastPulse=-99;try{this.enabled=localStorage.getItem('roundhouse_sound')==='yes';}catch{}}
  async unlock(){if(!this.enabled)return;try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;this.context??=new C();await this.context.resume();}catch{this.enabled=false;}}
  async toggle(){this.enabled=!this.enabled;try{localStorage.setItem('roundhouse_sound',this.enabled?'yes':'no');}catch{}await this.unlock();if(!this.enabled)this.silence();return this.enabled;}
  tone(f,d=.12,delay=0,volume=.035){const c=this.context;if(!this.enabled||!this.active||!c||c.state!=='running')return;const t=c.currentTime+delay,o=c.createOscillator(),gain=c.createGain();o.type='triangle';o.frequency.setValueAtTime(f,t);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+.012);gain.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(gain);gain.connect(c.destination);o.start(t);o.stop(t+d+.01);o.onended=()=>{o.disconnect();gain.disconnect();};}
  event(type){if(type==='engine_recovered'){[196,294,392,587].forEach((f,i)=>this.tone(f,.16,i*.10));}else if(type==='cargo_recovered'){this.tone(520);this.tone(780,.16,.10);}else if(type==='round_complete'){[262,330,392].forEach((f,i)=>this.tone(f,.25,i*.12));}else if(['hazard_warning','engine_stalled','engine_fault_warning'].includes(type)){this.tone(220,.18);this.tone(330,.18,.22);}else if(type==='repair_complete')this.tone(480,.10);}
  update(g){this.active=!document.hidden&&!g.paused&&['running','arriving','complete','practice_complete'].includes(g.status);if(!this.enabled||!this.active)return;if((g.engineState==='stalled'||g.player.hp<=20)&&g.elapsed-this.lastPulse>1.1){this.lastPulse=g.elapsed;this.tone(110,.10,0,.02);}}
  silence(){this.active=false;this.context?.suspend().catch(()=>{});}
}
