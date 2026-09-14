import * as T from '../vendor/three.module.min.js';
import {V11} from './balance.js';
// Model dressing and animation only. Enemy decisions and damage never live here.
export class ActorPresentation {
  constructor(view){this.view=view;}
  decorateEnemy(rig){
    const v=this.view,kits={};
    for(const type of Object.keys(V11.enemies)){const group=new T.Group();group.name='EnemyKit-'+type;rig.add(group);kits[type]=group;}
    v.box(kits.boarder,-.13,1.12,.3,.24,.14,.10,0xea8d64);
    for(const x of [-.38,.38]){v.box(kits.clinger,x,.75,-.35,.12,.75,.15,0x94b9d9);v.box(kits.clinger,x,1.16,-.25,.15,.13,.45,0x94b9d9);}
    v.box(kits.thief,-.1,.9,-.38,.58,.58,.36,0x8ca860);v.box(kits.thief,0,1.70,0,.64,.10,.55,0x374c3c);
    v.box(kits.saboteur,0,1.72,0,.64,.16,.56,0xe8b752);v.box(kits.saboteur,-.39,.78,.15,.22,.40,.30,0xe8b752);v.box(kits.saboteur,.35,1.24,.13,.25,.20,.27,0x4f606a);
    v.box(kits.bruiser,0,1.0,.25,.88,.64,.24,0x74848b);for(const x of [-.46,.46])v.box(kits.bruiser,x,1.24,0,.30,.36,.58,0x8b9290);v.box(kits.bruiser,0,1.49,.30,.62,.27,.16,0x525d63);
    rig.userData.enemyKits=kits;
  }
  enemy(rig,e){
    const kits=rig.userData.enemyKits;for(const [type,group] of Object.entries(kits))group.visible=type===e.type;
    const base=e.type==='bruiser'?1.28:e.type==='clinger'?.91:1;rig.scale.setScalar(base*(e.flash>0?1.06:1));
    if(e.wind>0)rig.userData.arm.rotation.z=-.25-(e.wind/V11.enemies[e.type].windup)*1.30;
    if(e.state==='attach'||e.state==='climb'){rig.userData.arm.rotation.z=-1.6;rig.userData.legL.rotation.z=.6;rig.userData.legR.rotation.z=-.6;}
  }
}
