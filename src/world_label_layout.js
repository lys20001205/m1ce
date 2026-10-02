// Car labels are optional world annotations; controls and the permanent vitals win.
export function showCarHealthLabel(car,inspect,point,controls){
 if(!inspect&&car.hp>=car.max*.9)return false;
 const label={left:point.x-55,right:point.x+55,top:point.y-13,bottom:point.y+13};
 return !controls.some(r=>label.left<r.right&&label.right>r.left&&label.top<r.bottom&&label.bottom>r.top);
}
