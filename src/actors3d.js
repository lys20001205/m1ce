import * as T from '../vendor/three.module.min.js';
import {V11} from './balance.js';
// Model dressing and animation only. Enemy decisions and damage never live here.
export class ActorPresentation {
  constructor(view){this.view=view;}
  decoratePlayer(rig){
    const v=this.view,d=rig.userData;
    d.gunArm=d.arm;d.gunArm.name='RangedArm';
    const rear=d.gunArm.clone(true);rear.name='MeleeArm';rear.position.z=-V11.rig.armZ;
    rear.remove(rear.getObjectByName('Sidearm'));rig.add(rear);d.arm=rear;
    const wrench=rear.getObjectByName('Wrench');d.wrench.visible=false;
    const knife=new T.Group(),axe=new T.Group();knife.name='Knife';axe.name='Axe';rear.add(knife,axe);
    v.box(knife,.49,0,0,.26,.10,.10,0x34454c);v.box(knife,.74,0,0,.34,.085,.045,0xdbe3df);
    v.box(axe,.56,0,0,.74,.075,.08,0x775b43);v.box(axe,.88,.08,0,.24,.46,.10,0xc1d0d2);
    d.meleeModels={wrench,knife,axe};d.rangedModels={handgun:d.gun};
    for(const type of ['smg','rifle']){
      const gun=new T.Group();gun.name=type==='smg'?'SMG':'HighDamageRifle';d.gunArm.add(gun);d.rangedModels[type]=gun;
      const spec=V11.weapons[type];
      v.box(gun,.64,0,0,.48,.16,.16,type==='smg'?0x4a6975:0x607361);
      v.box(gun,.58,-.18,0,.11,.30,.10,0x283c46);
      if(type==='smg')v.box(gun,.97,0,0,.16,.09,.10,0x9baab0);
      else{v.box(gun,1.13,0,0,.40,.08,.09,0xb3bbac);v.box(gun,.30,-.03,0,.30,.18,.14,0x70694e);v.box(gun,.70,.16,0,.28,.10,.11,0x273943);}
      const socket=new T.Object3D();socket.name='Muzzle';socket.position.x=spec.muzzle;gun.add(socket);
    }
    d.wrench=wrench;d.activeMuzzle=d.rangedModels.handgun.getObjectByName('Muzzle');
  }
  player(rig,p){
    const d=rig.userData,g=this.view.game,repair=!!g.repairJob,carried=!!p.carry;
    for(const [id,m] of Object.entries(d.meleeModels))m.visible=!carried&&id===(repair?'wrench':g.melee.id);
    for(const [id,m] of Object.entries(d.rangedModels))m.visible=!carried&&!repair&&id===g.ranged?.id;
    const duration=p.meleeAttack?.duration||g.meleeStats.duration;
    d.arm.rotation.z=p.swing>0?1.20-(1-p.swing/duration)*2.3:-.20;
    if(repair)d.arm.rotation.z=-.3+Math.sin(g.elapsed*16)*.18;
    d.gunArm.rotation.z=0;d.activeMuzzle=(d.rangedModels[g.ranged?.id||'handgun']).getObjectByName('Muzzle');
    rig.scale.setScalar(V11.rig.scale);
  }
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
