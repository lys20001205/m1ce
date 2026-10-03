// GLB materials are shared by many instances. Cache role-specific copies so
// scenery grading and hostile uniforms never recolour playable assets.
export class MaterialRoles {
 constructor(){this.cache=new Map();}
 get(source,role){
  const key=role+':'+source.uuid;
  if(!this.cache.has(key)){
   const material=source.clone(),tint=source.color.clone().setHex(role==='enemy'?0xff9274:0x789399);
   material.color.multiply(tint);this.cache.set(key,material);
  }
  return this.cache.get(key);
 }
 apply(group,role){group.traverse(o=>{if(o.isMesh)o.material=Array.isArray(o.material)?o.material.map(m=>this.get(m,role)):this.get(o.material,role);});}
}
