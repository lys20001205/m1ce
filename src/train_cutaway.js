import * as T from '../vendor/three.module.min.js';

// The authored GLB, wheels, rear rails, collision floor and shared materials stay intact.
const variants=new WeakMap();
const serviceBodies=new WeakMap();
export const CATWALK_DECK_FRACTION=(.1+.147247374)/(.454119623+.147247374);
export function catwalkBaseY(floor,height){return floor-height*CATWALK_DECK_FRACTION;}

// A side-cut railway service body, rather than a factory walkway hovering above
// a complete locomotive. All vertical structure sits behind the Z=.65 play lane.
// This presentation owns no collision; FLOOR/ROOF and imported bogies stay intact.
export function buildServiceCarBody(view,car,type,{floor=1.12,roof=4.12}={}){
 let cache=serviceBodies.get(view);if(!cache){cache=new Map();serviceBodies.set(view,cache);}const key=type+':'+floor+':'+roof;
 if(cache.has(key)){const body=cache.get(key).clone(true);car.add(body);return {body,deck:body.getObjectByName('RoofWalkSurface')};}
 const palette={engine:[0xc79837,0x665433],cargo:[0x9d4140,0x593039],battery:[0x34746e,0x294d52],workshop:[0x617c90,0x354956]};
 const [paint,dark]=palette[type]||palette.workshop,body=new T.Group();body.name='Service-Car-Body-'+type;car.add(body);
 const part=(name,x,y,z,sx,sy,sz,color)=>{const m=view.box(body,x,y,z,sx,sy,sz,color);m.name=name;return m;};
 // Rear wall, roof band and end pillars form one continuous load-bearing outline.
 part('Car-Rear-Lower-Wall',0,1.98,-1.43,7.74,1.72,.10,dark);
 part('Car-Rear-Upper-Wall',0,3.43,-1.43,7.74,1.30,.10,paint);
 for(const x of [-3.82,3.82])part('Car-End-Pillar',x,(floor+roof)/2,-1.11,.16,roof-floor,.72,dark);
 part('Car-Roof-Fascia',0,roof-.13,-1.35,7.96,.25,.18,paint);
 const deck=part('RoofWalkSurface',0,roof-.08,-.025,8,.16,2.75,0x526a75);
 // A single rear safety rail belongs to the carriage. No front pipes cross actors.
 part('Car-Rear-Safety-Rail',0,roof+.43,-1.34,7.85,.065,.065,0xe7b54f);
 for(const x of [-3.78,-1.9,0,1.9,3.78])part('Car-Rear-Rail-Stanchion',x,roof+.22,-1.34,.05,.44,.05,dark);
 part('RoofWalkEdge',0,roof+.008,1.32,7.98,.016,.035,0xe7b54f);
 for(const x of [-3,-2,-1,0,1,2,3])part('RoofWalkGrip',x,roof+.008,.45,.025,.016,1.62,0x94a6ac);
 // Type-specific upper body: cab windows, freight ribs, power vents or tool lockers.
 if(type==='engine'){
  for(const x of [-2.65,-.95,.95,2.65]){
   part('Cab-Window-Frame',x,3.42,-1.35,1.44,.78,.075,dark);
   part('Cab-Window',x,3.44,-1.29,1.28,.61,.035,0x284b5b);
   part('Cab-Window-Glint',x-.37,3.58,-1.265,.04,.24,.016,0x83bac3);
  }
  part('Cab-Front-Windscreen',-3.72,3.41,-.91,.035,.70,.61,0x284b5b);
 }else if(type==='cargo'){
  for(const x of [-3.3,-2.7,-2.1,-1.5,-.9,.9,1.5,2.1,2.7,3.3])part('Freight-Body-Rib',x,3.43,-1.34,.055,1.12,.08,dark);
  part('Freight-Cargo-Plate',0,3.51,-1.31,.92,.35,.035,0xe0bc70);
 }else if(type==='battery'){
  for(const x of [-2.4,-.8,.8,2.4]){
   part('Power-Vent-Housing',x,3.43,-1.33,1.23,.86,.12,dark);
   for(const y of [3.18,3.34,3.50,3.66])part('Power-Vent-Slat',x,y,-1.24,1.05,.035,.025,0x8cb7aa);
  }
 }else{
  for(const x of [-2.5,-1.1,1.1,2.5]){
   part('Service-Tool-Locker',x,3.40,-1.31,1.20,.94,.15,dark);
   part('Service-Tool-Locker-Panel',x,3.40,-1.22,1.10,.84,.025,paint);
   part('Service-Locker-Handle',x+.40,3.37,-1.19,.05,.21,.02,0xd2c9a4);
  }
 }
 // Bake the static shell into one vertex-coloured draw, keeping the walk deck
 // separately inspectable. This is cheaper than the former four GLB rail sections.
 const positions=[],normals=[],colors=[],parts=[];
 for(const mesh of [...body.children]){
  parts.push({name:mesh.name,position:mesh.position.toArray(),size:mesh.scale.toArray(),color:mesh.material.color.getHex()});
  if(mesh===deck)continue;
  mesh.updateMatrix();const geometry=mesh.geometry.clone().toNonIndexed();geometry.applyMatrix4(mesh.matrix);
  positions.push(...geometry.getAttribute('position').array);normals.push(...geometry.getAttribute('normal').array);
  const c=mesh.material.color;for(let i=0;i<geometry.getAttribute('position').count;i++)colors.push(c.r,c.g,c.b);
  geometry.dispose();body.remove(mesh);
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const shell=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:.76,metalness:.14}));shell.name='Car-Integrated-Shell';shell.castShadow=shell.receiveShadow=true;body.add(shell);
 body.userData.walkTop=roof;body.userData.openFront=true;body.userData.carType=type;body.userData.parts=parts;
 cache.set(key,body.clone(true));
 return {body,deck};
}
export function cutForeground(model,root,{floor,front=1.05}={}){
  root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),point=new T.Vector3();let removedTriangles=0,meshes=0;
  model.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.geometry?.attributes.position)return;
    const geometry=mesh.geometry,position=geometry.attributes.position,index=geometry.index,matrix=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
    // Only Y/Z affect this cut, so station sections can share derived GPU geometry.
    const key=[floor,front,...[1,5,9,13,2,6,10,14].map(i=>Math.round(matrix.elements[i]*1e6)/1e6)].join(':');
    let cache=variants.get(geometry);if(!cache){cache=new Map();variants.set(geometry,cache);}let cut=cache.get(key);
    if(!cut){const count=index?.count??position.count,kept=[],groups=[],oldGroups=geometry.groups.length?geometry.groups:[{start:0,count,materialIndex:0}];let removed=0;
      for(const group of oldGroups){const start=kept.length;for(let i=group.start;i<Math.min(count,group.start+group.count);i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);let y=0,z=0;for(const id of ids){point.fromBufferAttribute(position,id).applyMatrix4(matrix);y+=point.y/3;z+=point.z/3;}if(y>floor+.22&&z>front){removed++;continue;}kept.push(...ids);}if(kept.length>start)groups.push({start,count:kept.length-start,materialIndex:group.materialIndex});}
      if(removed){const derived=geometry.clone();derived.setIndex(kept);derived.clearGroups();for(const g of groups)derived.addGroup(g.start,g.count,g.materialIndex);cut={geometry:derived,removed};}else cut={geometry,removed:0};cache.set(key,cut);
    }
    if(cut.removed){mesh.geometry=cut.geometry;removedTriangles+=cut.removed;meshes++;}
  });return {removedTriangles,meshes};
}
