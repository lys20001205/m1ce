import {V11} from './balance.js';
export function runtimeMode(search=''){
  const q=new URLSearchParams(search),dev=q.get('dev')==='1',test=q.get('test')==='1';
  return Object.freeze({dev,test,isolated:dev||test,namespace:dev?'dev':test?'test':'release'});
}
// Fixed simulation steps. Rendering and WebAudio continue to use their own wall clocks.
export class SimulationClock {
  constructor(){this.accumulator=0;this.steps=0;this.simulated=0;this.game=null;}
  reset(){this.accumulator=0;}
  advance(game,wallSeconds,input={}){
    if(this.game!==game){this.game=game;this.reset();}
    if(game.paused){this.reset();return 0;}
    const raw=Number.isFinite(wallSeconds)?Math.max(0,Math.min(V11.maxFrame,wallSeconds)):0;
    const scale=game.dev&&[1,2,4].includes(game.timeScale)?game.timeScale:1;
    this.accumulator+=raw*scale;let count=0;
    while(this.accumulator+1e-9>=V11.step&&count<16){game.step(V11.step,input);this.accumulator=Math.max(0,this.accumulator-V11.step);this.steps++;this.simulated+=V11.step;count++;}
    return count;
  }
  snapshot(){return{steps:this.steps,simulated:this.simulated,accumulator:this.accumulator};}
}
