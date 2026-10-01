import * as T from '../vendor/three.module.min.js';

// The authored GLB, wheels, rear rails, collision floor and shared materials stay intact.
const variants=new WeakMap();
export const CATWALK_DECK_FRACTION=(.1+.147247374)/(.454119623+.147247374);
export function catwalkBaseY(floor,height){return floor-height*CATWALK_DECK_FRACTION;}
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
