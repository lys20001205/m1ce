import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import fs from 'node:fs';
const out='dist';fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(`${out}/assets`,{recursive:true});fs.mkdirSync(`${out}/vendor`,{recursive:true});
for(const file of ['index.html','style.css','manifest.webmanifest'])fs.copyFileSync(file,`${out}/${file}`);
fs.cpSync('src',`${out}/src`,{recursive:true});
for(const f of ['three.module.min.js','three.core.min.js'])fs.copyFileSync(`node_modules/three/build/${f}`,`${out}/vendor/${f}`);
fs.copyFileSync('node_modules/three/LICENSE',`${out}/vendor/THREE-LICENSE.txt`);
for(const f of ['ASSET_LICENSES.md','AUDIT_V9R1.md'])if(fs.existsSync(`docs/${f}`))fs.copyFileSync(`docs/${f}`,`${out}/${f}`);
const mats={};const mat=(color)=>mats[color]??=new T.MeshStandardMaterial({color,roughness:.8,metalness:.1,flatShading:true});
const B=new T.BoxGeometry(1,1,1),C=new T.CylinderGeometry(.5,.5,1,12);
function box(g,x,y,z,sx,sy,sz,color,name=''){const m=new T.Mesh(B,mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.name=name;g.add(m);return m}
function cyl(g,x,y,z,r,h,color,axis='y',name=''){const m=new T.Mesh(C,mat(color));m.position.set(x,y,z);m.scale.set(r*2,h,r*2);if(axis==='z')m.rotation.x=Math.PI/2;if(axis==='x')m.rotation.z=Math.PI/2;m.name=name;g.add(m);return m}
function merge(group,name){const parts=[];group.updateMatrixWorld(true);group.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.clone().toNonIndexed();geo.applyMatrix4(o.matrixWorld);const col=new Float32Array(geo.attributes.position.count*3),c=o.material.color;for(let i=0;i<col.length;i+=3){col[i]=c.r;col[i+1]=c.g;col[i+2]=c.b}geo.setAttribute('color',new T.BufferAttribute(col,3));delete geo.attributes.uv;parts.push(geo)});const mesh=new T.Mesh(mergeGeometries(parts),new T.MeshStandardMaterial({vertexColors:true,roughness:.78,metalness:.12,flatShading:true}));mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;return mesh}
function save(group,name){group.updateMatrixWorld(true);fs.writeFileSync(`${out}/assets/${name}.json`,JSON.stringify(group.toJSON()));}
// Positive-Z camera-facing wall is intentionally absent, not transparent artwork.
const shell=new T.Group();shell.name='TrainCutaway';const body=new T.Group();
box(body,0,.93,0,8,.3,3.1,0xa4b4be);box(body,0,.65,0,7.7,.32,2.7,0x233744);box(body,0,2.58,-1.48,8,3.0,.18,0x9caeb3);
box(body,0,1.3,-1.34,7.65,.28,.12,0xe2ad46);box(body,0,3.60,-1.30,7.7,.18,.25,0x293e49);
for(const x of [-3.87,3.87]){box(body,x,2.54,-1.32,.18,2.9,.30,0x263e4b);box(body,x,1.22,.60,.16,.2,1.6,0xe5b248)}
for(const x of [-2.55,0,2.55]){box(body,x,2.95,-1.34,1.7,.75,.05,0x294455);box(body,x,2.95,-1.29,1.52,.56,.04,0x487b94)}
box(body,0,.9,1.55,8,.10,.1,0xf4c563);box(body,-4.12,.75,0,.3,.18,.45,0x66777f);box(body,4.12,.75,0,.3,.18,.45,0x66777f);
shell.add(merge(body,'Hull'));const roof=new T.Group();box(roof,0,4.03,-.34,8,.18,2.36,0x718b97);box(roof,0,4.17,-1.44,8,.16,.12,0xeac06f);shell.add(merge(roof,'RoofCutaway'));
const ladder=new T.Group();for(const x of [-.4,.4])box(ladder,x,2.59,-1.15,.08,3.0,.10,0xefb744);for(let i=0;i<9;i++)box(ladder,0,1.22+i*.34,-1.15,.88,.07,.10,0xecc36a);shell.add(merge(ladder,'Ladder'));
for(const x of [-2.65,2.65])for(const z of [-1.28,1.28]){const wheel=new T.Group();wheel.name='Wheel';wheel.position.set(x,.48,z);cyl(wheel,0,0,0,.46,.23,0x182733,'z');cyl(wheel,0,0,.14,.23,.05,0x8eabb9,'z');box(wheel,0,0,.19,.08,.66,.04,0xcbd5d6);shell.add(wheel)}save(shell,'train-cutaway');
const robot=new T.Group();robot.name='CrewRobot';const torso=new T.Group();box(torso,0,.90,0,.56,.68,.40,0x3c83c7);box(torso,0,1.13,.23,.48,.13,.08,0xc0e4ed);box(torso,0,1.48,0,.51,.44,.47,0xbacdd2);box(torso,0,1.49,.25,.42,.14,.03,0x102c41);box(torso,0,.60,-.25,.42,.55,.18,0x244863);robot.add(merge(torso,'Body'));
for(const [n,x] of [['LegL',-.17],['LegR',.17]]){const leg=new T.Group();leg.name=n;leg.position.set(x,.5,0);box(leg,0,-.20,0,.20,.43,.22,0x243d50);box(leg,.06,-.43,.05,.34,.15,.34,0x758a95);robot.add(leg)}
const arm=new T.Group();arm.name='WeaponArm';arm.position.set(.22,1.05,.22);box(arm,.19,0,0,.42,.15,.15,0x588bb5);box(arm,.40,0,0,.16,.20,.19,0xcbd5d8);const tool=new T.Group();tool.name='Wrench';box(tool,.61,0,0,.40,.09,.10,0xd5d6c8);box(tool,.84,0,0,.18,.23,.11,0xebe9d7);box(tool,.9,0,.06,.09,.1,.05,0x283843);arm.add(tool);const gun=new T.Group();gun.name='Sidearm';box(gun,.58,0,0,.43,.17,.16,0x343d41);box(gun,.52,-.14,0,.11,.23,.13,0x77848a);const muzzle=new T.Object3D();muzzle.name='Muzzle';muzzle.position.set(.795,0,0);gun.add(muzzle);arm.add(gun);robot.add(arm);save(robot,'crew-robot');
const crate=new T.Group();const cr=new T.Group();box(cr,0,.38,0,.80,.76,.70,0xaa7839);for(const x of [-.29,.29])box(cr,x,.38,.37,.08,.76,.06,0xf0bb63);for(const y of [.10,.65])box(cr,0,y,.37,.8,.08,.06,0xf0bb63);crate.add(merge(cr,'Crate'));save(crate,'cargo-crate');
const info={build:'V9R1-WEBGL-20260913',renderer:'Three.js WebGL2',three:'0.180.0',models:['train-cutaway.json','crew-robot.json','cargo-crate.json'],modelOrigin:'original authored geometry'};fs.writeFileSync(`${out}/build.json`,JSON.stringify(info,null,2));
console.log('Built actual 3D models and local renderer: '+info.models.join(', '));
