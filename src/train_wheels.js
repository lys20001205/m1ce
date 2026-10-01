import * as T from '../vendor/three.module.min.js';

// Kenney Train Kit 1.1 exports each bogie, four tyres and their hubs as one
// indexed mesh. Its origin is at the bogie top, NOT a wheel axle. Only split
// the authored circular tyre faces and protruding hubs; suspension stays still.
const axleY=-.359499365/2, axleZ=.191595803, radius=.189;
function subset(source,indices){
 const geometry=new T.BufferGeometry();
 for(const [name,a] of Object.entries(source.attributes)){
  const array=new a.array.constructor(indices.length*a.itemSize);
  indices.forEach((id,i)=>{for(let k=0;k<a.itemSize;k++)array[i*a.itemSize+k]=a.array[id*a.itemSize+k];});
  geometry.setAttribute(name,new T.BufferAttribute(array,a.itemSize,a.normalized));
 }
 geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
export function prepareTrainWheels(model){
 const bogies=[];model.traverse(o=>{if(o.isMesh&&['wheels-front','wheels-back'].includes(o.name))bogies.push(o);});
 for(const bogie of bogies){
  const source=bogie.geometry,p=source.getAttribute('position'),index=source.index;
  if(!index||bogie.userData.fixedBogie)continue;
  const buckets=[[],[],[],[],[]];
  for(let i=0;i<index.count;i+=3){
   const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],points=ids.map(id=>new T.Vector3().fromBufferAttribute(p,id));
   const side=Math.sign(points[0].x),end=Math.sign(points[0].z);
   const same=points.every(v=>Math.sign(v.x)===side&&Math.sign(v.z)===end);
   const tyre=same&&points.every(v=>Math.abs(v.x)>=.29999&&Math.abs(v.x)<=.40001&&Math.abs(Math.hypot(v.y-axleY,v.z-end*axleZ)-radius)<.001);
   const hub=same&&points.every(v=>Math.abs(v.x)>=.45999)&&points.some(v=>Math.abs(v.x)>.48);
   buckets[tyre||hub?(side<0?0:2)+(end<0?0:1):4].push(...ids);
  }
  // Fail visibly rather than silently animate a whole unrecognised bogie.
  if(buckets.slice(0,4).some(ids=>ids.length!==138))throw Error('Unexpected Kenney wheel geometry: '+bogie.name+' / '+buckets.map(b=>b.length).join(','));
  bogie.geometry=subset(source,buckets[4]);bogie.userData.fixedBogie=true;
  for(let i=0;i<4;i++){
   const geometry=subset(source,buckets[i]),pivot=new T.Vector3(i<2?-.35:.35,axleY,(i%2?1:-1)*axleZ);
   geometry.translate(-pivot.x,-pivot.y,-pivot.z);
   const wheel=new T.Mesh(geometry,bogie.material);wheel.name='Kenney-Tyre-'+i;
   wheel.position.copy(pivot);wheel.castShadow=wheel.receiveShadow=true;
   wheel.userData.rollingTyre=true;wheel.userData.radius=radius;bogie.add(wheel);
  }
 }
}
export function rollTrainWheels(car,travel){
 car.traverse(o=>{if(o.userData.rollingTyre){const scale=o.parent.getWorldScale(new T.Vector3());o.rotation.x=(travel/(o.userData.radius*scale.y))%(Math.PI*2);}});
}
