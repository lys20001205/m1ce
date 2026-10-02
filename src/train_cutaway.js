import * as T from '../vendor/three.module.min.js';

// The authored GLB, wheels, rear rails, collision floor and shared materials stay intact.
const variants=new WeakMap();
const serviceBodies=new WeakMap();
const upperBodies=new WeakMap();
export const CATWALK_DECK_FRACTION=(.1+.147247374)/(.454119623+.147247374);
export function catwalkBaseY(floor,height){return floor-height*CATWALK_DECK_FRACTION;}

// Integrate the imported cab/container into the one playable carriage height.
// Derive only its body vertices above the interior floor: bogies, chassis,
// imported source geometry, axle pivots and authored texture coordinates survive.
export function fitCarUpperBody(model,root,{floor=1.12,top=4.04,names=[]}={}){
 root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),point=new T.Vector3();let count=0;
 model.traverse(mesh=>{
  // GLTFLoader wraps a node that has both a mesh and children in a Group,
  // naming its body mesh <node>_1. Match that body, never its wheel children.
  if(!mesh.isMesh||!(names.includes(mesh.name)||names.includes(mesh.parent?.name)&&mesh.name===mesh.parent.name+'_1'))return;
  const source=mesh.geometry,position=source.getAttribute('position'),matrix=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),back=matrix.clone().invert();let highest=-Infinity;
  for(let i=0;i<position.count;i++){point.fromBufferAttribute(position,i).applyMatrix4(matrix);highest=Math.max(highest,point.y);}
  if(highest<=floor+.05)return;
  const key=[floor,top,...matrix.elements.map(n=>Math.round(n*1e6)/1e6)].join(':');let cache=upperBodies.get(source);if(!cache){cache=new Map();upperBodies.set(source,cache);}let derived=cache.get(key);
  if(!derived){derived=source.clone();const dest=derived.getAttribute('position'),ratio=(top-floor)/(highest-floor);
   for(let i=0;i<position.count;i++){point.fromBufferAttribute(position,i).applyMatrix4(matrix);if(point.y>floor)point.y=floor+(point.y-floor)*ratio;point.applyMatrix4(back);dest.setXYZ(i,point.x,point.y,point.z);}
   derived.computeVertexNormals();derived.computeBoundingBox();derived.computeBoundingSphere();cache.set(key,derived);
  }
  mesh.geometry=derived;mesh.userData.integratedBodyTop=top;count++;
 });return count;
}

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
 part('Car-Rear-Lower-Wall',0,1.98,-1.48,7.42,1.72,.06,dark);
 part('Car-Rear-Upper-Wall',0,3.43,-1.48,7.42,1.30,.06,paint);
 for(const x of [-3.70,3.70])part('Car-End-Pillar',x,(floor+roof)/2,-1.25,.09,roof-floor,.36,dark);
 part('Car-Roof-Fascia',0,roof-.075,-1.46,7.5,.15,.08,paint);
 // The roof sits INSIDE the chassis footprint, with a short cut edge. The old
 // full-width awning, upper rail and grip stripes made it look like a terrace.
 const deck=part('RoofWalkSurface',0,roof-.045,-.28,7.60,.09,2.32,paint);
 part('RoofWalkEdge',0,roof-.025,.87,7.60,.04,.025,dark);
 // Very short flush metal lips leave readable footing without an external rail.
 for(const x of [-3.70,3.70])part('Car-Roof-End-Cap',x,roof-.025,-.28,.05,.04,2.30,dark);
 part('Roof-Gangway',4.15,roof-.045,.65,.85,.09,.60,dark);
 // Type-specific upper body: cab windows, freight ribs, power vents or tool lockers.
 if(type==='engine'){
  for(const x of [-2.65,-.95,.95,2.65]){
   part('Cab-Window-Frame',x,3.42,-1.40,1.44,.78,.065,dark);
   part('Cab-Window',x,3.44,-1.35,1.28,.61,.025,0x284b5b);
   part('Cab-Window-Glint',x-.37,3.58,-1.33,.04,.24,.012,0x83bac3);
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
