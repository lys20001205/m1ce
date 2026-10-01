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
    for(const type of ['smg','rifle','shotgun']){
      const gun=new T.Group();gun.name=type==='smg'?'SMG':type==='shotgun'?'Shotgun':'PiercingRifle';d.gunArm.add(gun);d.rangedModels[type]=gun;
      const spec=V11.weapons[type];
      v.box(gun,.64,0,0,.48,.16,.16,type==='smg'?0x4a6975:type==='shotgun'?0x936d47:0x607361);
      v.box(gun,.58,-.18,0,.11,.30,.10,0x283c46);
      if(type==='shotgun'){
        for(const z of [-.07,.07])v.box(gun,.95,0,z,.24,.105,.065,0xb8bfc5);
        v.box(gun,.73,-.10,0,.23,.09,.19,0xc89555);v.box(gun,.32,-.035,0,.24,.18,.17,0x735132);
      }
      else if(type==='smg')v.box(gun,.97,0,0,.16,.09,.10,0x9baab0);
      else{v.box(gun,1.13,0,0,.40,.08,.09,0xb3bbac);v.box(gun,.30,-.03,0,.30,.18,.14,0x70694e);v.box(gun,.70,.16,0,.28,.10,.11,0x273943);}
      const socket=new T.Object3D();socket.name='Muzzle';socket.position.x=spec.muzzle;gun.add(socket);
    }
    const kit=new T.Group();kit.name='Player-visual-kit';rig.add(kit);
    v.box(kit,0,1.43,.32,.56,.18,.18,0x55c9dd);v.box(kit,0,1.80,.30,.38,.08,.27,0xd6fbff);
    for(const x of [-.37,.37])v.box(kit,x,1.37,.23,.18,.12,.28,0x2c6b7d);
    v.box(kit,-.02,.92,-.30,.54,.60,.12,0x173540);v.box(kit,0,1.12,-.37,.30,.08,.18,0xe9bd72);
    d.playerKit=kit;d.wrench=wrench;d.activeMuzzle=d.rangedModels.handgun.getObjectByName('Muzzle');
  }
  player(rig,p){
    const d=rig.userData,g=this.view.game,repair=!!g.repairJob,carried=!!p.carry;
    for(const [id,m] of Object.entries(d.meleeModels))m.visible=!carried&&id===(repair?'wrench':g.melee.id);
    for(const [id,m] of Object.entries(d.rangedModels))m.visible=!carried&&!repair&&id===g.ranged?.id;
    const duration=p.meleeAttack?.duration||g.meleeStats.duration;
    d.arm.rotation.z=p.swing>0?1.20-(1-p.swing/duration)*2.3:-.20;
    if(repair)d.arm.rotation.z=-.3+Math.sin(g.elapsed*16)*.18;
    d.gunArm.rotation.z=0;d.activeMuzzle=(d.rangedModels[g.ranged?.id||'handgun']).getObjectByName('Muzzle');
    if(d.playerKit)d.playerKit.rotation.z=this.view.reducedMotion?0:Math.sin(g.elapsed*8)*.012;
    rig.scale.setScalar(V11.rig.scale);
  }
  decorateEnemy(rig){
    const v=this.view,kits={};
    for(const type of Object.keys(V11.enemies)){const group=new T.Group();group.name='EnemyKit-'+type;rig.add(group);kits[type]=group;}
    for(const x of [-.34,.34])v.box(kits.boarder,x,1.32,.24,.23,.18,.30,0xc95f50);
    v.box(kits.boarder,-.13,1.12,.3,.26,.16,.12,0xf09a6f);v.box(kits.boarder,0,1.68,.25,.46,.07,.30,0xffc08c);
    for(const x of [-.40,.40]){v.box(kits.clinger,x,.75,-.35,.13,.76,.16,0x79a8d2);v.box(kits.clinger,x,1.18,-.25,.16,.14,.48,0x9dc8ed);v.box(kits.clinger,x*1.35,1.45,.18,.34,.07,.08,0xc5e5ff);}
    v.box(kits.thief,-.1,.94,-.42,.66,.66,.42,0x708d4f);v.box(kits.thief,0,1.70,0,.66,.11,.57,0x314334);v.box(kits.thief,.28,1.08,.34,.09,.72,.08,0xd1d26f);
    v.box(kits.saboteur,0,1.72,0,.66,.17,.58,0xe2ad40);v.box(kits.saboteur,-.39,.78,.15,.23,.42,.32,0xf0bd4b);v.box(kits.saboteur,.35,1.24,.13,.27,.22,.29,0x435965);
    v.box(kits.saboteur,-.28,1.20,-.38,.38,.70,.18,0x8a6130);v.box(kits.saboteur,-.28,1.75,-.38,.06,.52,.06,0xf4d36f);
    v.box(kits.bruiser,0,1.0,.25,.92,.68,.26,0x657880);for(const x of [-.50,.50]){v.box(kits.bruiser,x,1.28,0,.34,.42,.62,0x7f9298);v.box(kits.bruiser,x,.85,.25,.27,.62,.28,0x515f66);}v.box(kits.bruiser,0,1.52,.30,.66,.30,.18,0x46535a);
    rig.userData.enemyKits=kits;
  }
  enemy(rig,e){
    const kits=rig.userData.enemyKits;for(const [type,group] of Object.entries(kits))group.visible=type===e.type;
    const base=e.type==='bruiser'?1.30:e.type==='clinger'?.92:1;rig.scale.setScalar(base*(e.flash>0?1.06:1));
    if(e.wind>0)rig.userData.arm.rotation.z=-.25-(e.wind/V11.enemies[e.type].windup)*1.30;
    if(e.state==='attach'||e.state==='climb'){rig.userData.arm.rotation.z=-1.6;rig.userData.legL.rotation.z=.6;rig.userData.legR.rotation.z=-.6;}
  }
}
